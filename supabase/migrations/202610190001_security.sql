-- Run as the migration owner. No application credentials are embedded here.
revoke create on schema public from public;
create table public.households(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.household_members(
 household_id uuid not null references public.households(id),user_id uuid not null references auth.users(id),display_name text not null,
 role text not null check(role in ('admin','collaborator')),active boolean not null default true,is_principal boolean not null default false,
 permissions text[] not null default '{}',primary key(household_id,user_id),
 check(not is_principal or role='admin'),check(permissions <@ array['kitchen.read','kitchen.confirm','tasks.read','tasks.update','assets.read','assets.write','inventory.read','inventory.write']::text[])
);
create table public.family_people(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households(id),name text not null,kind text not null check(kind in('adult','child')),user_id uuid references auth.users(id),unique(household_id,name),check(kind<>'child' or user_id is null));
create table public.household_state(household_id uuid primary key references public.households(id),data jsonb not null default '{}',revision bigint not null default 0,updated_at timestamptz not null default now());
create table public.household_invitations(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households(id),email text not null,display_name text not null,permissions text[] not null default '{}',invited_by uuid not null references auth.users(id),expires_at timestamptz not null default(now()+interval '7 days'),accepted_by uuid references auth.users(id),accepted_at timestamptz,revoked_at timestamptz,delivery_status text not null default 'pending' check(delivery_status in('pending','sent','failed')),unique(household_id,email),check(permissions <@ array['kitchen.read','kitchen.confirm','tasks.read','tasks.update','assets.read','assets.write','inventory.read','inventory.write']::text[]));
create table public.audit_events(id bigint generated always as identity primary key,household_id uuid not null references public.households(id),actor_id uuid references auth.users(id),action text not null,resource_id text,created_at timestamptz not null default now());
create table public.recipes(id text primary key,name text not null,meal text not null,ingredients jsonb not null,instructions jsonb not null);
create table public.recipe_nutrition(recipe_id text primary key references public.recipes(id),macros jsonb not null,source text not null default 'demo_unverified');
create table public.person_access(household_id uuid not null references public.households(id),person_id uuid not null references public.family_people(id),user_id uuid not null references auth.users(id),can_read_medical boolean not null default false,primary key(person_id,user_id));
create table public.medical_records(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households(id),person_id uuid not null references public.family_people(id),payload jsonb not null,created_at timestamptz not null default now());
-- There is intentionally no UI or client write access for medical records/grants.
create function public.is_household_admin(hid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.household_members where household_id=hid and user_id=auth.uid() and active and role='admin'); $$;
create function public.has_household_permission(hid uuid,permission text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.household_members where household_id=hid and user_id=auth.uid() and active and (role='admin' or permission=any(permissions))); $$;
create function public.is_household_member(hid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.household_members where household_id=hid and user_id=auth.uid() and active); $$;
create function public.can_read_medical(hid uuid,pid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select public.is_household_member(hid) and exists(select 1 from public.person_access a join public.family_people p on p.id=a.person_id where a.household_id=hid and p.household_id=hid and a.person_id=pid and a.user_id=auth.uid() and a.can_read_medical); $$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.family_people enable row level security;
alter table public.household_state enable row level security;
alter table public.household_invitations enable row level security;
alter table public.audit_events enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_nutrition enable row level security;
alter table public.person_access enable row level security;
alter table public.medical_records enable row level security;
create policy household_read on public.households for select to authenticated using(public.is_household_member(id));
create policy member_read on public.household_members for select to authenticated using(user_id=auth.uid() or public.is_household_admin(household_id));
create policy people_admin on public.family_people for select to authenticated using(public.is_household_admin(household_id));
create policy state_admin on public.household_state for select to authenticated using(public.is_household_admin(household_id));
create policy invitations_admin on public.household_invitations for select to authenticated using(public.is_household_admin(household_id));
create policy audit_admin on public.audit_events for select to authenticated using(public.is_household_admin(household_id));
create policy recipes_read on public.recipes for select to authenticated using(exists(select 1 from public.household_members where user_id=auth.uid() and active and (role='admin' or 'kitchen.read'=any(permissions))));
create policy nutrition_admin on public.recipe_nutrition for select to authenticated using(exists(select 1 from public.household_members where user_id=auth.uid() and active and role='admin'));
create policy grants_own on public.person_access for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
create policy medical_private on public.medical_records for select to authenticated using(public.can_read_medical(household_id,person_id));
-- All mutations go through narrowly scoped, authorizing RPCs. No write grants.
revoke all on public.households,public.household_members,public.family_people,public.household_state,public.household_invitations,public.audit_events,public.recipes,public.recipe_nutrition,public.person_access,public.medical_records from anon,authenticated;
grant select on public.households,public.household_members,public.family_people,public.household_state,public.household_invitations,public.audit_events,public.recipes,public.recipe_nutrition,public.person_access,public.medical_records to authenticated;

create function public.save_household_state(hid uuid,expected_revision bigint,new_data jsonb) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare rev bigint;
begin
 if not public.is_household_admin(hid) then raise exception 'Forbidden' using errcode='42501'; end if;
 if jsonb_typeof(new_data)<>'object' or pg_column_size(new_data)>5000000 then raise exception 'Invalid state'; end if;
 update public.household_state set data=new_data,revision=revision+1,updated_at=now() where household_id=hid and revision=expected_revision returning revision into rev;
 if rev is null then raise exception 'State conflict' using errcode='40001'; end if;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'state.updated',rev::text);
 return rev;
end; $$;

create function public.reserve_household_invitation(hid uuid,invite_email text,invite_name text,invite_permissions text[]) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare iid uuid;
begin
 if not public.is_household_admin(hid) then raise exception 'Forbidden' using errcode='42501'; end if;
 if invite_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(invite_name)<1 then raise exception 'Invalid invitation'; end if;
 if exists(select 1 from public.household_members m join auth.users u on u.id=m.user_id where m.household_id=hid and lower(u.email)=lower(trim(invite_email))) then raise exception 'User already belongs to household';end if;
 insert into public.household_invitations(household_id,email,display_name,permissions,invited_by) values(hid,lower(trim(invite_email)),invite_name,invite_permissions,auth.uid())
 on conflict(household_id,email) do update set display_name=excluded.display_name,permissions=excluded.permissions,expires_at=now()+interval '7 days',revoked_at=null,delivery_status='pending' where public.household_invitations.accepted_at is null returning id into iid;
 if iid is null then raise exception 'Invitation already accepted'; end if;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'invitation.created',iid::text);return iid;
