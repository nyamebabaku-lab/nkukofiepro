// Farm side of the marketplace: buyers' requests (send offers), your listings, and marketplace orders.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Store, Handshake, Tags, ShoppingBag, Plus, MapPin, CalendarDays, Truck, Phone, Sparkles, RefreshCw } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { PageHeader, Button, Card, Badge, Tabs, FormModal, EmptyState, Segmented, toast, cx } from '../../components/ui';
import { LIVE } from '../../config';
import { CATEGORIES, UNITS, ORDER_STATUS, catLabel, buyerLabel, openRequests, farmOffers, sendOffer, withdrawOffer, farmListings, saveListing, setListingStatus, farmMarketOrders, setMarketOrderStatus, subscribeMarket, DEMO_OWN_FARM } from '../../lib/market';
import { activeFlocks } from '../../lib/flock';
import { saleReadiness } from '../../lib/feedplan';
import { money, num, fmtDate, today } from '../../lib/format';
import { useSession } from '../../data/store';

const NEXT = { new: ['confirmed', 'Confirm order'], confirmed: ['ready', 'Mark ready'], ready: ['completed', 'Picked up / delivered'] };

export default function FarmMarket() {
  const db = useDB();
  const user = useCurrentUser();
  const bizRow = useSession((s) => s.profile?.business);
  const bid = LIVE ? db.businessId : DEMO_OWN_FARM;
  const [tab, setTab] = useState('requests');
  const [data, setData] = useState({ requests: [], offers: [], listings: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [offerFor, setOfferFor] = useState(null);
  const [listing, setListing] = useState(null);
  const [area, setArea] = useState('near');

  const load = useCallback(async () => {
    try {
      const [requests, offers, listings, orders] = await Promise.all([openRequests(), farmOffers(bid), farmListings(bid), farmMarketOrders(bid)]);
      setData({ requests, offers, listings, orders });
    } catch (e) {
      toast.error('Could not load the marketplace', e.message);
    }
    setLoading(false);
  }, [bid]);
  useEffect(() => {
    load();
    return subscribeMarket(() => load());
  }, [load]);

  const myRegion = LIVE ? bizRow?.region : 'Greater Accra';
  const myOffer = (rid) => data.offers.find((o) => o.request_id === rid && o.status !== 'withdrawn');
  const requests = data.requests.filter((r) => area === 'all' || !myRegion || !r.region || r.region === myRegion);
  const openOrders = data.orders.filter((o) => !['completed', 'cancelled'].includes(o.status));

  // flocks that will be ready to sell — used to suggest offers and listings
  const ready = useMemo(() => activeFlocks(db).map((f) => ({ f, s: saleReadiness(db, f) })).filter((x) => x.s), [db]);

  const changeOrder = async (o, status) => {
    try {
      await setMarketOrderStatus(o.id, status);
      toast.success(`${o.ref} · ${ORDER_STATUS[status].label}`);
      load();
    } catch (e) {
      toast.error('Could not update', e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Buyers across Ghana: answer bulk requests, list what you have, and fill marketplace orders" actions={<><Button variant="ghost" icon={RefreshCw} onClick={load}>Refresh</Button>{user.role === 'owner' || user.role === 'manager' ? <Button icon={Plus} onClick={() => setListing({ category: 'eggs', unit: 'crate', available_from: today() })}>New listing</Button> : null}</>} />
      {LIVE && !bizRow?.payout && user.role === 'owner' && <Card className="mb-5 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:text-amber-200">Add your payout account in <b>Settings → Payments &amp; marketplace</b> so buyers can pay deposits online straight to you.</Card>}
      {LIVE && !bizRow?.region && user.role === 'owner' && <Card className="mb-5 p-4 text-sm">Set your farm's <b>region and district</b> in Settings → Payments &amp; marketplace so nearby buyers find you.</Card>}
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { value: 'requests', label: 'Buyer requests', icon: Handshake, count: data.requests.length || undefined },
        { value: 'listings', label: 'My listings', icon: Tags, count: data.listings.filter((l) => l.status === 'open').length || undefined },
        { value: 'orders', label: 'Orders', icon: ShoppingBag, count: openOrders.length || undefined },
      ]} />

      {loading ? <Card className="p-8 text-center text-sm text-slate-500">Loading…</Card> : null}

      {!loading && tab === 'requests' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented options={[{ value: 'near', label: myRegion ? `${myRegion} region` : 'Near me' }, { value: 'all', label: 'All Ghana' }]} value={area} onChange={setArea} />
            {ready.length > 0 && <p className="text-xs text-slate-500"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-gold-500" />{ready.length} of your flocks have sale dates — use them in offers.</p>}
          </div>
          {!requests.length ? <Card><EmptyState icon={Handshake} title="No open requests here" text="When hotels, schools, traders or programmes post what they need, it shows here." /></Card> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {requests.map((r) => {
                const mine = myOffer(r.id);
                return (
                  <Card key={r.id} className="flex flex-col p-5">
                    <div className="flex items-start justify-between gap-2"><Badge tone="gold">{catLabel(r.category)}</Badge>{r.buyer_type && <Badge tone={r.buyer_type === 'government' ? 'sky' : 'teal'}>Verified {buyerLabel(r.buyer_type).toLowerCase()}</Badge>}</div>
                    <p className="mt-3 font-display text-lg font-semibold text-brand-900 dark:text-white">{r.title}</p>
                    <p className="mt-1 text-2xl font-extrabold">{num(r.qty)} <span className="text-sm font-semibold text-slate-500">{r.unit}s{r.target_weight_kg ? ` · ~${r.target_weight_kg} kg` : ''}</span></p>
                    <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Needed by {fmtDate(r.needed_by)}</p>
                      <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {[r.district, r.region].filter(Boolean).join(', ') || 'Ghana'}{r.delivery ? ' · delivery wanted' : ' · buyer collects'}</p>
                      {r.budget_per_unit ? <p>Budget about <b>{money(r.budget_per_unit)}</b> per {r.unit}</p> : null}
                      {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                    </div>
                    <div className="mt-auto pt-4">
                      {mine ? (
                        <div className="flex items-center justify-between rounded-xl bg-cream-100 p-3 text-sm dark:bg-white/5">
                          <span>Your offer: <b>{money(mine.price_per_unit)}</b> × {num(mine.qty)} · <Badge tone={mine.status === 'accepted' ? 'green' : mine.status === 'declined' ? 'red' : 'sky'}>{mine.status}</Badge></span>
                          {mine.status === 'sent' && <Button size="sm" variant="ghost" onClick={async () => { await withdrawOffer(mine.id); load(); }}>Withdraw</Button>}
                        </div>
                      ) : (
                        <Button className="w-full" icon={Handshake} onClick={() => setOfferFor(r)}>Make an offer</Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {!loading && tab === 'listings' && (
        !data.listings.length ? <Card><EmptyState icon={Tags} title="No listings yet" text="List eggs, birds, meat or chicks you will have, with your price. Buyers order and pay a deposit." /></Card> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.listings.map((l) => (
              <Card key={l.id} className={cx('p-5', l.status !== 'open' && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2"><Badge tone="gold">{catLabel(l.category)}</Badge><Badge tone={l.status === 'open' ? 'green' : 'slate'}>{l.status === 'open' ? 'Listed' : 'Closed'}</Badge></div>
                <p className="mt-3 font-display text-lg font-semibold text-brand-900 dark:text-white">{l.title}</p>
                <p className="mt-1"><b className="text-xl">{money(l.price)}</b> <span className="text-sm text-slate-500">/ {l.unit}</span>{l.wholesale_price ? <span className="ml-2 text-xs text-slate-500">wholesale {money(l.wholesale_price)} from {num(l.min_wholesale_qty || 0)}</span> : null}</p>
                <p className="mt-1 text-sm text-slate-500">{l.qty ? `${num(l.qty)} ${l.unit}s available` : 'Quantity open'} · from {fmtDate(l.available_from)}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setListing(l)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await setListingStatus(l.id, l.status === 'open' ? 'closed' : 'open'); load(); }}>{l.status === 'open' ? 'Close' : 'Re-open'}</Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {!loading && tab === 'orders' && (
        !data.orders.length ? <Card><EmptyState icon={ShoppingBag} title="No marketplace orders yet" text="Orders from listings and accepted offers appear here with the buyer's contact." /></Card> : (
          <div className="space-y-3">
            {data.orders.map((o) => (
              <Card key={o.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{o.ref} · {o.title}</p>
                  <p className="text-sm text-slate-500">{num(o.qty)} {o.unit}s × {money(o.unit_price)} = <b className="text-slate-800 dark:text-white">{money(o.total)}</b> · deposit paid {money(o.deposit_paid || 0)}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500"><span>{o.buyer_name}</span>{o.buyer_phone && <a href={`tel:${o.buyer_phone}`} className="flex items-center gap-1 text-brand-700 dark:text-brand-300"><Phone className="h-3 w-3" />{o.buyer_phone}</a>}<span>{o.delivery ? <><Truck className="mr-1 inline h-3 w-3" />Deliver {o.address || ''}</> : 'Pick-up'} {fmtDate(o.pickup_date)}</span></p>
                </div>
                <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                {NEXT[o.status] && <Button size="sm" onClick={() => changeOrder(o, NEXT[o.status][0])}>{NEXT[o.status][1]}</Button>}
                {['new', 'confirmed'].includes(o.status) && <Button size="sm" variant="ghost" onClick={() => changeOrder(o, 'cancelled')}>Cancel</Button>}
              </Card>
            ))}
          </div>
        )
      )}

      <FormModal
        open={!!offerFor}
        onClose={() => setOfferFor(null)}
        title={`Offer · ${offerFor?.title || ''}`}
        subtitle={offerFor ? `${num(offerFor.qty)} ${offerFor.unit}s by ${fmtDate(offerFor.needed_by)}` : ''}
        initial={offerFor ? { request_id: offerFor.id, qty: offerFor.qty, ready_date: offerFor.needed_by, price_per_unit: offerFor.budget_per_unit || '', avg_weight_kg: offerFor.target_weight_kg || '' } : null}
        fields={[
          { name: 'price_per_unit', label: `Your price per ${offerFor?.unit || 'unit'} (GH₵)`, type: 'number', step: '0.01', required: true },
          { name: 'qty', label: 'How many you can supply', type: 'number', required: true },
          { name: 'ready_date', label: 'Ready on', type: 'date', required: true },
          { name: 'avg_weight_kg', label: 'Average weight (kg)', type: 'number', step: '0.01' },
          { name: 'flock_code', label: 'From flock', type: 'select', options: ready.map(({ f, s }) => ({ value: f.code, label: `${f.code} · ${s.ready ? 'ready now' : `ready ${fmtDate(s.fromDate)}`}${s.weight ? ` · ${(s.weight / 1000).toFixed(2)} kg` : ''}` })), placeholder: 'Choose (optional)' },
          { name: 'note', label: 'Message to the buyer', span: 2, placeholder: 'e.g. We can deliver, birds vaccinated, invoice available' },
        ]}
        onSubmit={async (v) => {
          try {
            await sendOffer(bid, v);
            toast.success('Offer sent', 'The buyer is notified and can accept it.');
            setOfferFor(null);
            load();
          } catch (e) {
            toast.error('Could not send', e.message);
          }
        }}
      />
      <FormModal
        open={!!listing}
        onClose={() => setListing(null)}
        title={listing?.id ? 'Edit listing' : 'New listing'}
        subtitle="Buyers see your farm, area and these details"
        initial={listing}
        fields={[
          { name: 'title', label: 'What you are selling', required: true, span: 2, placeholder: 'e.g. Large eggs — crate of 30' },
          { name: 'category', label: 'Category', type: 'select', options: CATEGORIES, required: true },
          { name: 'unit', label: 'Sold per', type: 'select', options: UNITS, required: true },
          { name: 'price', label: 'Price (GH₵)', type: 'number', step: '0.01', required: true },
          { name: 'qty', label: 'Quantity available', type: 'number' },
          { name: 'wholesale_price', label: 'Wholesale price (GH₵)', type: 'number', step: '0.01' },
          { name: 'min_wholesale_qty', label: 'Wholesale from (qty)', type: 'number' },
          { name: 'available_from', label: 'Available from', type: 'date', required: true },
          { name: 'available_to', label: 'Until (optional)', type: 'date' },
          { name: 'note', label: 'Details', span: 2 },
        ]}
        onSubmit={async (v) => {
          try {
            await saveListing(bid, v);
            toast.success(v.id ? 'Listing updated' : 'Listed on the marketplace');
            setListing(null);
            load();
          } catch (e) {
            toast.error('Could not save', e.message);
          }
        }}
      />
      <p className="mt-8 flex items-center gap-2 text-xs text-slate-400"><Store className="h-3.5 w-3.5" /> Deposits paid online go straight to your payout account. Buyers' phone numbers are shown once they order or accept your offer.</p>
    </div>
  );
}
