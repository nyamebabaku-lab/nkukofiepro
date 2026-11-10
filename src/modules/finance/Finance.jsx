import { useMemo, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Scale, Download, Receipt } from 'lucide-react';
import { useDB } from '../../data/store';
import { useFarmScope, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, CardHeader, StatCard, DataTable, Badge, Tabs, Segmented, FormModal, toast } from '../../components/ui';
import { Bars, Donut } from '../../components/charts';
import { addExpense, EXPENSE_CATEGORIES, expenseLabel } from '../../lib/wallet';
import { categoryLabel } from '../../lib/stock';
import { money, moneyShort, fmtDate, today, dayKey, sum, downloadCSV } from '../../lib/format';
import { appName } from '../../lib/brand';

const PERIODS = [{ value: 30, label: '30 days' }, { value: 60, label: '60 days' }, { value: 90, label: '90 days' }];

export default function Finance() {
  const db = useDB();
  const scope = useFarmScope();
  const inScope = useInScope();
  const farms = useMyFarms();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('pl');
  const [adding, setAdding] = useState(false);
  const from = dayKey(-days + 1);
  const prod = useMemo(() => new Map(db.products.map((p) => [p.id, p])), [db.products]);

  const sales = db.orders.filter((o) => o.status === 'picked' && inScope(o.farmId) && (o.pickedAt || '').slice(0, 10) >= from);
  const expenses = db.expenses.filter((e) => e.date >= from && (scope === 'all' ? !e.farmId || inScope(e.farmId) : e.farmId === scope));
  const income = sum(sales, (o) => o.total);
  const spend = sum(expenses, (e) => e.amount);
  const profit = income - spend;

  const byCat = {};
  sales.forEach((o) => o.lines.forEach((l) => { const c = prod.get(l.productId)?.category || 'other'; byCat[c] = (byCat[c] || 0) + l.amount * (o.total / Math.max(1, o.subtotal)); }));
  const incomeMix = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const expMix = EXPENSE_CATEGORIES.map((c) => ({ name: c.label, value: Math.round(sum(expenses.filter((e) => e.category === c.value), (e) => e.amount)) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const fold = (arr) => (arr.length > 4 ? [...arr.slice(0, 3), { name: 'Other', value: arr.slice(3).reduce((a, x) => a + x.value, 0) }] : arr);

  const weeks = Math.ceil(days / 7);
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const a = dayKey(-days + 1 + i * 7);
    const b = dayKey(Math.min(0, -days + 7 + i * 7));
    return { day: fmtDate(a, 'd MMM'), Income: Math.round(sum(sales.filter((o) => o.pickedAt.slice(0, 10) >= a && o.pickedAt.slice(0, 10) <= b), (o) => o.total)), Costs: Math.round(sum(expenses.filter((e) => e.date >= a && e.date <= b), (e) => e.amount)) };
  });
  const perFarm = farms.map((f) => {
    const inc = sum(sales.filter((o) => o.farmId === f.id), (o) => o.total);
    const exp = sum(expenses.filter((e) => e.farmId === f.id), (e) => e.amount);
    return { day: f.short, Income: Math.round(inc), Costs: Math.round(exp), profit: inc - exp };
  });
  const shared = sum(expenses.filter((e) => !e.farmId), (e) => e.amount);

  return (
    <div>
      <PageHeader title="Finance" subtitle="Income, costs and profit across your farms" actions={<><Segmented options={PERIODS} value={days} onChange={setDays} /><Button icon={Plus} onClick={() => setAdding(true)}>Add expense</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Income" value={moneyShort(income)} icon={TrendingUp} tone="brand" sub={`${sales.length} sales`} />
        <StatCard label="Costs" value={moneyShort(spend)} icon={TrendingDown} tone="red" sub={`${expenses.length} expenses`} />
        <StatCard label={profit >= 0 ? 'Profit' : 'Loss'} value={moneyShort(profit)} icon={Scale} tone={profit >= 0 ? 'green' : 'red'} sub={income ? `${Math.round((profit / income) * 100)}% margin` : ''} />
        <StatCard label="Feed share of costs" value={`${spend ? Math.round((sum(expenses.filter((e) => e.category === 'feed'), (e) => e.amount) / spend) * 100) : 0}%`} icon={Receipt} tone="gold" sub="the biggest cost on most farms" />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'pl', label: 'Profit & loss' }, { value: 'expenses', label: 'Expenses', count: expenses.length }]} />
      {tab === 'pl' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="xl:col-span-2">
            <CardHeader title="Income vs costs" subtitle="By week" />
            <div className="px-3 pb-4"><Bars data={weekly} series={[{ key: 'Income', name: 'Income' }, { key: 'Costs', name: 'Costs', color: '#c8643b' }]} fmt={(v) => money(v)} yFmt={(v) => moneyShort(v).replace('GH₵ ', '')} height={260} /></div>
          </Card>
          <Card>
            <CardHeader title="Where income came from" />
            <div className="p-5"><Donut data={fold(incomeMix.map(([k, v]) => ({ name: categoryLabel(k), value: Math.round(v) })))} fmt={(v) => moneyShort(v)} center={<><p className="text-xs text-slate-500">Income</p><p className="text-lg font-extrabold">{moneyShort(income)}</p></>} /></div>
          </Card>
          <Card>
            <CardHeader title="Where money went" />
            <div className="p-5"><Donut data={fold(expMix)} fmt={(v) => moneyShort(v)} center={<><p className="text-xs text-slate-500">Costs</p><p className="text-lg font-extrabold">{moneyShort(spend)}</p></>} /></div>
          </Card>
          {scope === 'all' && (
            <Card className="xl:col-span-2">
              <CardHeader title="By farm" subtitle={shared ? `Plus ${money(shared)} shared costs (e.g. salaries) not tied to one farm` : undefined} />
              <div className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr]">
                <Bars data={perFarm} series={[{ key: 'Income', name: 'Income' }, { key: 'Costs', name: 'Costs', color: '#c8643b' }]} fmt={(v) => money(v)} yFmt={(v) => moneyShort(v).replace('GH₵ ', '')} height={220} />
                <div className="space-y-3">
                  {perFarm.map((f) => (
                    <div key={f.day} className="flex items-center justify-between rounded-xl bg-cream-100 px-4 py-3 dark:bg-white/5">
                      <span className="font-semibold">{f.day}</span>
                      <span className={f.profit >= 0 ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-bold text-accent-600'}>{money(f.profit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
      {tab === 'expenses' && (
        <DataTable
          rows={[...expenses].sort((a, b) => b.date.localeCompare(a.date))}
          searchText={(e) => `${e.description} ${expenseLabel(e.category)}`}
          toolbar={<Button size="sm" variant="secondary" icon={Download} onClick={() => downloadCSV(`expenses-${today()}`, expenses.map((e) => ({ Date: e.date, Farm: db.farms.find((f) => f.id === e.farmId)?.name || 'All farms', Category: expenseLabel(e.category), Description: e.description, Amount: e.amount, PaidFrom: e.paidFrom })))}>CSV</Button>}
          columns={[
            { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
            { key: 'description', label: 'Description', className: 'whitespace-normal min-w-[200px]' },
            { key: 'category', label: 'Category', render: (e) => <Badge tone="slate">{expenseLabel(e.category)}</Badge> },
            { key: 'farm', label: 'Farm', render: (e) => db.farms.find((f) => f.id === e.farmId)?.short || 'Shared', hideOnMobile: true },
            { key: 'paidFrom', label: 'Paid from', render: (e) => ({ wallet: 'Wallet', cash: 'Cash', bank: 'Bank' }[e.paidFrom] || e.paidFrom), hideOnMobile: true },
            { key: 'amount', label: 'Amount', render: (e) => <b>{money(e.amount)}</b> },
          ]}
        />
      )}
      <FormModal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add an expense"
        initial={{ date: today(), category: 'utilities', paidFrom: 'cash', farmId: scope === 'all' ? '' : scope }}
        fields={[
          { name: 'description', label: 'What was it for?', required: true, span: 2 },
          { name: 'amount', label: 'Amount (GH₵)', type: 'number', step: '0.01', required: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES, required: true },
          { name: 'farmId', label: 'Farm', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), placeholder: 'Shared / all farms' },
          { name: 'paidFrom', label: 'Paid from', type: 'select', required: true, options: [{ value: 'cash', label: 'Cash on hand' }, { value: 'wallet', label: `${appName()} wallet` }, { value: 'bank', label: 'Bank / other' }] },
        ]}
        onSubmit={(v) => {
          try {
            addExpense({ ...v, amount: +v.amount, farmId: v.farmId || null });
            toast.success('Expense saved');
            setAdding(false);
          } catch (e) {
            toast.error('Not saved', e.message);
          }
        }}
      />
    </div>
  );
}
