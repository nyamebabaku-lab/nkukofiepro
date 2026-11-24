// Buyer side of the marketplace: browse farms' listings across Ghana and order, post bulk requests
// (verified bulk / government buyers and traders) and accept farms' offers, pay deposits, track orders.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Store, Handshake, ShoppingBag, Plus, BadgeCheck, Clock, Phone, CalendarDays, Truck, Building2 } from 'lucide-react';
import { Button, Card, Badge, Tabs, FormModal, EmptyState, Input, Select, Modal, Field, toast, cx } from '../../components/ui';
import PayModal from '../../components/PayModal';
import { useSession } from '../../data/store';
import { LIVE } from '../../config';
import { REGIONS } from '../../lib/ghana';
import {
  CATEGORIES, UNITS, BUYER_TYPES, ORDER_STATUS, catLabel, buyerLabel, myBuyer, becomeBuyer, marketFarms, openListings, orderListing,
  myRequests, postRequest, cancelRequest, offersFor, acceptOffer, buyerOrders, subscribeMarket, demoDeposit,
} from '../../lib/market';
import { money, num, fmtDate, today } from '../../lib/format';
import { addDays, format } from 'date-fns';

const DEPOSIT_PCT = 30;
const inDays = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd');

function BuyerSetup({ me, profile, onDone }) {
  const [v, setV] = useState({ kind: me?.buyer_type || 'household', org: me?.org_name || '', region: me?.region || '', district: me?.district || '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (v.kind !== 'household' && !v.org.trim()) return toast.error('Enter your business or organisation name');
    setBusy(true);
    try {
      await becomeBuyer({ fullName: profile?.full_name || me?.full_name || 'Buyer', phone: profile?.phone || me?.phone || '', ...v });
      toast.success(v.kind === 'household' ? 'You can start buying' : 'Sent for approval', v.kind === 'household' ? undefined : 'We check bulk, trader and government buyers before they can post requests. Meanwhile you can buy from listings.');
      onDone();
    } catch (e) {
      toast.error('Could not save', e.message);
    }
    setBusy(false);
    return null;
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {BUYER_TYPES.map((t) => (
          <button key={t.value} type="button" onClick={() => setV({ ...v, kind: t.value })} className={cx('rounded-2xl border p-3 text-left transition', v.kind === t.value ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-500/10' : 'border-cream-200 dark:border-white/10')}>
            <p className="text-sm font-bold">{t.label}</p><p className="text-xs text-slate-500">{t.sub}</p>
          </button>
        ))}
      </div>
      {v.kind !== 'household' && <Field label="Business / organisation name"><Input value={v.org} onChange={(e) => setV({ ...v, org: e.target.value })} placeholder="e.g. Golden Tulip Kumasi" /></Field>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Region"><Select placeholder="Choose…" value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })} options={REGIONS} /></Field>
        <Field label="District / town"><Input value={v.district} onChange={(e) => setV({ ...v, district: e.target.value })} /></Field>
      </div>
      <Button className="w-full" disabled={busy} onClick={save}>Save buyer profile</Button>
    </div>
  );
}

export default function BuyerMarket() {
  const profile = useSession((s) => s.profile);
  const [tab, setTab] = useState('buy');
  const [me, setMe] = useState(undefined);
  const [farms, setFarms] = useState([]);
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [offers, setOffers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [region, setRegion] = useState('');
  const [ordering, setOrdering] = useState(null);
  const [asking, setAsking] = useState(false);
  const [setup, setSetup] = useState(false);
  const [paying, setPaying] = useState(null);

  const load = useCallback(async () => {
    try {
      const [b, f, l, o] = await Promise.all([myBuyer(), marketFarms(), openListings(), buyerOrders().catch(() => [])]);
      setMe(b);
      setFarms(f);
      setListings(l);
      setOrders(o);
      if (b && b.buyer_type !== 'household') {
        const r = await myRequests();
        setRequests(r);
        setOffers(await offersFor(r.map((x) => x.id)));
      }
    } catch (e) {
      toast.error('Could not load the marketplace', e.message);
    }
  }, []);
  useEffect(() => {
    load();
    return subscribeMarket(() => load());
  }, [load]);
  useEffect(() => {
    if (me === null) setSetup(true);
  }, [me]);

  const farm = (id) => farms.find((f) => f.id === id);
  const canRequest = me?.verified && me.buyer_type !== 'household';
  const wholesale = me?.verified && me.buyer_type !== 'household';
  const shown = useMemo(() => listings.filter((l) => {
    const f = farm(l.business_id);
    if (!f) return false;
    if (cat !== 'all' && l.category !== cat) return false;
    if (region && f.region !== region) return false;
    return !q || `${l.title} ${f.name} ${f.location} ${f.district}`.toLowerCase().includes(q.toLowerCase());
  }), [listings, farms, cat, region, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const payDeposit = (o) => setPaying({ order: o, amount: Math.max(1, Math.ceil((o.total * DEPOSIT_PCT) / 100) - (o.deposit_paid || 0)) });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-brand-900 dark:text-white">Marketplace</h1>
          <p className="text-sm text-slate-500">Eggs, birds, meat and chicks from {farms.length} farms across Ghana</p>
        </div>
        {me && (
          <button type="button" onClick={() => setSetup(true)} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-soft dark:bg-navy-900">
            {me.verified ? <BadgeCheck className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-amber-500" />}
            {me.org_name || me.full_name} · {buyerLabel(me.buyer_type)}{!me.verified && ' (awaiting approval)'}
          </button>
        )}
      </div>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { value: 'buy', label: 'Buy', icon: Store },
        { value: 'farms', label: 'Farms', icon: Building2 },
        ...(me && me.buyer_type !== 'household' ? [{ value: 'bulk', label: 'Bulk requests', icon: Handshake, count: offers.filter((o) => o.status === 'sent').length || undefined }] : []),
        { value: 'orders', label: 'My orders', icon: ShoppingBag, count: orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length || undefined },
      ]} />

      {tab === 'buy' && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search eggs, broilers, a farm or town…" /></div>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: 'all', label: 'Everything' }, ...CATEGORIES]} />
            <Select value={region} onChange={(e) => setRegion(e.target.value)} options={[{ value: '', label: 'All regions' }, ...REGIONS.map((r) => ({ value: r, label: r }))]} />
          </div>
          {!shown.length ? <Card><EmptyState icon={Store} title="Nothing listed here yet" text="Try another region or category." /></Card> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((l) => {
                const f = farm(l.business_id);
                const ws = wholesale && l.wholesale_price;
                return (
                  <Card key={l.id} className="flex flex-col p-5">
                    <div className="flex items-start justify-between gap-2"><Badge tone="gold">{catLabel(l.category)}</Badge>{l.available_from > today() && <Badge tone="sky">From {fmtDate(l.available_from, 'd MMM')}</Badge>}</div>
                    <p className="mt-3 font-display text-lg font-semibold text-brand-900 dark:text-white">{l.title}</p>
                    <p className="mt-1"><b className="text-xl">{money(l.price)}</b> <span className="text-sm text-slate-500">/ {l.unit}</span></p>
                    {ws ? <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Your wholesale price {money(l.wholesale_price)} from {num(l.min_wholesale_qty || 0)} {l.unit}s</p> : l.wholesale_price ? <p className="text-xs text-slate-400">Wholesale prices for approved traders & bulk buyers</p> : null}
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"><MapPin className="h-4 w-4" /> {f.name} · {[f.location, f.region].filter(Boolean).join(', ')}</p>
                    {l.note && <p className="mt-1 text-xs text-slate-500">{l.note}</p>}
                    <p className="mt-1 text-xs text-slate-500">{l.qty ? `${num(l.qty)} ${l.unit}s available` : 'Ask for quantity'}</p>
                    <Button className="mt-auto w-full" style={{ marginTop: 16 }} onClick={() => (me ? setOrdering(l) : setSetup(true))}>Order</Button>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'farms' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {farms.map((f) => (
            <Card key={f.id} className="p-5">
              <div className="flex items-center gap-3">
                {f.logo ? <img src={f.logo} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800">{f.name[0]}</span>}
                <div className="min-w-0"><p className="truncate font-semibold">{f.name}</p><p className="truncate text-xs text-slate-500">{[f.location, f.district, f.region].filter(Boolean).join(', ')}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span>{num(f.listings)} listing{f.listings === 1 ? '' : 's'}</span>
                {f.phone && <a href={`tel:${f.phone}`} className="flex items-center gap-1 font-semibold text-brand-700 dark:text-brand-300"><Phone className="h-4 w-4" /> Call</a>}
              </div>
              <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => { setQ(f.name); setTab('buy'); }}>See listings</Button>
            </Card>
          ))}
        </div>
      )}

      {tab === 'bulk' && (
        <>
          {!canRequest ? (
            <Card className="mb-5 p-5 text-sm"><b>Awaiting approval.</b> We check bulk, trader and government buyers before they can post requests to farms. You will get access as soon as you are approved — usually within a day.</Card>
          ) : (
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Tell farms what you need; they send offers with price and ready date. Accept the best one.</p>
              <Button icon={Plus} onClick={() => setAsking(true)}>New request</Button>
            </div>
          )}
          {!requests.length ? <Card><EmptyState icon={Handshake} title="No requests yet" text="e.g. 500 broilers of about 2 kg for 20 December, delivered to Kumasi." /></Card> : (
            <div className="space-y-4">
              {requests.map((r) => {
                const list = offers.filter((o) => o.request_id === r.id && o.status !== 'withdrawn');
                return (
                  <Card key={r.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-semibold text-brand-900 dark:text-white">{r.title}</p>
                        <p className="text-sm text-slate-500">{num(r.qty)} {r.unit}s{r.target_weight_kg ? ` · ~${r.target_weight_kg} kg` : ''} · by {fmtDate(r.needed_by)} · {[r.district, r.region].filter(Boolean).join(', ')}</p>
                      </div>
                      <div className="flex items-center gap-2"><Badge tone={r.status === 'open' ? 'green' : r.status === 'awarded' ? 'sky' : 'slate'}>{r.status}</Badge>{r.status === 'open' && <Button size="sm" variant="ghost" onClick={async () => { await cancelRequest(r.id); load(); }}>Cancel</Button>}</div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {!list.length ? <p className="text-sm text-slate-400">No offers yet — farms in the area are notified.</p> : list.map((o) => (
                        <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-cream-100 p-3 text-sm dark:bg-white/5">
                          <span className="min-w-0 flex-1"><b>{farm(o.business_id)?.name || 'A farm'}</b> · {farm(o.business_id)?.district || farm(o.business_id)?.region}<br /><span className="text-slate-500">{money(o.price_per_unit)} × {num(o.qty)} = <b className="text-slate-800 dark:text-white">{money(o.price_per_unit * o.qty)}</b> · ready {fmtDate(o.ready_date)}{o.avg_weight_kg ? ` · ~${o.avg_weight_kg} kg` : ''}{o.note ? ` · ${o.note}` : ''}</span></span>
                          {o.status === 'sent' && r.status === 'open' ? <Button size="sm" onClick={async () => { try { const ord = await acceptOffer(o.id, { delivery: r.delivery }); toast.success('Offer accepted', `Order ${ord.ref} created`); await load(); setTab('orders'); payDeposit(ord); } catch (e) { toast.error('Could not accept', e.message); } }}>Accept</Button> : <Badge tone={o.status === 'accepted' ? 'green' : 'slate'}>{o.status}</Badge>}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'orders' && (
        !orders.length ? <Card><EmptyState icon={ShoppingBag} title="No marketplace orders yet" text="Order from a listing or accept a farm's offer." /></Card> : (
          <div className="space-y-3">
            {orders.map((o) => {
              const f = farm(o.business_id);
              const due = Math.ceil((o.total * DEPOSIT_PCT) / 100);
              return (
                <Card key={o.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{o.ref} · {o.title}</p>
                    <p className="text-sm text-slate-500">{f?.name} · {num(o.qty)} {o.unit}s · <b className="text-slate-800 dark:text-white">{money(o.total)}</b> · paid {money(o.deposit_paid || 0)}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500"><span>{o.delivery ? <><Truck className="mr-1 inline h-3 w-3" />Delivery</> : 'Pick-up'} <CalendarDays className="mx-1 inline h-3 w-3" />{fmtDate(o.pickup_date)}</span>{f?.phone && <a href={`tel:${f.phone}`} className="flex items-center gap-1 text-brand-700 dark:text-brand-300"><Phone className="h-3 w-3" />{f.phone}</a>}</p>
                  </div>
                  <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  {['new', 'confirmed'].includes(o.status) && (o.deposit_paid || 0) < due && <Button size="sm" onClick={() => payDeposit(o)}>Pay {DEPOSIT_PCT}% deposit</Button>}
                </Card>
              );
            })}
          </div>
        )
      )}

      <Modal open={setup} onClose={() => setSetup(false)} title="Your buyer profile" subtitle="Tell farms who you are buying for" size="md">
        <BuyerSetup me={me} profile={profile} onDone={() => { setSetup(false); load(); }} />
      </Modal>

      <FormModal
        open={!!ordering}
        onClose={() => setOrdering(null)}
        title={`Order · ${ordering?.title || ''}`}
        subtitle={ordering ? `${farm(ordering.business_id)?.name} · ${money(wholesale && ordering.wholesale_price ? ordering.wholesale_price : ordering.price)} per ${ordering.unit}${wholesale && ordering.wholesale_price ? ` (from ${num(ordering.min_wholesale_qty || 0)})` : ''}` : ''}
        initial={ordering ? { qty: 1, pickup: ordering.available_from > today() ? ordering.available_from : inDays(1), delivery: false } : null}
        fields={[
          { name: 'qty', label: `How many ${ordering?.unit || ''}s`, type: 'number', required: true },
          { name: 'pickup', label: 'Pick-up / delivery date', type: 'date', required: true },
          { name: 'delivery', label: 'Ask the farm to deliver', type: 'checkbox' },
          { name: 'address', label: 'Delivery address (if delivering)', span: 2 },
          { name: 'note', label: 'Message to the farm', span: 2 },
        ]}
        onSubmit={async (v) => {
          try {
            const o = await orderListing({ listingId: ordering.id, qty: +v.qty, pickup: v.pickup, delivery: v.delivery, address: v.address, note: v.note });
            toast.success('Order placed', `${o.ref} · ${money(o.total)}`);
            setOrdering(null);
            await load();
            setTab('orders');
            payDeposit(o);
          } catch (e) {
            toast.error('Could not order', e.message);
          }
        }}
      />

      <FormModal
        open={asking}
        onClose={() => setAsking(false)}
        title="New bulk request"
        subtitle="Farms that can supply will send you offers"
        initial={{ category: 'live', unit: 'bird', needed_by: inDays(14), region: me?.region || '', district: me?.district || '', delivery: false }}
        fields={[
          { name: 'title', label: 'What you need', required: true, span: 2, placeholder: 'e.g. Broilers for Christmas banquets' },
          { name: 'category', label: 'Category', type: 'select', options: CATEGORIES, required: true },
          { name: 'unit', label: 'Unit', type: 'select', options: UNITS, required: true },
          { name: 'qty', label: 'Quantity', type: 'number', required: true },
          { name: 'target_weight_kg', label: 'Bird weight (kg, optional)', type: 'number', step: '0.1' },
          { name: 'needed_by', label: 'Needed by', type: 'date', required: true },
          { name: 'budget_per_unit', label: 'Budget per unit (GH₵, optional)', type: 'number', step: '0.01' },
          { name: 'region', label: 'Region', type: 'select', options: REGIONS },
          { name: 'district', label: 'District / town' },
          { name: 'delivery', label: 'I need delivery', type: 'checkbox' },
          { name: 'note', label: 'Details for farms', span: 2 },
        ]}
        onSubmit={async (v) => {
          try {
            await postRequest(v);
            toast.success('Request posted', 'Farms will send you offers.');
            setAsking(false);
            load();
          } catch (e) {
            toast.error('Could not post', e.message);
          }
        }}
      />

      {paying && (
        <PayModal
          open
          onClose={() => setPaying(null)}
          title={`Deposit for ${paying.order.ref}`}
          subtitle={`${DEPOSIT_PCT}% to confirm · goes straight to ${farm(paying.order.business_id)?.name || 'the farm'}`}
          amount={paying.amount}
          min={1}
          max={paying.order.total - (paying.order.deposit_paid || 0)}
          methods={['mtn', 'telecel', 'at', 'card']}
          phone={profile?.phone || me?.phone || ''}
          businessId={LIVE ? paying.order.business_id : undefined}
          purpose="market_order"
          purposeId={paying.order.id}
          onPaid={({ amount }) => {
            if (!LIVE) demoDeposit(paying.order.id, amount);
            toast.success('Deposit paid', 'The farm has been told.');
            setTimeout(load, 1500);
          }}
        />
      )}
    </div>
  );
}
