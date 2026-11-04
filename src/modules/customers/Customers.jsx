import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, HandCoins, Users, Clock, Send } from 'lucide-react';
import { useDB } from '../../data/store';
import { useInScope } from '../../data/selectors';
import { PageHeader, Button, Tabs, DataTable, Badge, StatCard, Card, CardHeader, FormModal, Avatar, toast } from '../../components/ui';
import { Bars } from '../../components/charts';
import { customerAccount, debtAgeing } from '../../lib/orders';
import { money, moneyShort, fmtDate, sum } from '../../lib/format';

export const CUSTOMER_TYPES = [{ value: 'retail', label: 'Household' }, { value: 'trader', label: 'Trader' }, { value: 'business', label: 'Business' }];
export const typeLabel = (v) => CUSTOMER_TYPES.find((t) => t.value === v)?.label || v;

export function remind(db, c, amount) {
  db.sms(c.phone, `PoultryPro: Hello ${c.name}, you have an outstanding balance of ${money(amount)}. Pay any time with MoMo or card in the PoultryPro shop. Thank you!`);
  db.notify({ toCustomerId: c.id, title: 'Balance reminder', text: `You owe ${money(amount)}. Tap to pay with MoMo or card.`, link: '/account' });
  db.log('Debt reminder sent', `${c.name} · ${money(amount)}`);
}

