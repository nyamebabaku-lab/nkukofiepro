-- Server reminders: urgent-task / vaccination SMS and the owner's daily summaries.
-- The Edge Function farm-reminders is called every 15 minutes by pg_cron.
create table if not exists public.reminder_log (
  business_id uuid not null references public.businesses on delete cascade,
  day date not null,
  key text not null,
  sms boolean not null default false,
  at timestamptz not null default now(),
  primary key (business_id, day, key)
);
alter table public.reminder_log enable row level security;
drop policy if exists "owners read reminder log" on public.reminder_log;
create policy "owners read reminder log" on public.reminder_log for select using (is_super() or member_role(business_id) = 'owner');

-- Private settings for scheduled jobs (not exposed through the API).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (name text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;
-- Set once (not stored in git):
--   insert into private.settings values ('cron_secret', '<same value as the CRON_SECRET function secret>')
--     on conflict (name) do update set value = excluded.value;

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule('farm-reminders') where exists (select 1 from cron.job where jobname = 'farm-reminders');
select cron.schedule('farm-reminders', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://tzslrrptbmhdlhxbfujq.supabase.co/functions/v1/farm-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from private.settings where name = 'cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
