create function public.stock_key(product text,unit text) returns text language sql immutable set search_path=public,pg_temp as $$ select translate(lower(trim(product)),'áéíóúüñ','aeiouun')||'|'||case when unit='unidad' then 'unidades' when unit='rebanada' then 'rebanadas' else unit end; $$;
create function public.stock_mode(doc jsonb,product text,unit text) returns text language sql immutable set search_path=public,pg_temp as $$ select coalesce(doc->'stockPolicies'->public.stock_key(product,unit)->>'mode',case when public.stock_key(product,'g') in('pollo|g','pescado|g','carne de res|g','atun escurrido|g') or exists(select 1 from jsonb_array_elements(coalesce(doc->'stockMovements','[]')) m where m->>'kind'='opening' and public.stock_key(m->>'name',m->>'unit')=public.stock_key(product,unit)) then 'tracked' else 'always_available' end); $$;
create function public.stock_balance(doc jsonb,product text,unit text) returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
declare movement jsonb;balance numeric:=null;since_time text;
begin
 since_time:=doc->'stockPolicies'->public.stock_key(product,unit)->>'since';
 for movement in select value from jsonb_array_elements(coalesce(doc->'stockMovements','[]')) loop
  if public.stock_key(movement->>'name',movement->>'unit')<>public.stock_key(product,unit) or (since_time is not null and movement->>'occurredAt'<since_time) then continue;end if;
  if movement->>'kind'='opening' and balance is null then balance:=(movement->>'quantity')::numeric;
  elsif balance is not null and movement->>'kind'<>'opening' then balance:=balance+(movement->>'quantity')::numeric;end if;
 end loop;return balance;
end; $$;

