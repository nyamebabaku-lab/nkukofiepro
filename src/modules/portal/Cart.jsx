import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBasket, CalendarDays, Wallet, AlertTriangle, CheckCircle2, LogIn, Banknote, Smartphone } from 'lucide-react';
import { useCart, useDB } from '../../data/store';
import { useCurrentCustomer } from '../../data/selectors';
import { Button, Card, EmptyState, toast, cx } from '../../components/ui';
import { ProductImage } from '../../components/ProductArt';
import PayModal from '../../components/PayModal';
import { FarmPicker, useCartFarm } from './Shop';
import { priceLines, pickupCheck, createOrder, recordPayment } from '../../lib/orders';
import { money, num, dayKey, fmtDate } from '../../lib/format';

export default function Cart() {
  const db = useDB();
  const customer = useCurrentCustomer();
  const farm = useCartFarm();
  const { lines, setQty, clear } = useCart();
  const navigate = useNavigate();
  const [date, setDate] = useState(null);
  const [plan, setPlan] = useState('deposit');
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(null);
  const priced = useMemo(() => priceLines(db, farm.id, lines), [db, farm.id, lines]);
  const notHere = lines.filter((l) => !db.products.find((p) => p.id === l.productId)?.farmIds.includes(farm.id));
  const total = priced.subtotal;
  const deposit = Math.ceil((total * db.settings.depositPct) / 100);
  const days = Array.from({ length: 14 }, (_, i) => dayKey(i));
  const check = date ? pickupCheck(db, farm.id, date) : null;
  const problems = [...priced.problems, ...notHere.map((l) => `${db.products.find((p) => p.id === l.productId)?.name} is not sold at ${farm.name}`)];

  const place = (payment) => {
    try {
      const o = createOrder({ customerId: customer.id, farmId: farm.id, lines, pickupDate: date, channel: 'portal', note: plan === 'cash' ? `Pay cash at the farm — held ${db.settings.cashHoldHours} hours` : '' });
      if (payment) recordPayment({ orderId: o.id, customerId: customer.id, amount: payment.amount, method: payment.method, account: payment.account, kind: payment.amount >= o.total ? 'full' : 'deposit' });
      clear();
      setPaying(false);
      setDone(o);
    } catch (e) {
      toast.error('Could not book', e.message);
    }
  };
  const checkout = () => {
    if (!customer) return navigate('/login', { state: { customer: true, from: '/cart' } });
    if (problems.length) return toast.error('Please fix your basket', problems[0]);
    if (!check?.ok) return toast.error(check?.reason || 'Choose a pick-up date');
    if (plan === 'cash') return place(null);
    setPaying(true);
    return null;
  };

  if (done)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><CheckCircle2 className="h-11 w-11" /></div>
        <h1 className="font-display text-3xl font-semibold text-brand-900 dark:text-white">Order booked!</h1>
        <p className="mt-2 text-slate-500">Order <b>{done.ref}</b> · collect at <b>{db.farms.find((f) => f.id === done.farmId)?.name}</b> on <b>{fmtDate(done.pickupDate, 'EEEE d MMMM')}</b>, {db.settings.pickupHours}.</p>
        <p className="mt-1 text-sm text-slate-500">We sent the details to {customer.phone} by SMS.</p>
        <div className="mt-8 flex justify-center gap-3"><Link to="/account/orders"><Button>View my orders</Button></Link><Link to="/shop"><Button variant="secondary">Keep shopping</Button></Link></div>
      </div>
    );

  if (!lines.length)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Card><EmptyState icon={ShoppingBasket} title="Your basket is empty" text="Add eggs, birds, meat or chicks from the shop." action={<Link to="/shop"><Button>Go to shop</Button></Link>} /></Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-brand-900 dark:text-white">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <p className="mb-4 flex items-center gap-2 font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs text-white">1</span> Your basket</p>
            <div className="space-y-3">
              {lines.map((l) => {
                const p = db.products.find((x) => x.id === l.productId);
                const pl = priced.lines.find((x) => x.productId === l.productId);
                if (!p) return null;
                return (
                  <div key={l.productId} className="flex items-center gap-3">
                    <ProductImage p={p} className="h-16 w-16 shrink-0" rounded="rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-slate-500">{money(pl?.price || p.price)} / {p.unit}{pl && pl.price < p.price ? ' · bulk price' : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-cream-200 p-1 dark:bg-white/10">
                      <button type="button" className="rounded-lg p-1.5" onClick={() => setQty(l.productId, l.qty - 1)} aria-label="Less"><Minus className="h-3.5 w-3.5" /></button>
                      <input className="w-10 bg-transparent text-center text-sm font-bold" inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.productId, +e.target.value.replace(/\D/g, '') || 0)} />
                      <button type="button" className="rounded-lg p-1.5" onClick={() => setQty(l.productId, l.qty + 1)} aria-label="More"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className="hidden w-24 text-right font-bold sm:block">{money(pl?.amount || 0)}</p>
                    <button type="button" onClick={() => setQty(l.productId, 0)} className="text-slate-400 hover:text-accent-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
            {problems.map((p) => <p key={p} className="mt-3 flex items-center gap-2 rounded-xl bg-accent-50 p-2.5 text-xs font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"><AlertTriangle className="h-4 w-4 shrink-0" /> {p}</p>)}
          </Card>

          <Card className="p-5">
            <p className="mb-4 flex items-center gap-2 font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs text-white">2</span> Pick-up farm & day</p>
            <FarmPicker />
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.map((d) => {
                const c = pickupCheck(db, farm.id, d);
                return (
                  <button key={d} type="button" disabled={!c.ok} onClick={() => setDate(d)} className={cx('rounded-2xl border p-2 text-center transition', date === d ? 'border-brand-600 bg-brand-700 text-white' : c.ok ? 'border-cream-200 bg-white hover:border-brand-300 dark:border-white/10 dark:bg-navy-950' : 'border-transparent bg-cream-200/50 text-slate-400 line-through dark:bg-white/5')}>
                    <p className="text-[10px] font-semibold uppercase">{fmtDate(d, 'EEE')}</p>
                    <p className="text-lg font-extrabold">{fmtDate(d, 'd')}</p>
                    <p className="text-[10px]">{fmtDate(d, 'MMM')}</p>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {date ? `Collect on ${fmtDate(date, 'EEEE d MMMM')}, ${db.settings.pickupHours}` : 'Crossed-out days are closed or fully booked'}</p>
          </Card>

          <Card className="p-5">
            <p className="mb-4 flex items-center gap-2 font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs text-white">3</span> How would you like to pay?</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['deposit', Smartphone, `Pay ${db.settings.depositPct}% now`, `${money(deposit)} now, ${money(total - deposit)} at pick-up`],
                ['full', Wallet, 'Pay everything now', `${money(total)} by MoMo or card`],
                ...(db.settings.allowCashBooking ? [['cash', Banknote, 'Pay cash at the farm', `Held for ${db.settings.cashHoldHours} hours`]] : []),
              ].map(([k, I, t, d]) => (
                <button key={k} type="button" onClick={() => setPlan(k)} className={cx('rounded-2xl border p-4 text-left transition', plan === k ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-500/10' : 'border-cream-200 hover:border-brand-300 dark:border-white/10')}>
                  <I className="h-5 w-5 text-brand-700 dark:text-gold-400" />
                  <p className="mt-2 text-sm font-bold">{t}</p>
                  <p className="text-xs text-slate-500">{d}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card className="sticky top-20 p-5">
            <p className="font-display text-xl font-semibold">Summary</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{num(lines.reduce((a, l) => a + l.qty, 0))} items</span><span>{money(total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pick-up</span><span>{farm.short}{date ? ` · ${fmtDate(date, 'd MMM')}` : ''}</span></div>
              <div className="flex justify-between border-t border-cream-200 pt-3 text-base font-bold dark:border-white/10"><span>Total</span><span>{money(total)}</span></div>
              <div className="flex justify-between font-semibold text-brand-700 dark:text-gold-400"><span>Pay now</span><span>{money(plan === 'deposit' ? deposit : plan === 'full' ? total : 0)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Pay at pick-up</span><span>{money(plan === 'deposit' ? total - deposit : plan === 'full' ? 0 : total)}</span></div>
            </div>
            <Button size="lg" className="mt-5 w-full" icon={customer ? undefined : LogIn} onClick={checkout}>{!customer ? 'Sign in to book' : plan === 'cash' ? 'Book order' : `Pay ${money(plan === 'deposit' ? deposit : total)} & book`}</Button>
            {!customer && <p className="mt-2 text-center text-xs text-slate-500">New here? <Link to="/signup" className="font-semibold text-brand-700 dark:text-gold-400">Create an account</Link> — your basket is kept.</p>}
          </Card>
        </div>
      </div>
      <PayModal
        open={paying}
        onClose={() => setPaying(false)}
        title={plan === 'deposit' ? 'Pay your deposit' : 'Pay for your order'}
        subtitle={`Total ${money(total)} · pick-up ${date ? fmtDate(date, 'd MMM') : ''}`}
        amount={plan === 'deposit' ? deposit : total}
        min={plan === 'deposit' ? deposit : total}
        max={total}
        phone={customer?.phone}
        methods={['mtn', 'telecel', 'at', 'card']}
        onPaid={place}
      />
    </div>
  );
}
