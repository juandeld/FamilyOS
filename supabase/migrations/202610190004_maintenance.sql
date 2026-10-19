-- Recurring maintenance stays in the admin document. Staff only receives assigned
-- task snapshots; completion is atomic and cannot rewrite the private plan.
create function public.next_maintenance_due(plan jsonb, completed_on date) returns date language plpgsql immutable set search_path=public,pg_temp as $$
declare candidate date; old_due date; anchor integer; step_months integer; offset_no integer; month_no integer; base_month integer; slots jsonb;
begin
 anchor:=greatest(1,least(31,coalesce((plan->>'anchorDay')::integer,1)));
 old_due:=(plan->>'nextDue')::date;
 if plan->>'frequency'='weekly' then
   return old_due + (greatest(1,((completed_on-old_due)/7)+1)*7);
 end if;
 step_months:=case plan->>'frequency' when 'monthly' then 1 when 'quarterly' then 3 when 'semiannual' then 6 when 'annual' then 12 else null end;
 if step_months is null then raise exception 'Invalid recurrence';end if;
 slots:=coalesce(plan->'months','[]');base_month:=extract(month from completed_on)::integer;
 for offset_no in 0..24 loop
   candidate:=(date_trunc('month',completed_on)+make_interval(months=>offset_no))::date;
   month_no:=extract(month from candidate)::integer;
   if (jsonb_array_length(slots)>0 and not slots @> to_jsonb(array[month_no])) or (jsonb_array_length(slots)=0 and mod(month_no-base_month+12,step_months)<>0) then continue;end if;
   candidate:=candidate+(least(anchor,extract(day from(candidate+interval '1 month - 1 day'))::integer)-1);
   if candidate>completed_on then return candidate;end if;
 end loop;
 raise exception 'Invalid calendar';
end; $$;
create function public.complete_maintenance_state(doc jsonb, task jsonb, actor text, stamp timestamptz) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare plan jsonb; due_on date; done_on date; next_date date; plans jsonb; history jsonb; tasks jsonb; event jsonb; next_task jsonb; next_id text; materials text;
begin
 if coalesce((task->>'done')::boolean,false) then return doc;end if;
 select value into plan from jsonb_array_elements(coalesce(doc->'maintenance'->'plans','[]')) where value->>'id'=task->'maintenance'->>'planId';
 if plan is null or plan->>'status'='draft' or plan->>'nextDue' is distinct from task->'maintenance'->>'dueDate' then raise exception 'Plan changed; refresh first';end if;
 due_on:=(plan->>'nextDue')::date;done_on:=(stamp at time zone 'America/Guatemala')::date;
 if due_on>done_on then raise exception 'Future maintenance requires rescheduling';end if;
 history:=coalesce(doc->'maintenance'->'history','[]');
 if exists(select 1 from jsonb_array_elements(history) e where e->>'id'=task->>'id') then return doc;end if;
 next_date:=public.next_maintenance_due(plan,done_on);
 event:=jsonb_build_object('id',task->>'id','planId',plan->>'id','title',plan->>'title','area',plan->>'area','dueOn',due_on,'completedOn',done_on,'confirmedAt',to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'by',coalesce(task->>'confirmedByName',actor),'actorId',actor,'note','','cost',null);
 select jsonb_agg(case when p->>'id'=plan->>'id' then p||jsonb_build_object('nextDue',next_date) else p end) into plans from jsonb_array_elements(doc->'maintenance'->'plans') p;
 select jsonb_agg(case when t->>'id'=task->>'id' then t||jsonb_build_object('done',true) else t end) into tasks from jsonb_array_elements(doc->'tasks') t;
 next_id:='maintenance:'||(plan->>'id')||':'||next_date::text;
 if plan->>'status'='active' and not exists(select 1 from jsonb_array_elements(tasks) t where t->>'id'=next_id) then
   select string_agg((m->>'name')||': '||coalesce(nullif(m->>'quantity',''),'cantidad por confirmar'),'; ') into materials from jsonb_array_elements(coalesce(plan->'materials','[]')) m where m->>'verified'='true';
   next_task:=jsonb_build_object('id',next_id,'title',plan->>'title','owner',plan->>'owner','frequency',case plan->>'frequency' when 'weekly' then 'Semanal' when 'monthly' then 'Mensual' when 'quarterly' then 'Trimestral' when 'semiannual' then 'Semestral' else 'Anual' end,'assigneeId',coalesce(plan->>'assigneeId',''),'done',false,'dueDate',next_date,'maintenance',jsonb_build_object('planId',plan->>'id','dueDate',next_date),'instructions',coalesce(plan->>'instructions','')||case when materials is null then '' else E'\nInsumos validados: '||materials end);
   tasks:=tasks||jsonb_build_array(next_task);
 end if;
 doc:=jsonb_set(doc,'{maintenance,plans}',plans);
 doc:=jsonb_set(doc,'{maintenance,history}',jsonb_build_array(event)||history);
 return jsonb_set(doc,'{tasks}',tasks);
end; $$;
create or replace function public.set_my_task_done(hid uuid,task_id text,new_done boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare doc jsonb;items jsonb;task jsonb;
begin
 if not public.has_household_permission(hid,'tasks.update') then raise exception 'Forbidden' using errcode='42501';end if;
 if task_id is null or new_done is null then raise exception 'Invalid task update';end if;
 select data into doc from public.household_state where household_id=hid for update;
 select value into task from jsonb_array_elements(coalesce(doc->'tasks','[]')) where value->>'id'=task_id and value->>'assigneeId'=auth.uid()::text;
 if task is null then raise exception 'Forbidden' using errcode='42501';end if;
 if task ? 'maintenance' then
   if not new_done then raise exception 'Maintenance history cannot be undone by a collaborator';end if;
   if coalesce((task->>'done')::boolean,false) then return;end if;
   doc:=public.complete_maintenance_state(doc,task||jsonb_build_object('confirmedByName',(select display_name from public.household_members where household_id=hid and user_id=auth.uid())),auth.uid()::text,clock_timestamp());
 else
   select jsonb_agg(case when t->>'id'=task_id then t||jsonb_build_object('done',new_done) else t end) into items from jsonb_array_elements(doc->'tasks') t;
   doc:=jsonb_set(doc,'{tasks}',items);
 end if;
 update public.household_state set data=doc,revision=revision+1,updated_at=now() where household_id=hid;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),case when task ? 'maintenance' then 'maintenance.completed' else 'task.updated' end,task_id);
end; $$;
-- Keep the existing projection, adding only instructions and dates to assigned
-- tasks. This avoids exposing import notes, costs, private references or history.
create function public.get_maintenance_tasks(hid uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare doc jsonb;items jsonb;
begin
 if not public.has_household_permission(hid,'tasks.read') then raise exception 'Forbidden' using errcode='42501';end if;
 select data into doc from public.household_state where household_id=hid;
 select coalesce(jsonb_agg(jsonb_build_object('id',t->>'id','title',t->>'title','frequency',t->>'frequency','done',coalesce((t->>'done')::boolean,false),'dueDate',t->>'dueDate','instructions',t->>'instructions')),'[]') into items from jsonb_array_elements(coalesce(doc->'tasks','[]')) t where t->>'assigneeId'=auth.uid()::text and t ? 'maintenance';
 return items;
end; $$;
revoke all on function public.next_maintenance_due(jsonb,date),public.complete_maintenance_state(jsonb,jsonb,text,timestamptz),public.get_maintenance_tasks(uuid) from public,anon,authenticated;
grant execute on function public.get_maintenance_tasks(uuid) to authenticated;
-- set_my_task_done retains its previous authenticated execute grant.
