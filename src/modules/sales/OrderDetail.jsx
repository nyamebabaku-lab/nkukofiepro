import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, PackageCheck, Truck, XCircle, Wallet, MessageCircle, CalendarClock, AlertTriangle } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { PageHeader, Button, Card, CardHeader, Badge, KeyValue, EmptyState, Modal, Field, Input, Segmented, confirmDialog, toast, printElement } from '../../components/ui';
import PayModal from '../../components/PayModal';
import Logo from '../../components/layout/Logo';
import { ORDER_STATUS, PAY_STATE, orderMoney, setOrderStatus, recordPayment, withdrawalWarning, pickupCheck } from '../../lib/orders';
import { methodLabel } from '../../lib/payments';
import { money, fmtDate, fmtDateTime, num } from '../../lib/format';
import { appName, smsPrefix } from '../../lib/brand';

/** Printable receipt / invoice body. */
export function Receipt({ o, db }) {
  const m = orderMoney(db, o);
  const farm = db.farms.find((f) => f.id === o.farmId);
  const pays = db.payments.filter((p) => p.orderId === o.id && p.status === 'success');
  return (
    <div className="text-sm">
      <div className="flex items-start justify-between gap-4 border-b border-cream-200 pb-4 dark:border-white/10">
        <div>
          <Logo farm />
          <p className="mt-2 text-xs text-slate-500">{db.settings.businessName} · {farm?.name}<br />{farm?.location} · {farm?.phone}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold">{m.state === 'paid' ? 'Receipt' : 'Invoice'}</p>
          <p className="font-bold">{o.ref}</p>
          <p className="text-xs text-slate-500">{fmtDate(o.createdAt)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 py-4 text-xs">
        <div><p className="font-semibold uppercase tracking-wide text-slate-400">Customer</p><p className="mt-1 text-sm font-semibold">{o.customerName}</p><p>{o.phone}</p></div>
        <div className="text-right"><p className="font-semibold uppercase tracking-wide text-slate-400">Pick-up</p><p className="mt-1 text-sm font-semibold">{fmtDate(o.pickupDate, 'EEE d MMM yyyy')}</p><p>{db.settings.pickupHours}</p></div>
      </div>
      <table className="w-full">
        <thead><tr className="border-y border-cream-200 text-left text-xs uppercase text-slate-400 dark:border-white/10"><th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Amount</th></tr></thead>
        <tbody>
          {o.lines.map((l) => (
            <tr key={l.productId} className="border-b border-cream-100 dark:border-white/5"><td className="py-2">{l.name}</td><td className="py-2 text-right">{num(l.qty)} {l.unit}</td><td className="py-2 text-right">{money(l.price)}</td><td className="py-2 text-right font-semibold">{money(l.amount)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto mt-3 w-64 space-y-1">
        {o.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>−{money(o.discount)}</span></div>}
        <div className="flex justify-between text-base font-bold"><span>Total</span><span>{money(o.total)}</span></div>
        {pays.map((p) => <div key={p.id} className="flex justify-between text-xs text-slate-500"><span>{p.amount < 0 ? 'Refund' : 'Paid'} · {methodLabel(p.method)} · {fmtDate(p.at, 'd MMM')}</span><span>{money(p.amount)}</span></div>)}
        <div className="flex justify-between border-t border-cream-200 pt-1 font-bold dark:border-white/10"><span>Balance</span><span>{money(m.balance)}</span></div>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Thank you for buying from {db.settings.businessName}! · {db.settings.phone}</p>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const db = useDB();
  const user = useCurrentUser();
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [moving, setMoving] = useState(null);
  const [cancel, setCancel] = useState(null);
  const o = db.orders.find((x) => x.id === id);
  if (!o) return <EmptyState title="Order not found" action={<Link to="/app/orders"><Button variant="secondary">Back to orders</Button></Link>} />;
  const m = orderMoney(db, o);
  const farm = db.farms.find((f) => f.id === o.farmId);
  const pays = db.payments.filter((p) => p.orderId === o.id).sort((a, b) => a.at.localeCompare(b.at));
  const warnings = o.lines.map((l) => withdrawalWarning(db, db.products.find((p) => p.id === l.productId) || {}, o.farmId)).filter(Boolean);
  const open = ['booked', 'ready'].includes(o.status);
  const canManage = user.role !== 'worker';

  const pickUp = async () => {
    if (m.balance > 0 && !o.customerId) {
      toast.error('Balance must be paid', 'Walk-in customers must pay in full. Take the payment first.');
      return setPaying(true);
    }
    if (m.balance > 0 && !(await confirmDialog('Hand over with a balance?', `${o.customerName} still owes ${money(m.balance)}. It will be recorded as a debt on their account.`, { danger: false, confirmLabel: 'Yes, record as debt' }))) return null;
    setOrderStatus(o.id, 'picked');
    toast.success('Marked as picked up');
    return null;
  };
  const share = () => {
    const text = `Hello ${o.customerName}, your ${appName()} order ${o.ref} (${money(o.total)}) is ${ORDER_STATUS[o.status].label.toLowerCase()} at ${farm?.name}. ${m.balance > 0 ? `Balance: ${money(m.balance)}. ` : ''}Pick-up: ${fmtDate(o.pickupDate)}.`;
    window.open(`https://wa.me/233${o.phone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <div>
      <Link to="/app/orders" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Orders</Link>
      <PageHeader
        title={`Order ${o.ref}`}
        subtitle={`${o.customerName} · ${farm?.name} · ${o.channel === 'portal' ? 'Booked online' : 'At the farm'}`}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => setReceipt(true)}>{m.state === 'paid' ? 'Receipt' : 'Invoice'}</Button>
            {o.phone && <Button variant="secondary" icon={MessageCircle} onClick={share}>WhatsApp</Button>}
            {m.balance > 0 && o.status !== 'cancelled' && <Button variant="secondary" icon={Wallet} onClick={() => setPaying(true)}>Take payment</Button>}
            {o.status === 'booked' && <Button variant="secondary" icon={PackageCheck} onClick={() => { setOrderStatus(o.id, 'ready'); toast.success('Customer told the order is ready'); }}>Mark ready</Button>}
            {open && <Button icon={Truck} onClick={pickUp}>Picked up</Button>}
          </>
        }
      >
        <div className="mt-2 flex flex-wrap gap-2"><Badge tone={ORDER_STATUS[o.status].tone} dot>{ORDER_STATUS[o.status].label}</Badge>{o.status !== 'cancelled' && <Badge tone={PAY_STATE[m.state].tone}>{PAY_STATE[m.state].label}</Badge>}{o.pickupDate < new Date().toISOString().slice(0, 10) && open && <Badge tone="red">Missed pick-up</Badge>}</div>
      </PageHeader>
      {warnings.length > 0 && open && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>{warnings[0]}</p></div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Items" />
          <div className="divide-y divide-cream-200 px-5 dark:divide-white/5">
            {o.lines.map((l) => (
              <div key={l.productId} className="flex items-center justify-between gap-3 py-3">
                <div><p className="font-semibold text-slate-800 dark:text-white">{l.name}</p><p className="text-xs text-slate-500">{num(l.qty)} {l.unit} × {money(l.price)}</p></div>
                <p className="font-bold">{money(l.amount)}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 border-t border-cream-200 px-5 py-4 text-sm dark:border-white/5">
            {o.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>−{money(o.discount)}</span></div>}
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{money(o.total)}</span></div>
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Paid</span><span>{money(m.paid)}</span></div>
            <div className="flex justify-between text-lg font-extrabold"><span>Balance</span><span className={m.balance > 0 ? 'text-accent-600' : ''}>{money(m.balance)}</span></div>
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <KeyValue items={[['Customer', o.customerId ? <Link to={`/app/customers/${o.customerId}`} className="text-brand-700 hover:underline dark:text-gold-400">{o.customerName}</Link> : o.customerName], ['Phone', o.phone], ['Pick-up date', fmtDate(o.pickupDate, 'EEE d MMM yyyy')], ['Farm', farm?.name], ['Booked', fmtDateTime(o.createdAt)], ['Picked up', o.pickedAt ? fmtDateTime(o.pickedAt) : '—'], ['Taken by', o.by], ['Note', o.note]]} />
            {open && canManage && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={CalendarClock} onClick={() => setMoving(o.pickupDate)}>Change date</Button>
                <Button size="sm" variant="soft-red" icon={XCircle} onClick={() => setCancel({ refund: m.paid > 0 ? 'yes' : 'no' })}>Cancel order</Button>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Payments" subtitle={`${pays.length} transaction${pays.length === 1 ? '' : 's'}`} icon={Wallet} />
            <div className="space-y-2 p-4">
              {!pays.length && <p className="text-sm text-slate-500">No payments yet.</p>}
              {pays.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2.5 dark:bg-white/5">
                  <div><p className="text-sm font-semibold">{methodLabel(p.method)} <span className="font-normal text-slate-400">· {p.kind}</span></p><p className="text-xs text-slate-500">{fmtDateTime(p.at)} · {p.ref}</p></div>
                  <p className={p.amount < 0 ? 'font-bold text-accent-600' : 'font-bold text-emerald-700 dark:text-emerald-400'}>{money(p.amount)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <PayModal
        open={paying}
        onClose={() => setPaying(false)}
        title={`Payment for ${o.ref}`}
        subtitle={`${o.customerName} · balance ${money(m.balance)}`}
        amount={m.balance}
        max={m.balance}
        phone={o.phone}
        methods={['cash', 'mtn', 'telecel', 'at', 'card']}
        onPaid={({ method, account, amount }) => recordPayment({ orderId: o.id, amount, method, account, kind: o.status === 'picked' ? 'debt' : 'balance' })}
      />
      <Modal open={receipt} onClose={() => setReceipt(false)} title={m.state === 'paid' ? 'Receipt' : 'Invoice'} size="lg" footer={<Button icon={Printer} onClick={() => printElement('print-area', o.ref)}>Print / save PDF</Button>}>
        <div id="print-area"><Receipt o={o} db={db} /></div>
      </Modal>
      <Modal open={!!moving} onClose={() => setMoving(null)} title="Change pick-up date" size="sm" footer={<Button onClick={() => { const c = pickupCheck(db, o.farmId, moving); if (!c.ok) return toast.error(c.reason); db.update('orders', o.id, { pickupDate: moving }); db.sms(o.phone, `${smsPrefix()}: Pick-up for ${o.ref} moved to ${fmtDate(moving)}.`); toast.success('Pick-up date changed', 'Customer notified by SMS'); setMoving(null); return null; }}>Save</Button>}>
        <Field label="New date"><Input type="date" value={moving || ''} onChange={(e) => setMoving(e.target.value)} /></Field>
      </Modal>
      <Modal open={!!cancel} onClose={() => setCancel(null)} title="Cancel this order?" size="sm" footer={<Button variant="danger" onClick={() => { setOrderStatus(o.id, 'cancelled', { refund: cancel.refund === 'yes', refundMethod: pays.find((p) => p.amount > 0)?.method }); toast.success('Order cancelled', cancel.refund === 'yes' ? `${money(m.paid)} refunded` : m.paid > 0 ? 'Payment kept as customer credit' : undefined); setCancel(null); }}>Cancel order</Button>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Reserved stock goes back on sale.</p>
        {m.paid > 0 && (
          <div className="mt-4">
            <span className="label">{money(m.paid)} was paid</span>
            <Segmented options={[{ value: 'yes', label: 'Refund it' }, { value: 'no', label: 'Keep as credit' }]} value={cancel?.refund} onChange={(v) => setCancel({ refund: v })} />
          </div>
        )}
      </Modal>
    </div>
  );
}