end; $$;
create function public.accept_my_invitations() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare address text; invite record; total integer:=0;
begin
 select lower(email) into address from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if address is null then return 0;end if;
 for invite in select * from public.household_invitations where email=address and accepted_at is null and revoked_at is null and expires_at>now() for update loop
  insert into public.household_members(household_id,user_id,display_name,role,permissions) values(invite.household_id,auth.uid(),invite.display_name,'collaborator',invite.permissions) on conflict do nothing;
  update public.household_invitations set accepted_at=now(),accepted_by=auth.uid() where id=invite.id;
  insert into public.audit_events(household_id,actor_id,action,resource_id) values(invite.household_id,auth.uid(),'invitation.accepted',invite.id::text);total:=total+1;
 end loop;return total;
end; $$;
create function public.manage_household_member(hid uuid,member_id uuid,new_active boolean,new_permissions text[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_household_admin(hid) then raise exception 'Forbidden' using errcode='42501';end if;
 update public.household_members set active=new_active,permissions=new_permissions where household_id=hid and user_id=member_id and not is_principal and role='collaborator';
 if not found then raise exception 'Principal administrators cannot be changed here';end if;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'member.updated',member_id::text);
end; $$;
create function public.revoke_household_invitation(hid uuid,invitation_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_household_admin(hid) then raise exception 'Forbidden' using errcode='42501';end if;
 update public.household_invitations set revoked_at=now() where household_id=hid and id=invitation_id and accepted_at is null;
 insert into public.audit_events(household_id,actor_id,action,resource_id) values(hid,auth.uid(),'invitation.revoked',invitation_id::text);
end; $$;

-- Bootstrap is available only from the SQL editor/service role, never to clients.
create function public.bootstrap_household(juan_email text,pamela_email text,household_name text default 'Nuestro hogar') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare juan uuid;pamela uuid;hid uuid;
begin
 select id into juan from auth.users where lower(email)=lower(juan_email);select id into pamela from auth.users where lower(email)=lower(pamela_email);
 if juan is null or pamela is null or juan=pamela then raise exception 'Create two distinct invited Auth users first';end if;
 if exists(select 1 from public.household_members where user_id in(juan,pamela) and is_principal) then raise exception 'Principal users already configured';end if;
 insert into public.households(name) values(household_name) returning id into hid;
 insert into public.household_members(household_id,user_id,display_name,role,is_principal) values(hid,juan,'Juan','admin',true),(hid,pamela,'Pamela','admin',true);
 insert into public.family_people(household_id,name,kind,user_id) values(hid,'Juan','adult',juan),(hid,'Pamela','adult',pamela),(hid,'Manuela','child',null),(hid,'Juan de Dios','child',null);
 insert into public.household_state(household_id) values(hid);return hid;
end; $$;
-- Explicitly revoke the PostgreSQL default PUBLIC execute privilege.
revoke all on function public.is_household_admin(uuid),public.has_household_permission(uuid,text),public.is_household_member(uuid),public.can_read_medical(uuid,uuid),public.save_household_state(uuid,bigint,jsonb),public.reserve_household_invitation(uuid,text,text,text[]),public.accept_my_invitations(),public.manage_household_member(uuid,uuid,boolean,text[]),public.revoke_household_invitation(uuid,uuid),public.bootstrap_household(text,text,text) from public,anon,authenticated;
grant execute on function public.is_household_admin(uuid),public.has_household_permission(uuid,text),public.is_household_member(uuid),public.can_read_medical(uuid,uuid),public.save_household_state(uuid,bigint,jsonb),public.reserve_household_invitation(uuid,text,text,text[]),public.accept_my_invitations(),public.manage_household_member(uuid,uuid,boolean,text[]),public.revoke_household_invitation(uuid,uuid) to authenticated;
grant execute on function public.bootstrap_household(text,text,text) to service_role;
grant update(delivery_status) on public.household_invitations to service_role;
grant select on public.household_invitations to service_role;
