-- Paystack payments (split straight to each farm), the marketplace (listings, bulk requests and offers,
-- marketplace orders, verified buyers), and the AI vet with the disease watch (outbreak signals that the
-- super admin reviews before anything is sent).

-- ================================================================ settings & business fields
alter table public.platform_settings add column if not exists fee_pct numeric not null default 0 check (fee_pct >= 0 and fee_pct <= 10);
alter table public.platform_settings add column if not exists payments_live boolean not null default false;
alter table public.platform_settings add column if not exists ai_enabled boolean not null default true;
alter table public.platform_settings add column if not exists ai_free_monthly int not null default 10;
alter table public.platform_settings add column if not exists ai_premium_monthly int not null default 200;
alter table public.platform_settings add column if not exists ai_model text not null default 'claude-opus-5-5';

alter table public.businesses add column if not exists region text;
alter table public.businesses add column if not exists district text;
alter table public.businesses add column if not exists premium boolean not null default false;
alter table public.businesses add column if not exists market_enabled boolean not null default true;
-- Payout account (shown to the owner) and the Paystack subaccount the money settles to.
alter table public.businesses add column if not exists payout jsonb;
alter table public.businesses add column if not exists paystack_subaccount text;

-- Owners set their region/district (used by the marketplace and the disease watch).
create or replace function public.set_business_area(new_region text, new_district text, new_location text default null) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid := (select business_id from profiles where user_id = auth.uid() and role = 'owner' and status = 'active');
begin
  if bid is null then raise exception 'Only the farm owner can change this'; end if;
  update businesses set region = nullif(trim(new_region), ''), district = nullif(trim(new_district), ''),
    location = coalesce(nullif(trim(new_location), ''), location) where id = bid;
end; $$;

