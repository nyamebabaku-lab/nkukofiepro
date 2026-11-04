-- PoultryPro platform: businesses, accounts with approval, and one generic records table
-- that holds every farm collection (farms, flocks, eggLogs, orders, …) per business.
-- All access is enforced here with row-level security; the apps only show what this allows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  demo_enabled boolean not null default true,
  -- While true, every new business/account is flagged as test data (cleared with clear_test_data()).
  test_mode boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict do nothing;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  phone text,
  owner_id uuid references auth.users on delete set null,
  farm_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'deactivated')),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text not null unique,
  role text not null check (role in ('super_admin', 'owner', 'manager', 'worker', 'customer')),
  business_id uuid references public.businesses on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'deactivated')),
  is_test boolean not null default false,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  note text
);
create index if not exists profiles_business on public.profiles (business_id);

create table if not exists public.records (
  business_id uuid not null references public.businesses on delete cascade,
  col text not null,
  id text not null,
  data jsonb not null,
  -- The customer a record belongs to (orders, payments, notifications, their customer card).
  owner_uid uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (business_id, col, id)
);
create index if not exists records_owner on public.records (business_id, owner_uid);

create table if not exists public.platform_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  business_id uuid,
  action text not null,
  detail text
);

-- ---------------------------------------------------------------- helpers
create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'super_admin' and status = 'active');
$$;

-- The caller's role in a business, only while both the account and the business are active.
create or replace function public.member_role(bid uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.role from profiles p join businesses b on b.id = p.business_id
  where p.user_id = auth.uid() and p.business_id = bid and p.status = 'active' and b.status = 'active';
$$;

create or replace function public.test_flag() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select test_mode from platform_settings where id = 1), false);
$$;

create or replace function public.audit(bid uuid, act text, det text) returns void
language sql security definer set search_path = public as $$
  insert into platform_audit (actor, business_id, action, detail) values (auth.uid(), bid, act, det);
$$;

create or replace function public.new_farm_code(biz_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  stem text := upper(left(regexp_replace(coalesce(biz_name, 'FARM'), '[^A-Za-z]', '', 'g'), 6));
  code text;
begin
  if length(stem) < 3 then stem := 'FARM'; end if;
  loop
    code := stem || '-' || (100 + floor(random() * 900))::int;
    exit when not exists (select 1 from businesses where farm_code = code);
  end loop;
  return code;
end;
$$;

-- Fill owner_uid from the record's customer so customers can be limited to their own rows.
create or replace function public.records_owner_uid() returns trigger
language plpgsql as $$
declare v text := coalesce(new.data ->> 'customerId', new.data ->> 'toCustomerId');
begin
  if new.col = 'customers' then v := new.id; end if;
  new.owner_uid := case when v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v::uuid else null end;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists records_owner_uid on public.records;
create trigger records_owner_uid before insert or update on public.records for each row execute function public.records_owner_uid();

-- ---------------------------------------------------------------- row-level security
alter table public.platform_settings enable row level security;
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.platform_audit enable row level security;

drop policy if exists "anyone reads platform settings" on public.platform_settings;
create policy "anyone reads platform settings" on public.platform_settings for select using (true);

drop policy if exists "see own or managed businesses" on public.businesses;
create policy "see own or managed businesses" on public.businesses for select using (
  is_super() or exists (select 1 from profiles p where p.user_id = auth.uid() and p.business_id = businesses.id)
);

drop policy if exists "see own, team or all profiles" on public.profiles;
create policy "see own, team or all profiles" on public.profiles for select using (
  user_id = auth.uid() or is_super() or member_role(business_id) in ('owner', 'manager')
);

drop policy if exists "super admin reads audit" on public.platform_audit;
create policy "super admin reads audit" on public.platform_audit for select using (
  is_super() or member_role(business_id) = 'owner'
);

-- Records: read
drop policy if exists "records read" on public.records;
create policy "records read" on public.records for select using (
  is_super()
  or member_role(business_id) = 'owner'
  or (member_role(business_id) in ('manager', 'worker') and col not in ('walletTx', 'payruns', 'advances'))
  or (member_role(business_id) = 'customer' and (col in ('products', 'farms', 'settings', 'shopStock') or owner_uid = auth.uid()))
);

-- Records: create
drop policy if exists "records insert" on public.records;
create policy "records insert" on public.records for insert with check (
  member_role(business_id) = 'owner'
  or (member_role(business_id) in ('manager', 'worker') and col not in ('payruns', 'advances', 'settings'))
  or (member_role(business_id) = 'customer' and (
    col in ('walletTx', 'notifications', 'audit', 'smsLog')
    or (col in ('orders', 'payments') and owner_uid = auth.uid())
  ))
);

-- Records: change
drop policy if exists "records update" on public.records;
create policy "records update" on public.records for update using (
  member_role(business_id) = 'owner'
  or (member_role(business_id) in ('manager', 'worker') and col not in ('payruns', 'advances', 'settings', 'walletTx'))
  or (member_role(business_id) = 'customer' and owner_uid = auth.uid() and col in ('notifications', 'customers'))
) with check (
  member_role(business_id) = 'owner'
  or (member_role(business_id) in ('manager', 'worker') and col not in ('payruns', 'advances', 'settings', 'walletTx'))
  or (member_role(business_id) = 'customer' and owner_uid = auth.uid() and col in ('notifications', 'customers'))
);

-- Records: delete (owner and managers only)
drop policy if exists "records delete" on public.records;
create policy "records delete" on public.records for delete using (
  member_role(business_id) = 'owner'
  or (member_role(business_id) = 'manager' and col not in ('payruns', 'advances', 'settings', 'walletTx'))
);

-- ---------------------------------------------------------------- account functions
-- First super admin only (works while none exists).
create or replace function public.claim_super_admin(full_name text, phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from profiles where role = 'super_admin') then raise exception 'A super admin already exists'; end if;
  insert into profiles (user_id, full_name, phone, role, status, decided_at)
  values (auth.uid(), full_name, phone, 'super_admin', 'active', now());
  perform audit(null, 'Super admin created', full_name);
end;
$$;

create or replace function public.super_admin_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where role = 'super_admin');
$$;

