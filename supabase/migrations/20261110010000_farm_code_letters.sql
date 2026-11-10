-- Farm codes: read Ghanaian letters (ɔ ɛ) as o / e so "Nkukɔ Fie" gives NKUKOF-123, not NKUKFI-123.
create or replace function public.new_farm_code(biz_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  stem text := upper(left(regexp_replace(translate(coalesce(biz_name, 'FARM'), 'ɔƆɛƐ', 'oOeE'), '[^A-Za-z]', '', 'g'), 6));
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

-- The test farm still had a code made from its old name.
update businesses set farm_code = new_farm_code(name) where farm_code like 'POULTR-%';
