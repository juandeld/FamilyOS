-- A stale application revision is an HTTP conflict, not a failed database transaction.
-- PostgREST maps SQLSTATE 40001 to HTTP 500; PT409 returns HTTP 409 without retries.
create or replace function public.save_household_state(hid uuid,expected_revision bigint,new_data jsonb) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare rev bigint;
begin
 if not public.is_household_admin(hid) then raise exception 'Forbidden' using errcode='42501'; end if;
 if jsonb_typeof(new_data)<>'object' or pg_column_size(new_data)>5000000 then raise exception 'Invalid state'; end if;
 update public.household_state set data=new_data,revision=revision+1,updated_at=now() where household_id=hid and revision=expected_revision returning revision into rev;
 if rev is null then raise exception 'State conflict' using errcode='PT409'; end if;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'state.updated',rev::text);
 return rev;
end; $$;
-- CREATE OR REPLACE preserves the original owner and explicit EXECUTE privileges.