-- A new farm business and its owner; both wait for the super admin.
create or replace function public.register_business(biz_name text, biz_location text, biz_phone text, full_name text, phone text) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from profiles where user_id = auth.uid()) then raise exception 'This phone number already has an account'; end if;
  insert into businesses (name, location, phone, owner_id, farm_code, is_test)
  values (biz_name, biz_location, biz_phone, auth.uid(), new_farm_code(biz_name), test_flag()) returning id into bid;
  insert into profiles (user_id, full_name, phone, role, business_id, is_test)
  values (auth.uid(), full_name, phone, 'owner', bid, test_flag());
  perform audit(bid, 'Business registered', biz_name);
  return bid;
end;
$$;

-- Shown on the sign-up screen so people can check they typed the right code.
create or replace function public.business_by_code(code text) returns table (id uuid, name text, location text)
language sql stable security definer set search_path = public as $$
  select id, name, location from businesses where upper(farm_code) = upper(trim(code)) and status = 'active';
$$;

-- Customer / worker / manager joining a business with its farm code; waits for the owner.
create or replace function public.sign_up_member(code text, member_role text, full_name text, phone text) returns text
language plpgsql security definer set search_path = public as $$
declare b businesses;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if member_role not in ('customer', 'worker', 'manager') then raise exception 'Choose customer, worker or manager'; end if;
  if exists (select 1 from profiles where user_id = auth.uid()) then raise exception 'This phone number already has an account'; end if;
  select * into b from businesses where upper(farm_code) = upper(trim(code)) and status = 'active';
  if b.id is null then raise exception 'That farm code was not found. Ask the farm for its code.'; end if;
  insert into profiles (user_id, full_name, phone, role, business_id, is_test)
  values (auth.uid(), full_name, phone, member_role, b.id, test_flag() or b.is_test);
  perform audit(b.id, 'Account requested', full_name || ' (' || member_role || ')');
  return b.name;
end;
$$;

-- Creates the staff/customer card the farm app uses, the first time an account is approved.
create or replace function public.ensure_member_record(p profiles) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p.business_id is null or p.role = 'super_admin' then return; end if;
  if p.role = 'customer' then
    insert into records (business_id, col, id, data) values (p.business_id, 'customers', p.user_id::text,
      jsonb_build_object('id', p.user_id, 'name', p.full_name, 'phone', p.phone, 'type', 'retail', 'location', '', 'notes', '', 'createdAt', now()))
    on conflict (business_id, col, id) do nothing;
  else
    insert into records (business_id, col, id, data) values (p.business_id, 'users', p.user_id::text,
      jsonb_build_object('id', p.user_id, 'name', p.full_name, 'phone', p.phone, 'role', p.role,
        'position', case p.role when 'owner' then 'Owner' when 'manager' then 'Farm Manager' else 'Farm Worker' end,
        'farmIds', coalesce((select jsonb_agg(r.id) from records r where r.business_id = p.business_id and r.col = 'farms'), '[]'::jsonb),
        'salary', 0, 'status', 'active', 'startDate', to_char(now(), 'YYYY-MM-DD'), 'email', '',
        'momo', jsonb_build_object('network', 'mtn', 'number', p.phone), 'createdAt', now()))
    on conflict (business_id, col, id) do nothing;
  end if;
end;
$$;

