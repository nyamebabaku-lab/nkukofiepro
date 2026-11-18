-- Product photos in file storage so every phone and customer sees them (they used to stay on the phone that took them).
-- Path: photos/<business id>/<key>.jpg. Anyone can view; owners and managers of that business can upload, replace or remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.photo_business(object_name text) returns uuid
language sql immutable as $$
  select case when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', 1)::uuid end;
$$;

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select using (bucket_id = 'photos');

drop policy if exists "photos add" on storage.objects;
create policy "photos add" on storage.objects for insert to authenticated with check (
  bucket_id = 'photos' and public.member_role(public.photo_business(name)) in ('owner', 'manager')
);

drop policy if exists "photos change" on storage.objects;
create policy "photos change" on storage.objects for update to authenticated using (
  bucket_id = 'photos' and public.member_role(public.photo_business(name)) in ('owner', 'manager')
) with check (
  bucket_id = 'photos' and public.member_role(public.photo_business(name)) in ('owner', 'manager')
);

drop policy if exists "photos remove" on storage.objects;
create policy "photos remove" on storage.objects for delete to authenticated using (
  bucket_id = 'photos' and public.member_role(public.photo_business(name)) in ('owner', 'manager')
);
