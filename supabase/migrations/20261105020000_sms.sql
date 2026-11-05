-- SMS sent through mNotify by the send-sms Edge Function (written with the service role).
create table if not exists public.sms_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  business_id uuid references public.businesses on delete cascade,
  sent_by uuid,
  to_phone text not null,
  message text not null,
  status text not null check (status in ('sent', 'failed')),
  error text
);
create index if not exists sms_log_business_at on public.sms_log (business_id, at desc);

alter table public.sms_log enable row level security;

-- Owners see their farm's SMS; the super admin sees all. Only the Edge Function writes.
drop policy if exists "owners and super admin read sms" on public.sms_log;
create policy "owners and super admin read sms" on public.sms_log for select using (
  is_super() or member_role(business_id) = 'owner'
);
