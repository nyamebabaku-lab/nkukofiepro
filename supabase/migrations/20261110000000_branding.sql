-- Branding: the platform name + logo (super admin) and each farm business's own logo (its owner).
-- Logos are small data URLs (the apps shrink uploads to 256px), so no file storage is needed.

alter table public.platform_settings add column if not exists app_name text not null default 'Nkukɔ Fie Pro';
alter table public.platform_settings add column if not exists app_logo text;
alter table public.businesses add column if not exists logo text;

update public.platform_settings set app_name = 'Nkukɔ Fie Pro' where id = 1 and (app_name is null or app_name in ('', 'PoultryPro', 'Poultry Pro'));

create or replace function public.set_platform_branding(new_name text, new_logo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Only the super admin can do this'; end if;
  if length(trim(coalesce(new_name, ''))) < 2 then raise exception 'Enter the app name'; end if;
  if length(coalesce(new_logo, '')) > 400000 then raise exception 'Logo is too large'; end if;
  if new_logo is not null and new_logo <> '' and new_logo !~ '^data:image/(png|jpeg|webp|svg\+xml);base64,' then raise exception 'Logo must be an image'; end if;
  update platform_settings set app_name = trim(new_name), app_logo = nullif(new_logo, ''), updated_at = now() where id = 1;
  perform audit(null, 'Branding changed', trim(new_name));
end;
$$;

-- Owners upload their farm business logo (shown in their staff app, customer shop and receipts).
create or replace function public.set_business_logo(new_logo text) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  select business_id into bid from profiles where user_id = auth.uid() and role = 'owner' and status = 'active';
  if bid is null then raise exception 'Only the farm owner can change the farm logo'; end if;
  if length(coalesce(new_logo, '')) > 400000 then raise exception 'Logo is too large'; end if;
  if new_logo is not null and new_logo <> '' and new_logo !~ '^data:image/(png|jpeg|webp);base64,' then raise exception 'Logo must be a PNG or JPG image'; end if;
  update businesses set logo = nullif(new_logo, '') where id = bid;
  perform audit(bid, 'Farm logo changed', null);
end;
$$;

-- Rename the test farm created before the rebrand (real farm names are never touched).
update public.businesses set name = 'Nkukɔ Fie Test Farm' where name = 'PoultryPro Test Farm';
