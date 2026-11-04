import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Wallet, Printer, Check } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentCustomer } from '../../data/selectors';
import { Button, Card, Badge, Modal, Segmented, EmptyState, printElement, cx } from '../../components/ui';
import PayModal from '../../components/PayModal';
import { Receipt } from '../sales/OrderDetail';
import { ORDER_STATUS, PAY_STATE, orderMoney, recordPayment } from '../../lib/orders';
import { money, fmtDate } from '../../lib/format';

const STEPS = ['booked', 'ready', 'picked'];

export default function MyOrders() {
  const db = useDB();
  const c = useCurrentCustomer();
  const loc = useLocation();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(loc.state?.open || null);
  const [paying, setPaying] = useState(null);
  if (!c) return <Navigate to="/login" replace state={{ customer: true, from: '/account/orders' }} />;
  const orders = db.orders.filter((o) => o.customerId === c.id && (filter === 'all' || (filter === 'open' ? ['booked', 'ready'].includes(o.status) : o.status === filter))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sel = db.orders.find((o) => o.id === open);
  const payFor = db.orders.find((o) => o.id === paying);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-brand-900 dark:text-white">My orders</h1>
      <Segmented className="mt-5" options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Upcoming' }, { value: 'picked', label: 'Collected' }, { value: 'cancelled', label: 'Cancelled' }]} value={filter} onChange={setFilter} />
      <div className="mt-5 space-y-4">
        {!orders.length && <Card><EmptyState title="No orders here" /></Card>}
        {orders.map((o) => {
          const m = orderMoney(db, o);
          const step = STEPS.indexOf(o.status);
          return (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{o.ref} <span className="font-normal text-slate-400">· {fmtDate(o.createdAt)}</span></p>
                  <p className="text-sm text-slate-500">{o.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}</p>
                  <p className="mt-1 text-xs text-slate-500">Pick-up: <b>{db.farms.find((f) => f.id === o.farmId)?.name}</b> · {fmtDate(o.pickupDate, 'EEE d MMM')}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold">{money(o.total)}</p>
                  {o.status !== 'cancelled' && <Badge tone={PAY_STATE[m.state].tone}>{m.balance > 0 ? `${money(m.balance)} to pay` : 'Paid'}</Badge>}
                </div>
              </div>
              {o.status !== 'cancelled' ? (
                <div className="mt-5 flex items-center">
                  {STEPS.map((s, i) => (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center">
                        <span className={cx('flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold', i <= step ? 'bg-brand-700 text-white' : 'bg-cream-200 text-slate-400 dark:bg-white/10')}>{i <= step ? <Check className="h-4 w-4" /> : i + 1}</span>
                        <span className="mt-1 whitespace-nowrap text-[11px] font-semibold text-slate-500">{['Booked', 'Ready', 'Collected'][i]}</span>
                      </div>
                      {i < STEPS.length - 1 && <div className={cx('mx-2 mb-4 h-1 flex-1 rounded-full', i < step ? 'bg-brand-700' : 'bg-cream-200 dark:bg-white/10')} />}
                    </div>
                  ))}
                </div>
              ) : (
                <Badge tone="slate" className="mt-3">{ORDER_STATUS.cancelled.label}</Badge>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {m.balance > 0 && o.status !== 'cancelled' && <Button size="sm" icon={Wallet} onClick={() => setPaying(o.id)}>Pay {money(m.balance)}</Button>}
                <Button size="sm" variant="secondary" icon={Printer} onClick={() => setOpen(o.id)}>{m.state === 'paid' ? 'Receipt' : 'Invoice'}</Button>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal open={!!sel} onClose={() => setOpen(null)} title={sel?.ref} size="lg" footer={<Button icon={Printer} onClick={() => printElement('cust-receipt', sel?.ref)}>Print / save PDF</Button>}>
        {sel && <div id="cust-receipt"><Receipt o={sel} db={db} /></div>}
      </Modal>
      {payFor && (
        <PayModal open onClose={() => setPaying(null)} title={`Pay for ${payFor.ref}`} amount={orderMoney(db, payFor).balance} max={orderMoney(db, payFor).balance} phone={c.phone} methods={['mtn', 'telecel', 'at', 'card']} onPaid={({ method, account, amount }) => recordPayment({ orderId: payFor.id, customerId: c.id, amount, method, account, kind: payFor.status === 'picked' ? 'debt' : 'balance' })} />
      )}
    </div>
  );
}