export default function Customers() {
  const db = useDB();
  const inScope = useInScope();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'all';
  const [adding, setAdding] = useState(false);
  const rows = useMemo(() => db.customers.map((c) => ({ ...c, acc: customerAccount(db, c.id) })), [db]);
  const ageing = debtAgeing(db, 'all');
  const scopedAgeing = { ...ageing, rows: ageing.rows.filter((r) => inScope(r.order.farmId)) };
  const debtors = rows.filter((r) => r.acc.debt > 0).sort((a, b) => b.acc.debt - a.acc.debt);

  const remindAll = () => {
    debtors.forEach((c) => remind(useDB.getState(), c, c.acc.debt));
    toast.success('Reminders sent', `${debtors.length} customers got an SMS`);
  };

  return (
    <div>
      <PageHeader title="Customers & debts" subtitle="Who buys from you, what they owe and how long it has been owed" actions={<Button icon={UserPlus} onClick={() => setAdding(true)}>Add customer</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Customers" value={rows.length} icon={Users} tone="brand" sub={`${rows.filter((r) => r.type === 'trader').length} traders · ${rows.filter((r) => r.type === 'business').length} businesses`} />
        <StatCard label="Total owed to you" value={money(scopedAgeing.rows.reduce((a, r) => a + r.balance, 0))} icon={HandCoins} tone="red" sub={`${debtors.length} customers`} onClick={() => setParams({ tab: 'debts' })} />
        <StatCard label="Owed over 60 days" value={money(ageing.buckets[2].amount)} icon={Clock} tone="orange" sub={`${ageing.buckets[2].count} orders`} />
        <StatCard label="Credit held" value={money(sum(rows, (r) => r.acc.credit))} icon={HandCoins} tone="teal" sub="deposits kept on cancelled orders" />
      </div>
      <Tabs className="mb-4" value={tab} onChange={(v) => setParams({ tab: v })} tabs={[{ value: 'all', label: 'All customers' }, { value: 'debts', label: 'Debts', count: debtors.length }]} />
      {tab === 'all' && (
        <DataTable
          rows={rows}
          onRowClick={(c) => navigate(`/app/customers/${c.id}`)}
          searchText={(c) => `${c.name} ${c.phone} ${c.location}`}
          initialSort={{ key: 'spent', dir: 'desc' }}
          columns={[
            { key: 'name', label: 'Customer', render: (c) => <div className="flex items-center gap-3"><Avatar name={c.name} size="sm" /><div><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-400">{c.phone}</p></div></div> },
            { key: 'type', label: 'Type', render: (c) => <Badge tone={c.type === 'trader' ? 'gold' : c.type === 'business' ? 'sky' : 'slate'}>{typeLabel(c.type)}</Badge> },
            { key: 'location', label: 'Area', hideOnMobile: true },
            { key: 'orders', label: 'Orders', sort: (c) => c.acc.orders.length, render: (c) => c.acc.orders.length, hideOnMobile: true },
            { key: 'spent', label: 'Bought', sort: (c) => c.acc.spent, render: (c) => money(c.acc.spent) },
            { key: 'debt', label: 'Owes', sort: (c) => c.acc.debt, render: (c) => (c.acc.debt > 0 ? <b className="text-accent-600">{money(c.acc.debt)}</b> : <span className="text-slate-400">—</span>) },
          ]}
        />
      )}
      {tab === 'debts' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Card>
              <CardHeader title="Debt by age" subtitle="How long balances have been unpaid since pick-up" />
              <div className="px-3 pb-4"><Bars data={ageing.buckets.map((b) => ({ day: b.label, amount: Math.round(b.amount) }))} series={[{ key: 'amount', name: 'Owed', color: '#c8643b' }]} fmt={(v) => money(v)} yFmt={(v) => moneyShort(v).replace('GH₵ ', '')} height={220} /></div>
            </Card>
            <Card>
              <CardHeader title="Biggest balances" action={<Button size="sm" variant="soft" icon={Send} onClick={remindAll}>Remind all by SMS</Button>} />
              <div className="divide-y divide-cream-200 px-2 pb-2 dark:divide-white/5">
                {debtors.slice(0, 6).map((c) => (
                  <button key={c.id} type="button" onClick={() => navigate(`/app/customers/${c.id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream-100 dark:hover:bg-white/5">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.name}</p><p className="text-xs text-slate-500">Oldest {c.acc.debts[0]?.age} days · {c.acc.debts.length} order{c.acc.debts.length === 1 ? '' : 's'}</p></div>
                    <p className="font-bold text-accent-600">{money(c.acc.debt)}</p>
                  </button>
                ))}
              </div>
            </Card>
          </div>
          <DataTable
            rows={scopedAgeing.rows}
            onRowClick={(r) => navigate(`/app/orders/${r.order.id}`)}
            searchText={(r) => `${r.order.ref} ${r.order.customerName}`}
            initialSort={{ key: 'age', dir: 'desc' }}
            columns={[
              { key: 'ref', label: 'Order', sort: (r) => r.order.ref, render: (r) => <b>{r.order.ref}</b> },
              { key: 'cust', label: 'Customer', sort: (r) => r.order.customerName, render: (r) => r.order.customerName },
              { key: 'picked', label: 'Picked up', sort: (r) => r.order.pickedAt, render: (r) => fmtDate(r.order.pickedAt) },
              { key: 'total', label: 'Order total', sort: (r) => r.order.total, render: (r) => money(r.order.total), hideOnMobile: true },
              { key: 'balance', label: 'Owed', render: (r) => <b className="text-accent-600">{money(r.balance)}</b> },
              { key: 'age', label: 'Age', render: (r) => <Badge tone={r.age > 60 ? 'red' : r.age > 30 ? 'orange' : 'amber'}>{r.age} days</Badge> },
            ]}
          />
        </div>
      )}
      <FormModal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add customer"
        subtitle="They can sign in to the shop with this phone number"
        initial={{ type: 'retail', password: 'demo123' }}
        fields={[
          { name: 'name', label: 'Name / business', required: true, span: 2 },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'type', label: 'Type', type: 'select', options: CUSTOMER_TYPES, required: true },
          { name: 'location', label: 'Area' },
          { name: 'password', label: 'Shop password', hint: 'Share it with the customer' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        onSubmit={(v) => {
          const phone = v.phone.replace(/\s/g, '');
          if (db.customers.some((c) => c.phone === phone)) return toast.error('That phone number is already a customer');
          const c = db.add('customers', { ...v, phone });
          toast.success('Customer added');
          setAdding(false);
          navigate(`/app/customers/${c.id}`);
          return null;
        }}
      />
    </div>
  );
}
