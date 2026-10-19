-- Managed staff logins do not require personal email addresses. Supabase Auth
-- stores credentials; this registry never stores a password or password hash.
-- Google enforcement is staged: existing administrators retain access until an
-- explicitly approved principal completes a real Google OAuth session.
alter table public.households add column google_admin_required boolean not null default false;

create table public.managed_staff_accounts(
 id uuid primary key,
 household_id uuid not null references public.households(id),
 username text not null unique check(username=lower(username) and username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
 display_name text not null check(length(trim(display_name)) between 1 and 100),
 permissions text[] not null default '{}' check(permissions <@ array['kitchen.read','kitchen.confirm','tasks.read','tasks.update','assets.read','assets.write','inventory.read','inventory.write']::text[]),
 user_id uuid unique references auth.users(id),
 status text not null default 'provisioning' check(status in('provisioning','active','resetting','failed')),
 sessions_valid_after timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index managed_staff_household on public.managed_staff_accounts(household_id);
create table public.login_rate_limits(
 key_hash text primary key check(length(key_hash) between 8 and 200),
 window_start timestamptz not null,
 attempts integer not null check(attempts>0)
);
create table public.google_admin_approvals(
 household_id uuid not null references public.households(id),
 email text not null unique check(email=lower(trim(email)) and length(email)<=254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 legacy_user_id uuid references auth.users(id),
 claimed_user_id uuid references auth.users(id),
 claimed_at timestamptz,
 approved_at timestamptz not null default now(),
 primary key(household_id,email),
 check((claimed_user_id is null)=(claimed_at is null))
);
alter table public.managed_staff_accounts enable row level security;
alter table public.login_rate_limits enable row level security;
alter table public.google_admin_approvals enable row level security;
revoke all on public.managed_staff_accounts,public.login_rate_limits,public.google_admin_approvals from public,anon,authenticated;
grant select,insert,update on public.managed_staff_accounts,public.google_admin_approvals to service_role;
grant select on public.login_rate_limits to service_role;
-- These writes are used only after the server verifies a current administrator.
grant select,insert,update on public.household_members to service_role;
grant insert on public.audit_events to service_role;
grant usage,select on sequence public.audit_events_id_seq to service_role;

create function public.consume_login_attempt(bucket text,max_attempts integer,window_seconds integer) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare used integer; stamp timestamptz:=clock_timestamp();
begin
 if bucket is null or length(bucket) not between 8 and 200 or max_attempts is null or max_attempts not between 1 and 200 or window_seconds is null or window_seconds not between 1 and 86400 then raise exception 'Invalid limiter parameters';end if;
 insert into public.login_rate_limits(key_hash,window_start,attempts) values(bucket,stamp,1)
 on conflict(key_hash) do update set
  window_start=case when public.login_rate_limits.window_start<=stamp-make_interval(secs=>window_seconds) then stamp else public.login_rate_limits.window_start end,
  attempts=case when public.login_rate_limits.window_start<=stamp-make_interval(secs=>window_seconds) then 1 else least(public.login_rate_limits.attempts+1,1000000) end
 returning attempts into used;
 if random()<0.01 then delete from public.login_rate_limits where window_start<stamp-interval '2 days';end if;
 return used<=max_attempts;
end; $$;

create function public.google_session_valid() returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare claims jsonb; uid uuid:=auth.uid(); address text;
begin
 if uid is null then return false;end if;
 begin claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 exception when invalid_text_representation then return false;end;
 if jsonb_typeof(claims->'amr') is distinct from 'array' then return false;end if;
 if not exists(select 1 from jsonb_array_elements(claims->'amr') a where a->>'method'='oauth') then return false;end if;
 select lower(email) into address from auth.users where id=uid and email_confirmed_at is not null;
 if address is null then return false;end if;
 -- OAuth AMR does not name its provider. Require a verified matching Google
 -- identity and fail closed if another OAuth provider has been linked.
 if not exists(select 1 from auth.identities i where i.user_id=uid and i.provider='google' and lower(i.identity_data->>'email')=address and i.identity_data->>'email_verified'='true') then return false;end if;
 if exists(select 1 from auth.identities i where i.user_id=uid and i.provider not in('email','google')) then return false;end if;
 return true;
end; $$;

create function public.household_session_allowed(hid uuid) returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare member_role text; require_google boolean; account record; claims jsonb; sid text; uid uuid:=auth.uid();
begin
 select m.role,h.google_admin_required into member_role,require_google from public.household_members m join public.households h on h.id=m.household_id where m.household_id=hid and m.user_id=uid and m.active;
 if member_role is null then return false;end if;
 if member_role='admin' then
  if require_google then return public.google_session_valid();end if;
  return true;
 end if;
 select status,sessions_valid_after into account from public.managed_staff_accounts where household_id=hid and user_id=uid;
 if not found then return true;end if;
 if account.status<>'active' then return false;end if;
 begin claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 exception when invalid_text_representation then return false;end;
 sid:=claims->>'session_id';
 if sid is null or length(sid)>100 then return false;end if;
 return exists(select 1 from auth.sessions s where s.id::text=sid and s.user_id=uid and s.created_at>=account.sessions_valid_after);
end; $$;

create or replace function public.is_household_admin(hid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.household_members where household_id=hid and user_id=auth.uid() and active and role='admin') and public.household_session_allowed(hid); $$;
create or replace function public.has_household_permission(hid uuid,permission text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.household_members where household_id=hid and user_id=auth.uid() and active and (role='admin' or permission=any(permissions))) and public.household_session_allowed(hid); $$;
create or replace function public.is_household_member(hid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select public.household_session_allowed(hid); $$;
drop policy recipes_read on public.recipes;
create policy recipes_read on public.recipes for select to authenticated using(exists(select 1 from public.household_members m where m.user_id=auth.uid() and m.active and (m.role='admin' or 'kitchen.read'=any(m.permissions)) and public.is_household_member(m.household_id)));
drop policy nutrition_admin on public.recipe_nutrition;
create policy nutrition_admin on public.recipe_nutrition for select to authenticated using(exists(select 1 from public.household_members m where m.user_id=auth.uid() and public.is_household_admin(m.household_id)));

create function public.resolve_managed_auth_user(account_id uuid) returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
declare uid uuid;
begin
 if not exists(select 1 from public.managed_staff_accounts where id=account_id) then return null;end if;
 select id into uid from auth.users where lower(email)=account_id::text||'@staff.familyos.invalid' and raw_app_meta_data->>'familyos_managed'='true';
 return uid;
end; $$;

create function public.claim_google_principal() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); address text; approval record; principal_name text; total integer:=0;
begin
 if not public.google_session_valid() then raise exception 'Verified Google session required' using errcode='42501';end if;
 select lower(email) into address from auth.users where id=uid and email_confirmed_at is not null;
 for approval in select * from public.google_admin_approvals where email=address for update loop
  if approval.claimed_user_id is not null and approval.claimed_user_id<>uid then raise exception 'Google approval already used' using errcode='42501';end if;
  if exists(select 1 from public.household_members where user_id=uid and is_principal and household_id<>approval.household_id) then raise exception 'Principal already belongs to another household' using errcode='42501';end if;
  principal_name:=null;
  if approval.legacy_user_id is not null then
   select display_name into principal_name from public.household_members where household_id=approval.household_id and user_id=approval.legacy_user_id and role='admin' and is_principal;
   if principal_name is null then raise exception 'Approved legacy principal no longer exists' using errcode='42501';end if;
  end if;
  if exists(select 1 from public.managed_staff_accounts where user_id=uid) then raise exception 'Managed staff cannot become a principal' using errcode='42501';end if;
  insert into public.household_members(household_id,user_id,display_name,role,is_principal,active) values(approval.household_id,uid,coalesce(principal_name,'Administrador principal'),'admin',true,true)
  on conflict(household_id,user_id) do update set role='admin',is_principal=true,active=true;
  if approval.legacy_user_id is not null and approval.legacy_user_id<>uid then
   update public.household_members set active=false where household_id=approval.household_id and user_id=approval.legacy_user_id and is_principal;
   update public.family_people set user_id=uid where household_id=approval.household_id and user_id=approval.legacy_user_id;
  end if;
  update public.households set google_admin_required=true where id=approval.household_id;
  if approval.claimed_user_id is null then
   update public.google_admin_approvals set claimed_user_id=uid,claimed_at=now() where household_id=approval.household_id and email=address;
   insert into public.audit_events(household_id,actor_id,action) values(approval.household_id,uid,'principal.google_activated');
   total:=total+1;
  end if;
 end loop;
 return total;
end; $$;

revoke all on function public.consume_login_attempt(text,integer,integer),public.google_session_valid(),public.household_session_allowed(uuid),public.resolve_managed_auth_user(uuid),public.claim_google_principal() from public,anon,authenticated;
grant execute on function public.consume_login_attempt(text,integer,integer),public.resolve_managed_auth_user(uuid) to service_role;
grant execute on function public.household_session_allowed(uuid),public.claim_google_principal() to authenticated;
-- Existing is_household_admin/permission/member EXECUTE grants are preserved.

-- Finalization is one transaction: no collaborator membership can temporarily
-- bypass managed-session checks while the registry is still unattached.
create function public.finalize_managed_staff_account(account_id uuid,auth_user_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare account record;
begin
 select * into account from public.managed_staff_accounts where id=account_id for update;
 if not found or auth_user_id is null then raise exception 'Managed account not found' using errcode='42501';end if;
 if not exists(select 1 from auth.users u where u.id=auth_user_id and lower(u.email)=account_id::text||'@staff.familyos.invalid' and u.raw_app_meta_data->>'familyos_managed'='true') then raise exception 'Managed identity does not match reservation' using errcode='42501';end if;
 if exists(select 1 from public.household_members m where m.user_id=auth_user_id and (m.household_id<>account.household_id or m.role<>'collaborator' or m.is_principal)) then raise exception 'Managed identity has an incompatible membership' using errcode='42501';end if;
 if account.status='active' and account.user_id=auth_user_id then return;end if;
 if account.status not in('provisioning','failed') or (account.user_id is not null and account.user_id<>auth_user_id) then raise exception 'Managed account operation conflicts' using errcode='PT409';end if;
 if not exists(select 1 from public.household_members m where m.household_id=account.household_id and m.user_id=account.created_by and m.active and m.role='admin') then raise exception 'Creating administrator no longer has access' using errcode='42501';end if;
 insert into public.household_members(household_id,user_id,display_name,role,is_principal,permissions) values(account.household_id,auth_user_id,account.display_name,'collaborator',false,account.permissions)
 on conflict(household_id,user_id) do nothing;
 update public.managed_staff_accounts set user_id=auth_user_id,status='active',sessions_valid_after=clock_timestamp() where id=account_id;
 insert into public.audit_events(household_id,actor_id,action,resource_id) select account.household_id,account.created_by,'staff.created',account_id::text where not exists(select 1 from public.audit_events where household_id=account.household_id and action='staff.created' and resource_id=account_id::text);
end; $$;

create function public.begin_managed_password_reset(account_id uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare account record; was_active boolean;
begin
 select * into account from public.managed_staff_accounts where id=account_id for update;
 if not found or account.user_id is null then raise exception 'Managed account not found' using errcode='42501';end if;
 select active into was_active from public.household_members where household_id=account.household_id and user_id=account.user_id and role='collaborator' and not is_principal for update;
 if not found then raise exception 'Only managed collaborators can be reset' using errcode='42501';end if;
 if account.status not in('active','failed') then raise exception 'Managed account operation conflicts' using errcode='PT409';end if;
 update public.managed_staff_accounts set status='resetting',sessions_valid_after=clock_timestamp() where id=account_id;
 -- status=resetting immediately blocks all RLS/RPC access, without changing the
 -- membership flag another administrator may be editing at the same time.
 return was_active;
end; $$;

create function public.finish_managed_password_reset(account_id uuid,actor_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare account record;
begin
 select * into account from public.managed_staff_accounts where id=account_id for update;
 if not found or account.user_id is null then raise exception 'Managed account not found' using errcode='42501';end if;
 if account.status<>'resetting' then raise exception 'Managed account operation conflicts' using errcode='PT409';end if;
 if not exists(select 1 from public.household_members where household_id=account.household_id and user_id=actor_id and active and role='admin') then raise exception 'Resetting administrator no longer has access' using errcode='42501';end if;
 if not exists(select 1 from public.household_members where household_id=account.household_id and user_id=account.user_id and role='collaborator' and not is_principal) then raise exception 'Only managed collaborators can be reset' using errcode='42501';end if;
 update public.managed_staff_accounts set status='active' where id=account_id;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(account.household_id,actor_id,'staff.password_reset',account_id::text);
 -- Do not restore a cached active flag: a concurrent deactivation must win.
end; $$;
revoke all on function public.finalize_managed_staff_account(uuid,uuid),public.begin_managed_password_reset(uuid),public.finish_managed_password_reset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finalize_managed_staff_account(uuid,uuid),public.begin_managed_password_reset(uuid),public.finish_managed_password_reset(uuid,uuid) to service_role;
