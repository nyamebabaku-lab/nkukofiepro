import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Wallet, ShoppingBag, HandCoins, CalendarClock, Pencil, KeyRound } from 'lucide-react';
import { LIVE } from '../../config';
import { ChangePasswordModal } from '../live/Passwords';
import { useDB } from '../../data/store';
import { useCurrentCustomer, notificationsFor } from '../../data/selectors';
import { Button, Card, CardHeader, Badge, FormModal, toast } from '../../components/ui';
import PayModal from '../../components/PayModal';
import { NotificationList } from '../notifications/Notifications';
import { customerAccount, payDebts, ORDER_STATUS } from '../../lib/orders';
import { money, fmtDate } from '../../lib/format';

export default function Account() {
  const db = useDB();
  const c = useCurrentCustomer();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pw, setPw] = useState(false);
  if (!c) return <Navigate to="/login" replace state={{ customer: true, from: '/account' }} />;
  const acc = customerAccount(db, c.id);
  const upcoming = acc.orders.filter((o) => ['booked', 'ready'].includes(o.status)).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  const notes = notificationsFor(null, c, db.notifications);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">My account</p>
          <h1 className="font-display text-4xl font-semibold text-brand-900 dark:text-white">Hello, {c.name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500">{c.phone} · {c.location}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>Edit profile</Button>{LIVE && <Button variant="secondary" icon={KeyRound} onClick={() => setPw(true)}>Change password</Button>}<Link to="/shop"><Button icon={ShoppingBag}>Shop</Button></Link></div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="grain hero-glow relative overflow-hidden rounded-3xl bg-brand-800 p-6 text-white shadow-lift md:col-span-1">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-gold-300"><HandCoins className="h-4 w-4" /> You owe</p>
          <p className="mt-2 font-display text-4xl font-semibold">{money(acc.debt)}</p>
          <p className="text-sm text-brand-100/80">{acc.debt > 0 ? `From ${acc.debts.length} collected order${acc.debts.length === 1 ? '' : 's'}` : 'All paid up — thank you!'}</p>
          {acc.debt > 0 && <Button className="mt-5 bg-gold-500 text-brand-950 hover:bg-gold-400" icon={Wallet} onClick={() => setPaying(true)}>Pay now</Button>}
        </div>
        <Card className="p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><CalendarClock className="h-4 w-4" /> Due at pick-up</p><p className="mt-2 text-3xl font-extrabold">{money(acc.dueAtPickup)}</p><p className="text-sm text-slate-500">{upcoming.length} upcoming order{upcoming.length === 1 ? '' : 's'}</p></Card>
        <Card className="p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Wallet className="h-4 w-4" /> Credit</p><p className="mt-2 text-3xl font-extrabold">{money(acc.credit)}</p><p className="text-sm text-slate-500">Bought {money(acc.spent)} in total</p></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {acc.debts.length > 0 && (
            <Card>
              <CardHeader title="Unpaid balances" subtitle="Oldest are paid first" />
              <div className="divide-y divide-cream-200 px-5 pb-3 dark:divide-white/5">
                {acc.debts.map((d) => (
                  <div key={d.order.id} className="flex items-center justify-between py-3 text-sm">
                    <div><p className="font-semibold">{d.order.ref}</p><p className="text-xs text-slate-500">Collected {fmtDate(d.order.pickedAt)} · {d.age} days ago</p></div>
                    <p className="font-bold text-accent-600">{money(d.balance)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Upcoming pick-ups" action={<Link to="/account/orders" className="text-xs font-semibold text-brand-700 dark:text-gold-400">All orders</Link>} />
            <div className="space-y-2 p-4">
              {!upcoming.length && <p className="text-sm text-slate-500">No upcoming pick-ups. <Link to="/shop" className="font-semibold text-brand-700 dark:text-gold-400">Book an order</Link></p>}
              {upcoming.map((o) => (
                <button key={o.id} type="button" onClick={() => navigate('/account/orders', { state: { open: o.id } })} className="flex w-full items-center gap-3 rounded-2xl border border-cream-200 p-3 text-left hover:border-brand-300 dark:border-white/10">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300"><span className="text-[10px] font-bold uppercase">{fmtDate(o.pickupDate, 'MMM')}</span><span className="text-lg font-extrabold leading-none">{fmtDate(o.pickupDate, 'd')}</span></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold">{o.ref} · {db.farms.find((f) => f.id === o.farmId)?.short}</p><p className="truncate text-xs text-slate-500">{o.lines.map((l) => `${l.qty} ${l.name.split(' —')[0]}`).join(', ')}</p></div>
                  <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                </button>
              ))}
            </div>
          </Card>
        </div>
        <Card className="overflow-hidden">
          <CardHeader title="Messages" subtitle={`${notes.filter((n) => !n.read).length} new`} />
          <NotificationList list={notes} onOpen={(n) => { db.markRead([n.id]); if (n.link && n.link !== '/account') navigate(n.link); }} />
        </Card>
      </div>
      <PayModal open={paying} onClose={() => setPaying(false)} title="Pay your balance" subtitle={`You owe ${money(acc.debt)}`} amount={acc.debt} max={acc.debt} phone={c.phone} methods={['mtn', 'telecel', 'at', 'card']} onPaid={({ method, account, amount }) => payDebts(c.id, amount, method, account)} />
      {LIVE && <ChangePasswordModal open={pw} onClose={() => setPw(false)} />}
      <FormModal open={edit} onClose={() => setEdit(false)} title="Edit profile" initial={c} fields={[{ name: 'name', label: 'Name', required: true, span: 2 }, { name: 'email', label: 'Email' }, { name: 'location', label: 'Area' }, ...(LIVE ? [] : [{ name: 'password', label: 'Password', type: 'password', required: true }])]} onSubmit={(v) => { db.update('customers', c.id, { name: v.name, email: v.email, location: v.location, ...(LIVE ? {} : { password: v.password }) }); toast.success('Profile saved'); setEdit(false); }} />
    </div>
  );
}