create function public.get_collaborator_workspace(hid uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare doc jsonb;rev bigint;result jsonb:='{}';meal_plan jsonb;task_list jsonb;
begin
 if not public.is_household_member(hid) then raise exception 'Forbidden' using errcode='42501';end if;
 select data,revision into doc,rev from public.household_state where household_id=hid;
 result:=jsonb_build_object('revision',rev);
 if public.has_household_permission(hid,'kitchen.read') then
  select coalesce(jsonb_agg(jsonb_build_object('slot',p.key,'recipeId',r.id,'name',r.name,'person',split_part(p.key,'|',1),'day',split_part(p.key,'|',2),'meal',r.meal,'portions',1,'ingredients',r.ingredients,'instructions',r.instructions) order by p.key),'[]') into meal_plan from jsonb_each_text(coalesce(doc->'plan','{}')) p join public.recipes r on r.id=p.value;
  result:=result||jsonb_build_object('plan',meal_plan);
 end if;
 if public.has_household_permission(hid,'tasks.read') then
  select coalesce(jsonb_agg(jsonb_build_object('id',t->>'id','title',t->>'title','frequency',t->>'frequency','done',coalesce((t->>'done')::boolean,false))),'[]') into task_list from jsonb_array_elements(coalesce(doc->'tasks','[]')) t where t->>'assigneeId'=auth.uid()::text;
  result:=result||jsonb_build_object('tasks',task_list);
 end if;
 if public.has_household_permission(hid,'assets.read') then result:=result||jsonb_build_object('assets',coalesce(doc->'assets','[]'));end if;
 if public.has_household_permission(hid,'inventory.read') then
  result:=result||jsonb_build_object('stockPolicies',coalesce(doc->'stockPolicies','{}'),'stockMovements',coalesce((select jsonb_agg(m-'note') from jsonb_array_elements(coalesce(doc->'stockMovements','[]')) m),'[]'));
 end if;
 return result;
end; $$;
create function public.set_my_task_done(hid uuid,task_id text,new_done boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare doc jsonb;items jsonb;
begin
 if not public.has_household_permission(hid,'tasks.update') then raise exception 'Forbidden' using errcode='42501';end if;
 if task_id is null or new_done is null then raise exception 'Invalid task update';end if;
 select data into doc from public.household_state where household_id=hid for update;
 if not exists(select 1 from jsonb_array_elements(coalesce(doc->'tasks','[]')) t where t->>'id'=task_id and t->>'assigneeId'=auth.uid()::text) then raise exception 'Forbidden' using errcode='42501';end if;
 select jsonb_agg(case when t->>'id'=task_id then t||jsonb_build_object('done',new_done) else t end) into items from jsonb_array_elements(doc->'tasks') t;
 update public.household_state set data=jsonb_set(doc,'{tasks}',items),revision=revision+1,updated_at=now() where household_id=hid;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'task.completed',task_id);
end; $$;
create function public.save_operational_asset(hid uuid,asset_id text,asset_name text,asset_detail text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare doc jsonb;items jsonb;item jsonb;
begin
 if not public.has_household_permission(hid,'assets.write') then raise exception 'Forbidden' using errcode='42501';end if;
 if asset_id is null or asset_name is null or asset_detail is null or length(asset_id)>100 or length(asset_name)<1 or length(asset_name)>200 or length(asset_detail)>5000 then raise exception 'Invalid asset';end if;
 select data into doc from public.household_state where household_id=hid for update;
 item:=jsonb_build_object('id',asset_id,'name',asset_name,'detail',asset_detail);
 if exists(select 1 from jsonb_array_elements(coalesce(doc->'assets','[]')) a where a->>'id'=asset_id) then
  select jsonb_agg(case when a->>'id'=asset_id then item else a end) into items from jsonb_array_elements(doc->'assets') a;
 else items:=coalesce(doc->'assets','[]')||jsonb_build_array(item);end if;
 update public.household_state set data=jsonb_set(doc,'{assets}',items),revision=revision+1,updated_at=now() where household_id=hid;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'asset.saved',asset_id);
end; $$;
create function public.record_stock_movement(hid uuid,event_id uuid,product text,stock_unit text,movement_kind text,amount numeric) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare doc jsonb;balance numeric;delta numeric;movement jsonb;
begin
 if not public.has_household_permission(hid,'inventory.write') then raise exception 'Forbidden' using errcode='42501';end if;
 if amount is null or product is null or stock_unit is null or movement_kind is null or event_id is null or movement_kind not in('opening','purchase','correction') or stock_unit not in('g','ml','unidades','unidad','rebanada','rebanadas') or length(trim(product)) not between 1 and 120 or amount<0 or amount>100000000 or amount::text in('NaN','Infinity','-Infinity') then raise exception 'Invalid movement';end if;
 select data into doc from public.household_state where household_id=hid for update;
 if exists(select 1 from jsonb_array_elements(coalesce(doc->'stockMovements','[]')) m where m->>'id'=event_id::text) then return;end if;
 if public.stock_mode(doc,product,stock_unit)<>'tracked' then raise exception 'Product is not tracked';end if;
 balance:=public.stock_balance(doc,product,stock_unit);
 if movement_kind='opening' and balance is not null then raise exception 'Initial count already exists';end if;
 if movement_kind<>'opening' and balance is null then raise exception 'Initial count required';end if;
 if movement_kind='purchase' and amount=0 then raise exception 'Purchase must be positive';end if;
 delta:=case when movement_kind='correction' then amount-balance else amount end;
 movement:=jsonb_build_object('id',event_id,'name',trim(product),'unit',stock_unit,'quantity',delta,'kind',movement_kind,'occurredAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 update public.household_state set data=jsonb_set(doc,'{stockMovements}',coalesce(doc->'stockMovements','[]')||jsonb_build_array(movement)),revision=revision+1,updated_at=now() where household_id=hid;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'stock.'||movement_kind,event_id::text);
end; $$;
create function public.confirm_kitchen_preparation(hid uuid,slot_key text,recipe_id text,event_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare doc jsonb;r public.recipes%rowtype;nutrition jsonb;ingredient jsonb;movements jsonb;entry jsonb;stamp text;index_no integer:=0;
begin
 if not public.has_household_permission(hid,'kitchen.confirm') or not public.has_household_permission(hid,'kitchen.read') then raise exception 'Forbidden' using errcode='42501';end if;
 if slot_key is null or recipe_id is null or event_id is null then raise exception 'Invalid preparation';end if;
 select data into doc from public.household_state where household_id=hid for update;
 if exists(select 1 from jsonb_array_elements(coalesce(doc->'history','[]')) h where h->>'id'=event_id::text) then return;end if;
 if doc->'plan'->>slot_key is distinct from recipe_id then raise exception 'Plan changed; refresh first';end if;
 select * into r from public.recipes where id=recipe_id;if not found then raise exception 'Recipe missing';end if;
 select macros into nutrition from public.recipe_nutrition where recipe_nutrition.recipe_id=r.id;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 entry:=jsonb_build_object('id',event_id,'recipeId',r.id,'name',r.name,'person',split_part(slot_key,'|',1),'preparedAt',stamp,'date',stamp,'feedback','','recipeSnapshot',jsonb_build_object('id',r.id,'name',r.name,'meal',r.meal,'ingredients',r.ingredients,'macros',nutrition));
 movements:=coalesce(doc->'stockMovements','[]');
 for ingredient in select value from jsonb_array_elements(r.ingredients) loop
  if public.stock_mode(doc,ingredient->>'name',ingredient->>'unit')='tracked' then
   movements:=movements||jsonb_build_array(jsonb_build_object('id',event_id::text||':ingredient:'||index_no,'sourceId',event_id,'name',ingredient->>'name','unit',ingredient->>'unit','quantity',-((ingredient->>'quantity')::numeric),'kind','preparation','occurredAt',stamp));
  end if;index_no:=index_no+1;
 end loop;
 doc:=jsonb_set(jsonb_set(doc,'{history}',jsonb_build_array(entry)||coalesce(doc->'history','[]')),'{stockMovements}',movements);
 update public.household_state set data=doc,revision=revision+1,updated_at=now() where household_id=hid;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'preparation.confirmed',event_id::text);
end; $$;
revoke all on function public.stock_key(text,text),public.stock_mode(jsonb,text,text),public.stock_balance(jsonb,text,text),public.get_collaborator_workspace(uuid),public.set_my_task_done(uuid,text,boolean),public.save_operational_asset(uuid,text,text,text),public.record_stock_movement(uuid,uuid,text,text,text,numeric),public.confirm_kitchen_preparation(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_collaborator_workspace(uuid),public.set_my_task_done(uuid,text,boolean),public.save_operational_asset(uuid,text,text,text),public.record_stock_movement(uuid,uuid,text,text,text,numeric),public.confirm_kitchen_preparation(uuid,text,text,uuid) to authenticated;
-- Null arguments must not slip through SQL three-valued conditionals.
-- Shared definitions below also enforce household/person correspondence.
alter table public.family_people add constraint family_people_household_id_id_key unique(household_id,id);
alter table public.person_access add constraint access_person_same_household foreign key(household_id,person_id) references public.family_people(household_id,id);
alter table public.medical_records add constraint medical_person_same_household foreign key(household_id,person_id) references public.family_people(household_id,id);
revoke select on public.medical_records from authenticated;
create function public.read_medical_records(hid uuid,pid uuid) returns setof public.medical_records language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.can_read_medical(hid,pid) then raise exception 'Forbidden' using errcode='42501';end if;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'medical.read',pid::text);
 return query select * from public.medical_records where household_id=hid and person_id=pid;
end; $$;
revoke all on function public.read_medical_records(uuid,uuid) from public,anon;
grant execute on function public.read_medical_records(uuid,uuid) to authenticated;
