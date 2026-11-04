import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wallet, Send, Pencil, FileText, Phone, Mail, MapPin, Store, Printer } from 'lucide-react';
import { useDB } from '../../data/store';
import { PageHeader, Button, Card, CardHeader, StatCard, Badge, DataTable, Avatar, FormModal, Modal, EmptyState, toast, printElement } from '../../components/ui';
import PayModal from '../../components/PayModal';
import Logo from '../../components/layout/Logo';
import { customerAccount, orderMoney, payDebts, ORDER_STATUS, PAY_STATE } from '../../lib/orders';
import { methodLabel } from '../../lib/payments';
import { money, fmtDate, fmtDateTime, today } from '../../lib/format';
import { CUSTOMER_TYPES, typeLabel, remind } from './Customers';

/** Running statement: orders picked up are charges, payments are credits. */
export function statementRows(db, customerId) {
  const charges = db.orders.filter((o) => o.customerId === customerId && o.status === 'picked').map((o) => ({ date: o.pickedAt || o.createdAt, text: `Order ${o.ref}`, debit: o.total, credit: 0 }));
  const pays = db.payments
    .filter((p) => p.customerId === customerId && p.status === 'success')
    .filter((p) => { const o = db.orders.find((x) => x.id === p.orderId); return !o || o.status === 'picked'; })
    .map((p) => ({ date: p.at, text: `${p.amount < 0 ? 'Refund' : 'Payment'} · ${methodLabel(p.method)}`, debit: 0, credit: p.amount }));
  let bal = 0;
  return [...charges, ...pays].sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ ...r, balance: (bal += r.debit - r.credit) }));
}

