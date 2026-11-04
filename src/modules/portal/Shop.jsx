import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Minus, ShoppingBasket, MapPin, Check } from 'lucide-react';
import { useCart, useDB } from '../../data/store';
import { SearchInput, Badge, Modal, Button, toast, cx } from '../../components/ui';
import { ProductImage } from '../../components/ProductArt';
import { PRODUCT_CATEGORIES, productStock, categoryLabel } from '../../lib/stock';
import { unitPrice } from '../../lib/orders';
import { money, num } from '../../lib/format';

/** Which farm the customer will collect from (defaults to the first farm). */
export function useCartFarm() {
  const farms = useDB((s) => s.farms);
  const farmId = useCart((s) => s.farmId);
  return farms.find((f) => f.id === farmId) || farms[0];
}

export function FarmPicker() {
  const farms = useDB((s) => s.farms);
  const farm = useCartFarm();
  const setFarm = useCart((s) => s.setFarm);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300"><MapPin className="h-4 w-4" /> Pick up at</span>
      {farms.map((f) => (
        <button key={f.id} type="button" onClick={() => setFarm(f.id)} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition', farm.id === f.id ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-cream-300 dark:bg-navy-900 dark:text-slate-300 dark:ring-white/10')}>{f.name}</button>
      ))}
    </div>
  );
}

function QtyControl({ p, inCart, max }) {
  const { add, setQty } = useCart();
  if (!inCart) return null;
  return (
    <div className="flex items-center gap-1 rounded-xl bg-brand-700 p-1 text-white">
      <button type="button" className="rounded-lg p-1.5 hover:bg-white/10" onClick={() => setQty(p.id, inCart - 1)} aria-label="Less"><Minus className="h-4 w-4" /></button>
      <span className="w-8 text-center text-sm font-bold">{inCart}</span>
      <button type="button" className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-40" disabled={inCart >= max} onClick={() => add(p.id, 1)} aria-label="More"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

export function ProductCard({ p, onOpen }) {
  const db = useDB();
  const farm = useCartFarm();
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const sold = p.farmIds.includes(farm.id);
  const st = productStock(db, p.id, farm.id);
  const inCart = lines.find((l) => l.productId === p.id)?.qty || 0;
  const avail = sold ? st.available : 0;
  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-cream-200 transition hover:-translate-y-0.5 hover:shadow-lift dark:bg-navy-900 dark:ring-white/5">
      <button type="button" onClick={() => onOpen?.(p)} className="relative">
        <ProductImage p={p} className="aspect-square w-full" rounded="rounded-none" />
        {p.wholesalePrice && <Badge tone="gold" className="absolute left-3 top-3">Bulk deal</Badge>}
      </button>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{categoryLabel(p.category)}</p>
        <button type="button" onClick={() => onOpen?.(p)} className="mt-0.5 text-left font-bold leading-snug text-slate-900 dark:text-white">{p.name}</button>
        <p className="mt-1 text-lg font-extrabold text-brand-800 dark:text-gold-400">{money(p.price)}<span className="text-xs font-medium text-slate-400"> / {p.unit}</span></p>
        <p className={cx('text-xs', avail ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent-600')}>{!sold ? `Not sold at ${farm.short}` : avail ? `${num(avail)} available` : 'Sold out at this farm'}</p>
        <div className="mt-auto pt-3">
          {inCart ? <QtyControl p={p} inCart={inCart} max={avail} /> : (
            <Button size="sm" className="w-full" icon={ShoppingBasket} disabled={!avail} onClick={() => { add(p.id, p.wholesaleMin && p.category === 'chicks' ? 50 : 1); toast.success('Added to basket', p.name); }}>Add</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Shop() {
  const db = useDB();
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') || 'all';
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const farm = useCartFarm();
  const lines = useCart((s) => s.lines);
  const { add, setQty } = useCart();
  const list = db.products.filter((p) => p.onPortal && p.active !== false && (cat === 'all' || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.farmIds.includes(farm.id)) - Number(a.farmIds.includes(farm.id)));
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const inCart = open ? lines.find((l) => l.productId === open.id)?.qty || 0 : 0;
  const st = open ? productStock(db, open.id, farm.id) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-brand-900 dark:text-white">Shop</h1>
      <p className="mt-1 text-slate-500">Book now, pay a {db.settings.depositPct}% deposit, collect on your chosen day.</p>
      <div className="sticky top-16 z-20 -mx-4 mt-6 space-y-3 bg-cream-100/90 px-4 py-3 backdrop-blur dark:bg-navy-950/90 sm:-mx-6 sm:px-6">
        <FarmPicker />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search eggs, chicken, chicks…" className="sm:w-72" />
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
            {[{ value: 'all', label: 'Everything', emoji: '✨' }, ...PRODUCT_CATEGORIES].map((c) => (
              <button key={c.value} type="button" onClick={() => setParams(c.value === 'all' ? {} : { cat: c.value })} className={cx('whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition', cat === c.value ? 'bg-accent-600 text-white' : 'bg-white text-slate-600 ring-1 ring-cream-300 dark:bg-navy-900 dark:text-slate-300 dark:ring-white/10')}>{c.emoji} {c.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{list.map((p) => <ProductCard key={p.id} p={p} onOpen={setOpen} />)}</div>
      {count > 0 && (
        <Link to="/cart" className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-brand-800 px-5 py-4 text-white shadow-lift">
          <span className="flex items-center gap-2 font-semibold"><ShoppingBasket className="h-5 w-5" /> {count} in basket</span>
          <span className="font-bold">Checkout →</span>
        </Link>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.name} size="lg">
        {open && (
          <div className="grid gap-6 sm:grid-cols-2">
            <ProductImage p={open} className="aspect-square w-full" />
            <div>
              <p className="text-2xl font-extrabold text-brand-800 dark:text-gold-400">{money(open.price)} <span className="text-sm font-medium text-slate-400">/ {open.unit}</span></p>
              {open.wholesalePrice && <p className="mt-1 text-sm font-semibold text-gold-700">{money(open.wholesalePrice)} each when you buy {num(open.wholesaleMin)} or more</p>}
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{open.description}</p>
              <p className="mt-4 text-sm"><b>{num(open.farmIds.includes(farm.id) ? st.available : 0)}</b> available at {farm.name}</p>
              <p className="text-xs text-slate-500">Also at: {open.farmIds.filter((f) => f !== farm.id).map((f) => db.farms.find((x) => x.id === f)?.short).join(', ') || '—'}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl bg-cream-200 p-1 dark:bg-white/10">
                  <button type="button" className="rounded-lg p-2" onClick={() => setQty(open.id, inCart - 1)} aria-label="Less"><Minus className="h-4 w-4" /></button>
                  <input className="w-14 bg-transparent text-center font-bold" inputMode="numeric" value={inCart} onChange={(e) => setQty(open.id, Math.min(st.available, +e.target.value.replace(/\D/g, '') || 0))} />
                  <button type="button" className="rounded-lg p-2" disabled={inCart >= st.available} onClick={() => add(open.id, 1)} aria-label="More"><Plus className="h-4 w-4" /></button>
                </div>
                <p className="text-sm text-slate-500">= <b className="text-slate-900 dark:text-white">{money(unitPrice(open, inCart) * inCart)}</b></p>
              </div>
              <Link to="/cart"><Button className="mt-5 w-full" icon={inCart ? Check : ShoppingBasket} disabled={!inCart}>{inCart ? 'Go to checkout' : 'Choose a quantity'}</Button></Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