-- Can the caller manage this account? Super admin: anyone. Owner: own customers/workers/managers.
create or replace function public.can_manage(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super() or exists (
    select 1 from profiles t where t.user_id = target and t.role in ('customer', 'worker', 'manager')
      and member_role(t.business_id) = 'owner'
  );
$$;

-- approve (pending → active), suspend, re-activate, deactivate
create or replace function public.set_account_status(target uuid, new_status text, reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if new_status not in ('pending', 'active', 'suspended', 'deactivated') then raise exception 'Unknown status'; end if;
  if target = auth.uid() then raise exception 'You cannot change your own account'; end if;
  if not can_manage(target) then raise exception 'Not allowed'; end if;
  update profiles set status = new_status, decided_at = now(), decided_by = auth.uid(), note = coalesce(reason, note)
  where user_id = target returning * into p;
  if new_status = 'active' then perform ensure_member_record(p); end if;
  update records set data = jsonb_set(data, '{status}', to_jsonb(case when new_status = 'active' then 'active' else 'inactive' end))
  where business_id = p.business_id and col = 'users' and id = target::text;
  perform audit(p.business_id, 'Account ' || new_status, p.full_name || coalesce(' — ' || reason, ''));
end;
$$;

create or replace function public.set_member_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if new_role not in ('customer', 'worker', 'manager') then raise exception 'Choose customer, worker or manager'; end if;
  if not can_manage(target) then raise exception 'Not allowed'; end if;
  update profiles set role = new_role where user_id = target returning * into p;
  update records set data = jsonb_set(data, '{role}', to_jsonb(new_role)) where business_id = p.business_id and col = 'users' and id = target::text;
  if p.status = 'active' then perform ensure_member_record(p); end if;
  perform audit(p.business_id, 'Role changed', p.full_name || ' → ' || new_role);
end;
$$;

-- Deletes the login completely. Their past orders stay in the farm's records.
create or replace function public.delete_account(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare p profiles;
begin
  if target = auth.uid() then raise exception 'You cannot delete your own account'; end if;
  if not can_manage(target) then raise exception 'Not allowed'; end if;
  select * into p from profiles where user_id = target;
  update records set data = jsonb_set(data, '{status}', '"deleted"') where business_id = p.business_id and col in ('users', 'customers') and id = target::text;
  delete from auth.users where id = target;
  perform audit(p.business_id, 'Account deleted', p.full_name);
end;
$$;

-- Super admin: business approval and status. Approving also activates its owner.
create or replace function public.set_business_status(bid uuid, new_status text, reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b businesses; o profiles;
begin
  if not is_super() then raise exception 'Only the super admin can do this'; end if;
  if new_status not in ('pending', 'active', 'suspended', 'deactivated') then raise exception 'Unknown status'; end if;
  update businesses set status = new_status, decided_at = now(), decided_by = auth.uid() where id = bid returning * into b;
  if new_status = 'active' then
    update profiles set status = 'active', decided_at = now(), decided_by = auth.uid()
    where user_id = b.owner_id and status = 'pending' returning * into o;
    if o.user_id is not null then perform ensure_member_record(o); end if;
  end if;
  perform audit(bid, 'Business ' || new_status, b.name || coalesce(' — ' || reason, ''));
end;
$$;

create or replace function public.set_business_test(bid uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Only the super admin can do this'; end if;
  update businesses set is_test = flag where id = bid;
  update profiles set is_test = flag where business_id = bid;
end;
$$;

create or replace function public.delete_business(bid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare b businesses;
begin
  if not is_super() then raise exception 'Only the super admin can do this'; end if;
  select * into b from businesses where id = bid;
  delete from auth.users where id in (select user_id from profiles where business_id = bid and role <> 'super_admin');
  delete from businesses where id = bid;
  perform audit(null, 'Business deleted', b.name);
end;
$$;

create or replace function public.regenerate_farm_code() returns text
language plpgsql security definer set search_path = public as $$
declare bid uuid; code text;
begin
  select business_id into bid from profiles where user_id = auth.uid() and role = 'owner' and status = 'active';
  if bid is null then raise exception 'Only the owner can change the farm code'; end if;
  code := new_farm_code((select name from businesses where id = bid));
  update businesses set farm_code = code where id = bid;
  perform audit(bid, 'Farm code changed', code);
  return code;
end;
$$;

-- Platform → Data: wipe everything flagged as test, keep real businesses.
create or replace function public.clear_test_data() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare nb int; nu int;
begin
  if not is_super() then raise exception 'Only the super admin can do this'; end if;
  select count(*) into nb from businesses where is_test;
  select count(*) into nu from profiles where is_test and role <> 'super_admin';
  delete from auth.users where id in (select user_id from profiles where is_test and role <> 'super_admin');
  delete from businesses where is_test;
  perform audit(null, 'Test data cleared', nb || ' businesses, ' || nu || ' accounts');
  return jsonb_build_object('businesses', nb, 'accounts', nu);
end;
$$;

create or replace function public.set_platform(demo boolean, testing boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Only the super admin can do this'; end if;
  update platform_settings set demo_enabled = coalesce(demo, demo_enabled), test_mode = coalesce(testing, test_mode), updated_at = now() where id = 1;
  perform audit(null, 'Platform settings', 'demo=' || coalesce(demo::text, '-') || ', test mode=' || coalesce(testing::text, '-'));
end;
$$;

-- Lock down: only these functions may be called from the apps.
revoke execute on function public.audit(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.ensure_member_record(profiles) from public, anon, authenticated;
revoke execute on function public.new_farm_code(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- realtime
do $$
begin
  begin alter publication supabase_realtime add table public.records; exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when others then null; end;
  begin alter publication supabase_realtime add table public.businesses; exception when others then null; end;
  begin alter publication supabase_realtime add table public.platform_settings; exception when others then null; end;
end $$;
alter table public.records replica identity full;
