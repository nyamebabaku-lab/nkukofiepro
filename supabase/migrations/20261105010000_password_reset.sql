-- Password resets without SMS: people ask for a reset, their farm owner (or the super admin for owners)
-- sets a temporary password, and the app makes them choose a new one at the next sign-in.

alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists reset_requested_at timestamptz;

-- "Forgot password?" on the sign-in screen. Always answers the same way, so it can't be used
-- to find out which phone numbers have accounts; repeated requests within 10 minutes are ignored.
create or replace function public.request_password_reset(phone text) returns void
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  update profiles set reset_requested_at = now()
  where profiles.phone = request_password_reset.phone
    and (reset_requested_at is null or reset_requested_at < now() - interval '10 minutes')
  returning * into p;
  if p.user_id is not null then perform audit(p.business_id, 'Password reset requested', p.full_name); end if;
end;
$$;

-- Owner (for their customers, workers, managers) or super admin (anyone) sets a temporary password.
-- The person is signed out everywhere and must choose a new password when they next sign in.
create or replace function public.admin_reset_password(target uuid, temp_password text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare p profiles;
begin
  if target = auth.uid() then raise exception 'Use "Change password" for your own account'; end if;
  if not can_manage(target) then raise exception 'Not allowed'; end if;
  if length(coalesce(temp_password, '')) < 6 then raise exception 'Temporary password must be at least 6 characters'; end if;
  update auth.users set encrypted_password = extensions.crypt(temp_password, extensions.gen_salt('bf')), updated_at = now() where id = target;
  delete from auth.refresh_tokens where user_id::text = target::text;
  delete from auth.sessions where user_id = target;
  update profiles set must_change_password = true, reset_requested_at = null where user_id = target returning * into p;
  perform audit(p.business_id, 'Password reset', p.full_name);
end;
$$;

-- Called by the app after someone has chosen their new password.
create or replace function public.password_changed() returns void
language sql security definer set search_path = public as $$
  update profiles set must_change_password = false, reset_requested_at = null where user_id = auth.uid();
$$;

-- Owners may reset their own team; the super admin may also reset owners.
create or replace function public.can_manage(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super() or exists (
    select 1 from profiles t where t.user_id = target and t.role in ('customer', 'worker', 'manager')
      and member_role(t.business_id) = 'owner'
  );
$$;