create or replace function public.set_platform_money(fee numeric, live boolean, ai_on boolean, ai_free int, ai_premium int, model text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Super admin only'; end if;
  update platform_settings set fee_pct = coalesce(fee, fee_pct), payments_live = coalesce(live, payments_live),
    ai_enabled = coalesce(ai_on, ai_enabled), ai_free_monthly = coalesce(ai_free, ai_free_monthly),
    ai_premium_monthly = coalesce(ai_premium, ai_premium_monthly), ai_model = coalesce(nullif(trim(model), ''), ai_model), updated_at = now() where id = 1;
  perform audit(null, 'platform_money', format('fee %s%%, live %s, ai %s (%s/%s)', fee, live, ai_on, ai_free, ai_premium));
end; $$;

create or replace function public.set_business_premium(bid uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Super admin only'; end if;
  update businesses set premium = flag where id = bid;
  perform audit(bid, 'premium', flag::text);
end; $$;

-- ================================================================ payments log
create table if not exists public.paystack_tx (
  reference text primary key,
  business_id uuid references public.businesses on delete set null,
  user_id uuid,
  purpose text not null,                -- order | market_order | debt | other
  purpose_id text,
  amount numeric not null,              -- GH₵
  platform_fee numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned')),
  channel text,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists paystack_tx_business on public.paystack_tx (business_id, created_at desc);
alter table public.paystack_tx enable row level security;
drop policy if exists "tx read" on public.paystack_tx;
create policy "tx read" on public.paystack_tx for select using (is_super() or user_id = auth.uid() or member_role(business_id) = 'owner');

-- ================================================================ marketplace
create table if not exists public.market_buyers (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text not null,
  buyer_type text not null check (buyer_type in ('household', 'trader', 'bulk', 'government')),
  org_name text,
  region text,
  district text,
  -- Households can buy at once. Traders (wholesale prices), bulk and government buyers (post requests) need approval.
  verified boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
alter table public.market_buyers enable row level security;
drop policy if exists "buyer read" on public.market_buyers;
create policy "buyer read" on public.market_buyers for select using (user_id = auth.uid() or is_super());

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  title text not null,
  category text not null default 'eggs',
  product_id text,
  unit text not null default 'crate',
  price numeric not null check (price >= 0),
  wholesale_price numeric,
  min_wholesale_qty numeric,
  qty numeric not null default 0,
  available_from date not null default current_date,
  available_to date,
  note text,
  photo text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_listings_open on public.market_listings (status, available_from);
alter table public.market_listings enable row level security;
drop policy if exists "listing read" on public.market_listings;
create policy "listing read" on public.market_listings for select using (
  member_role(business_id) is not null or is_super()
  or (status = 'open' and exists (select 1 from businesses b where b.id = business_id and b.status = 'active' and b.market_enabled))
);
drop policy if exists "listing write" on public.market_listings;
create policy "listing write" on public.market_listings for all using (member_role(business_id) in ('owner', 'manager')) with check (member_role(business_id) in ('owner', 'manager'));

create table if not exists public.market_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  category text not null,
  qty numeric not null check (qty > 0),
  unit text not null,
  target_weight_kg numeric,
  needed_by date not null,
  region text,
  district text,
  location text,
  budget_per_unit numeric,
  delivery boolean not null default false,
  note text,
  status text not null default 'open' check (status in ('open', 'awarded', 'closed', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists market_requests_open on public.market_requests (status, needed_by);
alter table public.market_requests enable row level security;

create or replace function public.is_verified_buyer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from market_buyers where user_id = auth.uid() and verified and status = 'active' and buyer_type in ('trader', 'bulk', 'government'));
$$;
-- Farm members of any active business on the marketplace see open requests (contact details stay hidden until an offer is accepted).
create or replace function public.is_farm_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p join businesses b on b.id = p.business_id where p.user_id = auth.uid() and p.status = 'active' and b.status = 'active' and p.role in ('owner', 'manager'));
$$;

drop policy if exists "request read" on public.market_requests;
create policy "request read" on public.market_requests for select using (buyer_id = auth.uid() or is_super() or (status = 'open' and is_farm_member()));
drop policy if exists "request add" on public.market_requests;
create policy "request add" on public.market_requests for insert with check (buyer_id = auth.uid() and is_verified_buyer());
drop policy if exists "request change" on public.market_requests;
create policy "request change" on public.market_requests for update using (buyer_id = auth.uid() or is_super()) with check (buyer_id = auth.uid() or is_super());

create table if not exists public.market_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.market_requests on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  price_per_unit numeric not null check (price_per_unit >= 0),
  qty numeric not null check (qty > 0),
  ready_date date not null,
  avg_weight_kg numeric,
  flock_code text,
  note text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists market_offers_request on public.market_offers (request_id);
alter table public.market_offers enable row level security;
drop policy if exists "offer read" on public.market_offers;
create policy "offer read" on public.market_offers for select using (
  member_role(business_id) is not null or is_super()
  or exists (select 1 from market_requests r where r.id = request_id and r.buyer_id = auth.uid())
);
drop policy if exists "offer add" on public.market_offers;
create policy "offer add" on public.market_offers for insert with check (
  member_role(business_id) in ('owner', 'manager') and exists (select 1 from market_requests r where r.id = request_id and r.status = 'open')
);
drop policy if exists "offer change" on public.market_offers;
create policy "offer change" on public.market_offers for update using (member_role(business_id) in ('owner', 'manager')) with check (member_role(business_id) in ('owner', 'manager'));

create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null default ('MK' || upper(substr(md5(random()::text), 1, 6))),
  business_id uuid not null references public.businesses on delete cascade,
  buyer_id uuid not null default auth.uid() references auth.users on delete cascade,
  buyer_name text,
  buyer_phone text,
  listing_id uuid references public.market_listings on delete set null,
  offer_id uuid references public.market_offers on delete set null,
  title text not null,
  qty numeric not null check (qty > 0),
  unit text not null,
  unit_price numeric not null,
  total numeric not null,
  deposit_paid numeric not null default 0,
  paystack_ref text,
  pickup_date date,
  delivery boolean not null default false,
  address text,
  note text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'ready', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_orders_business on public.market_orders (business_id, created_at desc);
create index if not exists market_orders_buyer on public.market_orders (buyer_id, created_at desc);
alter table public.market_orders enable row level security;
drop policy if exists "morder read" on public.market_orders;
create policy "morder read" on public.market_orders for select using (buyer_id = auth.uid() or member_role(business_id) is not null or is_super());
drop policy if exists "morder change" on public.market_orders;
create policy "morder change" on public.market_orders for update using (member_role(business_id) in ('owner', 'manager') or buyer_id = auth.uid()) with check (member_role(business_id) in ('owner', 'manager') or buyer_id = auth.uid());

-- Public list of farms on the marketplace (no owner or phone details beyond the farm's own business phone).
create or replace function public.market_farms() returns table (id uuid, name text, logo text, location text, region text, district text, phone text, listings bigint)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.logo, b.location, b.region, b.district, b.phone,
    (select count(*) from market_listings l where l.business_id = b.id and l.status = 'open')
  from businesses b where b.status = 'active' and b.market_enabled and not b.is_test
  order by 8 desc, b.name;
$$;

-- Becomes a marketplace buyer (any signed-in account, or a new marketplace-only account).
create or replace function public.become_buyer(full_name text, phone text, kind text, org text default null, reg text default null, dist text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if kind not in ('household', 'trader', 'bulk', 'government') then raise exception 'Choose a buyer type'; end if;
  insert into market_buyers (user_id, full_name, phone, buyer_type, org_name, region, district, verified)
  values (auth.uid(), trim(full_name), phone, kind, nullif(trim(org), ''), reg, dist, kind = 'household')
  on conflict (user_id) do update set full_name = excluded.full_name, org_name = excluded.org_name, region = excluded.region, district = excluded.district,
    -- changing type re-opens approval (except households)
    verified = case when market_buyers.buyer_type = excluded.buyer_type then market_buyers.verified else excluded.buyer_type = 'household' end,
    buyer_type = excluded.buyer_type;
  -- marketplace-only accounts get a customer profile without a farm
  insert into profiles (user_id, full_name, phone, role, business_id, status, is_test)
  values (auth.uid(), trim(full_name), phone, 'customer', null, 'active', test_flag())
  on conflict (user_id) do nothing;
end; $$;

create or replace function public.verify_buyer(target uuid, ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Super admin only'; end if;
  update market_buyers set verified = ok, verified_at = case when ok then now() end where user_id = target;
  perform audit(null, 'verify_buyer', format('%s %s', target, ok));
end; $$;

-- Buyer accepts a farm's offer: the offer is accepted, the request awarded, and a marketplace order created.
create or replace function public.accept_offer(offer uuid, pickup date default null, want_delivery boolean default false, addr text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare o market_offers; r market_requests; b market_buyers; oid uuid;
begin
  select * into o from market_offers where id = offer;
  select * into r from market_requests where id = o.request_id;
  if r.buyer_id is distinct from auth.uid() then raise exception 'Not your request'; end if;
  if o.status <> 'sent' then raise exception 'This offer is no longer open'; end if;
  select * into b from market_buyers where user_id = auth.uid();
  update market_offers set status = 'accepted' where id = offer;
  update market_requests set status = 'awarded' where id = r.id;
  insert into market_orders (business_id, buyer_id, buyer_name, buyer_phone, offer_id, title, qty, unit, unit_price, total, pickup_date, delivery, address, note)
  values (o.business_id, auth.uid(), coalesce(b.org_name, b.full_name), b.phone, o.id, r.title, o.qty, r.unit, o.price_per_unit, o.qty * o.price_per_unit,
    coalesce(pickup, o.ready_date), want_delivery, addr, r.note)
  returning id into oid;
  return oid;
end; $$;

-- Buyer orders from a listing (wholesale price for verified traders/bulk/government above the minimum quantity).
create or replace function public.order_listing(listing uuid, quantity numeric, pickup date, want_delivery boolean default false, addr text default null, msg text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare l market_listings; b market_buyers; p profiles; price numeric; oid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into l from market_listings where id = listing and status = 'open';
  if l.id is null then raise exception 'This listing is closed'; end if;
  if quantity <= 0 then raise exception 'Enter a quantity'; end if;
  if l.qty > 0 and quantity > l.qty then raise exception 'Only % % available', l.qty, l.unit; end if;
  select * into b from market_buyers where user_id = auth.uid();
  select * into p from profiles where user_id = auth.uid();
  price := case when b.verified and b.buyer_type <> 'household' and l.wholesale_price is not null and quantity >= coalesce(l.min_wholesale_qty, 0) then l.wholesale_price else l.price end;
  insert into market_orders (business_id, buyer_id, buyer_name, buyer_phone, listing_id, title, qty, unit, unit_price, total, pickup_date, delivery, address, note)
  values (l.business_id, auth.uid(), coalesce(b.org_name, b.full_name, p.full_name), coalesce(b.phone, p.phone), l.id, l.title, quantity, l.unit, price, quantity * price, pickup, want_delivery, addr, msg)
  returning id into oid;
  if l.qty > 0 then update market_listings set qty = qty - quantity, status = case when qty - quantity <= 0 then 'closed' else status end, updated_at = now() where id = l.id; end if;
  return oid;
end; $$;

-- ================================================================ AI vet & disease watch
create table if not exists public.ai_usage (
  business_id uuid not null references public.businesses on delete cascade,
  month text not null,
  used int not null default 0,
  primary key (business_id, month)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai usage read" on public.ai_usage;
create policy "ai usage read" on public.ai_usage for select using (member_role(business_id) is not null or is_super());

create table if not exists public.outbreak_signals (
  id uuid primary key default gen_random_uuid(),
  region text,
  district text,
  detected_on date not null default current_date,
  farms int not null default 1,
  birds_dead int not null default 0,
  rate_pct numeric,
  species text,
  suspected text,
  details jsonb,
  status text not null default 'new' check (status in ('new', 'sent', 'dismissed')),
  message text,
  reviewed_by uuid,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (district, detected_on)
);
alter table public.outbreak_signals enable row level security;
drop policy if exists "signal read" on public.outbreak_signals;
create policy "signal read" on public.outbreak_signals for select using (is_super());

-- Read-only links for vets and authorities (created by the super admin); they see only alerts that were sent.
create table if not exists public.outbreak_partners (
  token uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.outbreak_partners enable row level security;
drop policy if exists "partner read" on public.outbreak_partners;
create policy "partner read" on public.outbreak_partners for all using (is_super()) with check (is_super());

create or replace function public.outbreak_feed(t uuid) returns table (region text, district text, detected_on date, farms int, birds_dead int, rate_pct numeric, species text, suspected text, message text, sent_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.region, s.district, s.detected_on, s.farms, s.birds_dead, s.rate_pct, s.species, s.suspected, s.message, s.sent_at
  from outbreak_signals s where s.status = 'sent' and exists (select 1 from outbreak_partners p where p.token = t and p.active)
  order by s.detected_on desc limit 200;
$$;
grant execute on function public.outbreak_feed(uuid) to anon, authenticated;

-- Daily scan: deaths over the last 3 days against each farm's own 14-day baseline, grouped by district.
create or replace function public.detect_outbreaks() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  with deaths as (
    select r.business_id, (r.data ->> 'date')::date as d, coalesce((r.data ->> 'dead')::numeric, 0) as dead
    from records r join businesses b on b.id = r.business_id
    where r.col = 'mortality' and b.status = 'active' and not b.is_test and (r.data ->> 'date') >= to_char(current_date - 17, 'YYYY-MM-DD')
  ), per_farm as (
    select business_id,
      sum(dead) filter (where d > current_date - 3) as recent,
      sum(dead) filter (where d <= current_date - 3) / 14.0 as base_per_day
    from deaths group by business_id
  ), live as (
    select r.business_id, sum(coalesce((r.data ->> 'opening')::numeric, (r.data ->> 'placed')::numeric, 0)) as birds
    from records r where r.col = 'flocks' and r.data ->> 'status' = 'active' group by r.business_id
  ), spikes as (
    select b.region, coalesce(nullif(b.district, ''), nullif(b.location, ''), 'Unknown') as district, p.business_id, p.recent, coalesce(l.birds, 0) as birds
    from per_farm p join businesses b on b.id = p.business_id left join live l on l.business_id = p.business_id
    where p.recent >= 20 and p.recent >= greatest(3 * 3 * coalesce(p.base_per_day, 0), 1)
  ), vet as (
    select coalesce(nullif(b.district, ''), nullif(b.location, ''), 'Unknown') as district, string_agg(distinct r.data ->> 'top', ', ') as suspected
    from records r join businesses b on b.id = r.business_id
    where r.col = 'vetCases' and (r.data ->> 'at') >= to_char(current_date - 7, 'YYYY-MM-DD') and (r.data ->> 'serious')::boolean
    group by 1
  ), grouped as (
    select s.district, max(s.region) as region, count(*)::int as farms, sum(s.recent)::int as dead,
      round(100.0 * sum(s.recent) / nullif(sum(s.birds), 0), 2) as rate, jsonb_agg(jsonb_build_object('business', s.business_id, 'dead', s.recent)) as details
    from spikes s group by s.district
  )
  insert into outbreak_signals (region, district, farms, birds_dead, rate_pct, suspected, details)
  select g.region, g.district, g.farms, g.dead, g.rate, v.suspected, g.details from grouped g left join vet v on v.district = g.district
  on conflict (district, detected_on) do update set farms = excluded.farms, birds_dead = excluded.birds_dead, rate_pct = excluded.rate_pct, suspected = excluded.suspected, details = excluded.details
    where outbreak_signals.status = 'new';
  get diagnostics n = row_count;
  return n;
end; $$;

-- Super admin sends a reviewed alert: every farm in that district gets a notification (no farm names shown).
create or replace function public.send_outbreak_alert(signal uuid, msg text) returns int
language plpgsql security definer set search_path = public as $$
declare s outbreak_signals; n int := 0; nid text;
begin
  if not is_super() then raise exception 'Super admin only'; end if;
  select * into s from outbreak_signals where id = signal;
  if s.id is null then raise exception 'Alert not found'; end if;
  update outbreak_signals set status = 'sent', message = msg, reviewed_by = auth.uid(), sent_at = now() where id = signal;
  for nid in select b.id::text from businesses b where b.status = 'active'
    and coalesce(nullif(b.district, ''), nullif(b.location, ''), 'Unknown') = s.district loop
    insert into records (business_id, col, id, data) values (nid::uuid, 'notifications', 'ntf_ob_' || substr(signal::text, 1, 8),
      jsonb_build_object('id', 'ntf_ob_' || substr(signal::text, 1, 8), 'at', now(), 'read', false, 'toRoles', jsonb_build_array('owner', 'manager', 'worker'),
        'tone', 'red', 'title', 'Disease alert near you · ' || s.district, 'text', msg, 'link', '/app/guide?tab=bio'))
    on conflict (business_id, col, id) do nothing;
    n := n + 1;
  end loop;
  perform audit(null, 'outbreak_alert', format('%s: %s farms', s.district, n));
  return n;
end; $$;

create or replace function public.dismiss_outbreak(signal uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Super admin only'; end if;
  update outbreak_signals set status = 'dismissed', reviewed_by = auth.uid() where id = signal;
end; $$;

-- Realtime for the marketplace tables.
do $$ begin
  begin alter publication supabase_realtime add table public.market_orders; exception when others then null; end;
  begin alter publication supabase_realtime add table public.market_offers; exception when others then null; end;
  begin alter publication supabase_realtime add table public.market_requests; exception when others then null; end;
end $$;

-- Daily disease scan at 05:00 Ghana time.
do $$ begin
  perform cron.unschedule('detect-outbreaks');
exception when others then null; end $$;
select cron.schedule('detect-outbreaks', '0 5 * * *', $$select public.detect_outbreaks()$$);

-- Owner turns the farm's marketplace listing on or off.
create or replace function public.set_business_market(flag boolean) returns void
language plpgsql security definer set search_path = public as $$
declare bid uuid := (select business_id from profiles where user_id = auth.uid() and role = 'owner' and status = 'active');
begin
  if bid is null then raise exception 'Only the farm owner can change this'; end if;
  update businesses set market_enabled = flag where id = bid;
end; $$;

-- Farms see what kind of buyer posted a request (the name and phone stay private until an offer is accepted).
alter table public.market_requests add column if not exists buyer_type text;
create or replace function public.market_request_buyer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select buyer_type into new.buyer_type from market_buyers where user_id = new.buyer_id;
  return new;
end; $$;
drop trigger if exists market_request_buyer on public.market_requests;
create trigger market_request_buyer before insert on public.market_requests for each row execute function public.market_request_buyer();

-- Only the super admin runs the disease scan by hand (the daily job runs it automatically).
revoke execute on function public.detect_outbreaks() from public, anon, authenticated;
create or replace function public.run_outbreak_scan() returns int
language plpgsql security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'Super admin only'; end if;
  return detect_outbreaks();
end; $$;
