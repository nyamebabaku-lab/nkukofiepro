import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2, AlertTriangle, X } from 'lucide-react';
import { useDB } from '../../data/store';
import { useFarmScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, Segmented, SearchInput, Field, Input, Select, toast, cx } from '../../components/ui';
import { ProductImage } from '../../components/ProductArt';
import PayModal from '../../components/PayModal';
import { PRODUCT_CATEGORIES, productStock } from '../../lib/stock';
import { priceLines, createOrder, recordPayment, unitPrice, pickupCheck } from '../../lib/orders';
import { money, num, today, dayKey } from '../../lib/format';

export default function POS() {
  const db = useDB();
  const scope = useFarmScope();
  const farms = useMyFarms();
  const navigate = useNavigate();
  const [farmId, setFarmId] = useState(scope === 'all' ? farms[0]?.id : scope);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState({});
  const [mode, setMode] = useState('now');
  const [pickup, setPickup] = useState(dayKey(1));
  const [customerId, setCustomerId] = useState('');
  const [walkIn, setWalkIn] = useState({ name: '', phone: '' });
  const [discount, setDiscount] = useState('');
  const [paying, setPaying] = useState(false);
  const [sheet, setSheet] = useState(false);

  const products = db.products.filter((p) => p.active !== false && p.farmIds.includes(farmId) && (cat === 'all' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
  const lines = Object.entries(cart).filter(([, n]) => n > 0).map(([productId, qty]) => ({ productId, qty }));
  const priced = useMemo(() => priceLines(db, farmId, lines), [db, farmId, cart]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = Math.max(0, priced.subtotal - (+discount || 0));
  const customer = db.customers.find((c) => c.id === customerId);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const setQty = (id, n) => setCart((c) => ({ ...c, [id]: Math.max(0, n) }));
  const warns = [...new Set(priced.lines.map((l) => l.withdrawalWarn).filter(Boolean))];

  const validate = () => {
    if (!lines.length) return 'Add something to the sale';
    if (priced.problems.length) return priced.problems[0];
    if (mode === 'book') {
      if (!customer && !walkIn.phone) return 'Bookings need a customer or a phone number';
      const c = pickupCheck({ ...db, orders: [] }, farmId, pickup);
      if (!c.ok) return c.reason;
    }
    return null;
  };
  const finish = (payment) => {
    try {
      const o = createOrder({ customerId: customer?.id, customerName: walkIn.name || 'Walk-in customer', phone: walkIn.phone, farmId, lines, pickupDate: mode === 'now' ? today() : pickup, channel: 'counter', discount: +discount || 0, status: mode === 'now' ? 'picked' : 'booked' });
      if (payment) recordPayment({ orderId: o.id, amount: payment.amount, method: payment.method, account: payment.account, kind: payment.amount >= o.total ? 'full' : 'deposit' });
      toast.success(mode === 'now' ? 'Sale complete' : 'Booking saved', `${o.ref} · ${money(o.total)}`);
      setCart({});
      setDiscount('');
      setPaying(false);
      setSheet(false);
      navigate(`/app/orders/${o.id}`);
    } catch (e) {
      toast.error('Could not save', e.message);
    }
  };
  const start = () => {
    const err = validate();
    if (err) return toast.error(err);
    setPaying(true);
    return null;
  };
  const saveUnpaid = () => {
    const err = validate();
    if (err) return toast.error(err);
    if (!customer) return toast.error('Choose a registered customer', 'Only known customers can take goods on credit or book without paying');
    finish(null);
    return null;
  };

  const CartPanel = (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-cream-200 p-4 dark:border-white/5">
        <Segmented className="w-full [&>button]:flex-1" options={[{ value: 'now', label: 'Sell now' }, { value: 'book', label: 'Book for pick-up' }]} value={mode} onChange={setMode} />
        {mode === 'book' && <Field label="Pick-up date"><Input type="date" min={today()} value={pickup} onChange={(e) => setPickup(e.target.value)} /></Field>}
        <Field label="Customer">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Walk-in customer" options={db.customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }))} />
        </Field>
        {!customer && (
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name (optional)" value={walkIn.name} onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })} />
            <Input placeholder="Phone" inputMode="tel" value={walkIn.phone} onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })} />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {!priced.lines.length && <div className="py-10 text-center text-sm text-slate-400"><ShoppingCart className="mx-auto mb-2 h-8 w-8" />Tap products to add them</div>}
        {priced.lines.map((l) => (
          <div key={l.productId} className="flex items-center gap-2 rounded-xl bg-cream-100 p-2.5 dark:bg-white/5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{l.name}</p>
              <p className="text-xs text-slate-500">{money(l.price)} / {l.unit}</p>
            </div>
            <button type="button" className="rounded-lg bg-white p-1.5 dark:bg-white/10" onClick={() => setQty(l.productId, l.qty - 1)} aria-label="Less"><Minus className="h-3.5 w-3.5" /></button>
            <input className="w-12 rounded-lg bg-white py-1 text-center text-sm font-bold dark:bg-navy-950" inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.productId, +e.target.value.replace(/\D/g, '') || 0)} />
            <button type="button" className="rounded-lg bg-white p-1.5 dark:bg-white/10" onClick={() => setQty(l.productId, l.qty + 1)} aria-label="More"><Plus className="h-3.5 w-3.5" /></button>
            <p className="w-24 text-right text-sm font-bold">{money(l.amount)}</p>
            <button type="button" onClick={() => setQty(l.productId, 0)} className="text-slate-400 hover:text-accent-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {priced.problems.map((p) => <p key={p} className="flex items-center gap-1.5 text-xs font-medium text-accent-600"><AlertTriangle className="h-3.5 w-3.5" /> {p}</p>)}
        {warns.map((w) => <p key={w} className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}</p>)}
      </div>
      <div className="space-y-3 border-t border-cream-200 p-4 dark:border-white/5">
        <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{money(priced.subtotal)}</span></div>
        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Discount</span><Input className="w-28 py-1.5 text-right" inputMode="decimal" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
        <div className="flex items-center justify-between"><span className="font-bold">Total</span><span className="font-display text-2xl font-semibold text-brand-900 dark:text-white">{money(total)}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={saveUnpaid} disabled={!lines.length}>{mode === 'now' ? 'On credit' : 'Book unpaid'}</Button>
          <Button onClick={start} disabled={!lines.length}>{mode === 'now' ? 'Take payment' : 'Take deposit'}</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Point of sale" subtitle="Sell at the farm gate or book an order for a customer" actions={farms.length > 1 && <Segmented options={farms.map((f) => ({ value: f.id, label: f.short }))} value={farmId} onChange={(v) => { setFarmId(v); setCart({}); }} />} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search products…" className="sm:w-64" />
            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
              {[{ value: 'all', label: 'All', emoji: '✨' }, ...PRODUCT_CATEGORIES].map((c) => (
                <button key={c.value} type="button" onClick={() => setCat(c.value)} className={cx('whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition', cat === c.value ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-cream-300 dark:bg-navy-900 dark:text-slate-300 dark:ring-white/10')}>{c.emoji} {c.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const st = productStock(db, p.id, farmId);
              const inCart = cart[p.id] || 0;
              const out = st.available - inCart <= 0;
              return (
                <button key={p.id} type="button" disabled={out} onClick={() => setQty(p.id, inCart + 1)} className={cx('group relative overflow-hidden rounded-2xl bg-white text-left shadow-soft ring-1 ring-cream-200 transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-50 dark:bg-navy-900 dark:ring-white/5', inCart && 'ring-2 ring-brand-600')}>
                  <ProductImage p={p} className="aspect-[5/4] w-full" rounded="rounded-none" />
                  {inCart > 0 && <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-700 px-2 text-xs font-bold text-white">{inCart}</span>}
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 dark:text-white">{p.name}</p>
                    <p className="mt-1 text-sm font-extrabold text-brand-800 dark:text-gold-400">{money(unitPrice(p, inCart || 1))}<span className="text-[11px] font-medium text-slate-400"> /{p.unit}</span></p>
                    <p className={cx('text-[11px]', st.available ? 'text-slate-500' : 'text-accent-600')}>{st.available ? `${num(st.available)} in stock` : 'Out of stock'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <Card className="sticky top-20 hidden h-[calc(100vh-7rem)] overflow-hidden lg:block">{CartPanel}</Card>
      </div>
      {count > 0 && (
        <button type="button" onClick={() => setSheet(true)} className="fixed inset-x-4 bottom-24 z-20 flex items-center justify-between rounded-2xl bg-brand-800 px-5 py-4 text-white shadow-lift lg:hidden">
          <span className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-5 w-5" /> {count} item{count === 1 ? '' : 's'}</span>
          <span className="font-extrabold">{money(total)} →</span>
        </button>
      )}
      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 flex h-[88vh] animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-navy-900">
            <div className="flex items-center justify-between px-4 pt-3"><p className="font-display text-lg font-semibold">Sale</p><button type="button" onClick={() => setSheet(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
            {CartPanel}
          </div>
        </div>
      )}
      <PayModal
        open={paying}
        onClose={() => setPaying(false)}
        title={mode === 'now' ? 'Take payment' : 'Take a deposit'}
        subtitle={`${customer?.name || walkIn.name || 'Walk-in customer'} · total ${money(total)}`}
        amount={mode === 'now' ? total : Math.ceil((total * db.settings.depositPct) / 100)}
        min={mode === 'now' && !customer ? total : 0.01}
        max={total}
        phone={customer?.phone || walkIn.phone}
        methods={['cash', 'mtn', 'telecel', 'at', 'card']}
        presets={[{ label: 'Full', value: total }, { label: `${db.settings.depositPct}% deposit`, value: Math.ceil((total * db.settings.depositPct) / 100) }]}
        onPaid={finish}
      />
    </div>
  );
}