export default function CustomerDetail() {
  const { id } = useParams();
  const db = useDB();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stmt, setStmt] = useState(false);
  const c = db.customers.find((x) => x.id === id);
  if (!c) return <EmptyState title="Customer not found" action={<Link to="/app/customers"><Button variant="secondary">Back</Button></Link>} />;
  const acc = customerAccount(db, c.id);
  const orders = [...acc.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pays = db.payments.filter((p) => p.customerId === c.id && p.status === 'success').sort((a, b) => b.at.localeCompare(a.at));
  const rows = statementRows(db, c.id);

  return (
    <div>
      <Link to="/app/customers" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Customers</Link>
      <PageHeader
        title={c.name}
        subtitle={`${typeLabel(c.type)} · customer since ${fmtDate(c.createdAt, 'MMM yyyy')}`}
        actions={
          <>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="secondary" icon={FileText} onClick={() => setStmt(true)}>Statement</Button>
            {acc.debt > 0 && <Button variant="secondary" icon={Send} onClick={() => { remind(useDB.getState(), c, acc.debt); toast.success('Reminder sent by SMS'); }}>Remind</Button>}
            <Button variant="secondary" icon={Store} onClick={() => navigate('/app/pos')}>New sale</Button>
            {acc.debt > 0 && <Button icon={Wallet} onClick={() => setPaying(true)}>Receive payment</Button>}
          </>
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3"><Avatar name={c.name} size="lg" /><div><p className="font-bold text-slate-900 dark:text-white">{c.name}</p><Badge tone={c.type === 'trader' ? 'gold' : 'slate'}>{typeLabel(c.type)}</Badge></div></div>
          <div className="mt-4 space-y-2 text-sm">
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Phone className="h-4 w-4 text-slate-400" /> {c.phone}</a>
            {c.email && <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Mail className="h-4 w-4 text-slate-400" /> {c.email}</p>}
            {c.location && <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><MapPin className="h-4 w-4 text-slate-400" /> {c.location}</p>}
          </div>
          {c.notes && <p className="mt-4 rounded-xl bg-cream-100 p-3 text-sm dark:bg-white/5">{c.notes}</p>}
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Owes (debt)" value={money(acc.debt)} tone="red" sub={acc.debts[0] ? `oldest ${acc.debts[0].age} days` : 'nothing overdue'} />
          <StatCard label="Due at pick-up" value={money(acc.dueAtPickup)} tone="gold" sub="on open bookings" />
          <StatCard label="Credit" value={money(acc.credit)} tone="teal" sub="kept from cancelled orders" />
          <StatCard label="Bought in total" value={money(acc.spent)} tone="brand" sub={`${acc.orders.filter((o) => o.status === 'picked').length} orders`} />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <DataTable
          rows={orders}
          onRowClick={(o) => navigate(`/app/orders/${o.id}`)}
          search={false}
          columns={[
            { key: 'ref', label: 'Order', render: (o) => <div><p className="font-bold">{o.ref}</p><p className="text-xs text-slate-400">{fmtDate(o.createdAt)}</p></div> },
            { key: 'items', label: 'Items', nosort: true, render: (o) => <p className="max-w-[220px] truncate text-xs">{o.lines.map((l) => `${l.qty} ${l.name.split(' —')[0]}`).join(', ')}</p>, hideOnMobile: true },
            { key: 'total', label: 'Total', render: (o) => money(o.total) },
            { key: 'pay', label: 'Paid', render: (o) => { const m = orderMoney(db, o); return o.status === 'cancelled' ? '—' : <Badge tone={PAY_STATE[m.state].tone}>{m.balance > 0 ? `${money(m.balance)} due` : 'Paid'}</Badge>; } },
            { key: 'status', label: 'Status', render: (o) => <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge> },
          ]}
        />
        <Card>
          <CardHeader title="Payments" icon={Wallet} />
          <div className="max-h-[520px] space-y-2 overflow-y-auto p-4">
            {!pays.length && <p className="text-sm text-slate-500">No payments yet.</p>}
            {pays.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2 dark:bg-white/5">
                <div><p className="text-sm font-semibold">{methodLabel(p.method)}</p><p className="text-xs text-slate-500">{fmtDateTime(p.at)}</p></div>
                <p className={p.amount < 0 ? 'font-bold text-accent-600' : 'font-bold text-emerald-700 dark:text-emerald-400'}>{money(p.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <PayModal
        open={paying}
        onClose={() => setPaying(false)}
        title={`Payment from ${c.name}`}
        subtitle={`Owes ${money(acc.debt)} — oldest debts are cleared first`}
        amount={acc.debt}
        max={acc.debt}
        phone={c.phone}
        methods={['cash', 'mtn', 'telecel', 'at', 'card']}
        onPaid={({ method, account, amount }) => payDebts(c.id, amount, method, account)}
      />
      <FormModal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit customer"
        initial={c}
        fields={[
          { name: 'name', label: 'Name', required: true, span: 2 },
          { name: 'phone', label: 'Phone', required: true },
          { name: 'email', label: 'Email' },
          { name: 'type', label: 'Type', type: 'select', options: CUSTOMER_TYPES },
          { name: 'location', label: 'Area' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onSubmit={(v) => { db.update('customers', c.id, v); toast.success('Saved'); setEditing(false); }}
      />
      <Modal open={stmt} onClose={() => setStmt(false)} title="Customer statement" size="lg" footer={<Button icon={Printer} onClick={() => printElement('stmt', `Statement ${c.name}`)}>Print / save PDF</Button>}>
        <div id="stmt" className="text-sm">
          <div className="flex items-start justify-between border-b border-cream-200 pb-4"><Logo /><div className="text-right"><p className="font-display text-xl font-semibold">Statement</p><p className="text-xs text-slate-500">{fmtDate(today())}</p></div></div>
          <p className="mt-4 font-semibold">{c.name}</p><p className="text-xs text-slate-500">{c.phone} · {c.location}</p>
          <table className="mt-4 w-full">
            <thead><tr className="border-y border-cream-200 text-left text-xs uppercase text-slate-400"><th className="py-2">Date</th><th className="py-2">Details</th><th className="py-2 text-right">Charge</th><th className="py-2 text-right">Paid</th><th className="py-2 text-right">Balance</th></tr></thead>
            <tbody>{rows.slice(-40).map((r, i) => <tr key={i} className="border-b border-cream-100"><td className="py-1.5">{fmtDate(r.date, 'd MMM yy')}</td><td className="py-1.5">{r.text}</td><td className="py-1.5 text-right">{r.debit ? money(r.debit) : ''}</td><td className="py-1.5 text-right">{r.credit ? money(r.credit) : ''}</td><td className="py-1.5 text-right font-semibold">{money(r.balance)}</td></tr>)}</tbody>
          </table>
          <p className="mt-4 text-right text-base font-bold">Amount owed: {money(acc.debt)}</p>
        </div>
      </Modal>
    </div>
  );
}
