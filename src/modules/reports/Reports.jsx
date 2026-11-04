import { useMemo, useState } from 'react';
import { Download, Printer, Egg, HeartCrack, Wheat, ShoppingBag, Syringe } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, CardHeader, Tabs, Segmented, DataTable, Field, Input, Badge } from '../../components/ui';
import { TrendChart, Bars, Donut } from '../../components/charts';
import { goodEggs, flockIndex, ageDays } from '../../lib/flock';
import { isLayingType, stdLayPct } from '../../lib/standards';
import { methodLabel } from '../../lib/payments';
import { money, moneyShort, num, dayKey, today, sum, downloadCSV, fmtDate } from '../../lib/format';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export default function Reports() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const farms = useMyFarms().filter((f) => inScope(f.id));
  const [tab, setTab] = useState('production');
  const [preset, setPreset] = useState(30);
  const [range, setRange] = useState({ from: dayKey(-29), to: today() });
  const setP = (n) => {
    setPreset(n);
    if (n) setRange({ from: dayKey(-n + 1), to: today() });
  };
  const { from, to } = range;
  const inR = (d) => d >= from && d <= to;
  const nDays = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  const keys = Array.from({ length: nDays }, (_, i) => dayKey(i, parseISO(from)));
  const lbl = (k) => `${k.slice(8)}/${k.slice(5, 7)}`;
  const fi = flockIndex(db);
  const flocks = db.flocks.filter((f) => inScope(f.farmId));
  const series = farms.map((f) => ({ key: f.id, name: f.short }));

  const data = useMemo(() => {
    const perFarmDay = (list, val, dateOf = (r) => r.date) => {
      const m = new Map(keys.map((k) => [k, Object.fromEntries(farms.map((f) => [f.id, 0]))]));
      list.forEach((r) => { const d = dateOf(r); if (m.has(d) && m.get(d)[r.farmId] !== undefined) m.get(d)[r.farmId] += val(r); });
      return keys.map((k) => ({ day: lbl(k), ...m.get(k) }));
    };
    const eggs = db.eggLogs.filter((e) => inR(e.date) && inScope(e.farmId));
    const feed = db.feedLogs.filter((e) => inR(e.date) && inScope(e.farmId));
    const mort = db.mortality.filter((e) => inR(e.date) && inScope(e.farmId));
    const sales = db.orders.filter((o) => o.status === 'picked' && inScope(o.farmId) && inR((o.pickedAt || '').slice(0, 10)));
    const pays = db.payments.filter((p) => p.status === 'success' && p.amount > 0 && inR(p.at.slice(0, 10)) && (!p.farmId || inScope(p.farmId)));
    const vacc = db.vaccinations.filter((v) => inScope(v.farmId) && inR(v.dueDate) && v.dueDate <= today());
    return { eggs, feed, mort, sales, pays, vacc, eggDay: perFarmDay(eggs, goodEggs), feedDay: perFarmDay(feed, (r) => r.kg), mortDay: perFarmDay(mort, (r) => r.dead + (r.culled || 0)) };
  }, [db, from, to, inScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const perFlock = flocks.map((f) => {
    const e = data.eggs.filter((r) => r.flockId === f.id);
    const fd = data.feed.filter((r) => r.flockId === f.id);
    const m = data.mort.filter((r) => r.flockId === f.id);
    const eggs = sum(e, goodEggs);
    const s = fi.get(f.id);
    const avgBirds = s.live + sum(m, (r) => r.dead + r.culled) / 2;
    const days = new Set(e.map((r) => r.date)).size;
    const midAge = ageDays(f) - nDays / 2;
    return {
      id: f.id, code: f.code, breed: f.breed, eggs, crates: Math.floor(eggs / 30), lay: days && avgBirds ? (eggs / days / avgBirds) * 100 : null, std: isLayingType(f) ? stdLayPct(f, midAge / 7) : null,
      feedKg: sum(fd, (r) => r.kg), feedCost: sum(fd, (r) => r.kg * (db.items.find((i) => i.id === r.itemId)?.cost || 0)), dead: sum(m, (r) => r.dead), culled: sum(m, (r) => r.culled), mortPct: avgBirds ? (sum(m, (r) => r.dead) / avgBirds) * 100 : 0, fcr: s.fcr, live: s.live,
    };
  }).filter((r) => r.eggs || r.feedKg || r.dead);

  const causes = Object.entries(data.mort.reduce((a, r) => ({ ...a, [r.cause]: (a[r.cause] || 0) + r.dead + r.culled }), {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const prod = new Map();
  data.sales.forEach((o) => o.lines.forEach((l) => { const x = prod.get(l.name) || { name: l.name, unit: l.unit, qty: 0, amount: 0 }; x.qty += l.qty; x.amount += l.amount; prod.set(l.name, x); }));
  const prodRows = [...prod.values()].sort((a, b) => b.amount - a.amount);
  const cust = new Map();
  data.sales.forEach((o) => { const x = cust.get(o.customerName) || { name: o.customerName, orders: 0, amount: 0 }; x.orders++; x.amount += o.total; cust.set(o.customerName, x); });
  const custRows = [...cust.values()].sort((a, b) => b.amount - a.amount);
  const methods = Object.entries(data.pays.reduce((a, p) => ({ ...a, [p.method]: (a[p.method] || 0) + p.amount }), {})).map(([k, v]) => ({ name: methodLabel(k), value: Math.round(v) })).sort((a, b) => b.value - a.value);
  const fold = (arr) => (arr.length > 4 ? [...arr.slice(0, 3), { name: 'Other', value: arr.slice(3).reduce((a, x) => a + x.value, 0) }] : arr);
  const vRows = flocks.map((f) => {
    const v = data.vacc.filter((x) => x.flockId === f.id && x.note !== 'Given before arrival');
    const onTime = v.filter((x) => x.status === 'done' && x.doneAt <= dayKey(1, parseISO(x.dueDate))).length;
    const late = v.filter((x) => x.status === 'done' && x.doneAt > dayKey(1, parseISO(x.dueDate))).length;
    const missed = v.filter((x) => x.status !== 'done').length;
    return { id: f.id, code: f.code, total: v.length, onTime, late, missed, pct: v.length ? Math.round((onTime / v.length) * 100) : null };
  }).filter((r) => r.total);

  const exportTab = () => {
    const map = {
      production: perFlock.filter((r) => r.eggs).map((r) => ({ Flock: r.code, Breed: r.breed, Eggs: r.eggs, Crates: r.crates, 'Lay %': r.lay?.toFixed(1), 'Standard %': r.std?.toFixed(1) })),
      mortality: perFlock.map((r) => ({ Flock: r.code, Dead: r.dead, Culled: r.culled, 'Mortality %': r.mortPct.toFixed(2) })),
      feed: perFlock.map((r) => ({ Flock: r.code, 'Feed kg': r.feedKg.toFixed(1), 'Feed cost': r.feedCost.toFixed(2), FCR: r.fcr ?? '' })),
      sales: prodRows.map((r) => ({ Product: r.name, Quantity: r.qty, Unit: r.unit, Amount: r.amount.toFixed(2) })),
      health: vRows.map((r) => ({ Flock: r.code, Due: r.total, 'On time': r.onTime, Late: r.late, Missed: r.missed, 'Compliance %': r.pct })),
    };
    downloadCSV(`${tab}-report-${from}-to-${to}`, map[tab]);
  };

  const TABS = [
    { value: 'production', label: 'Eggs', icon: Egg },
    { value: 'mortality', label: 'Mortality', icon: HeartCrack },
    { value: 'feed', label: 'Feed', icon: Wheat },
    ...(user.role === 'owner' || user.role === 'manager' ? [{ value: 'sales', label: 'Sales', icon: ShoppingBag }] : []),
    { value: 'health', label: 'Vaccination', icon: Syringe },
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle={`${fmtDate(from)} – ${fmtDate(to)} · ${farms.length === 1 ? farms[0].name : `${farms.length} farms`}`} actions={<><Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button><Button icon={Download} onClick={exportTab}>Export CSV</Button></>} />
      <Card className="no-print mb-5 flex flex-wrap items-end gap-3 p-4">
        <Segmented options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 60, label: '60 days' }, { value: 0, label: 'Custom' }]} value={preset} onChange={setP} />
        {preset === 0 && (
          <>
            <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={to} min={from} max={today()} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
          </>
        )}
      </Card>
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={TABS} />

      {tab === 'production' && (
        <div className="space-y-6">
          <Card><CardHeader title="Good eggs per day" subtitle={`${num(sum(data.eggs, goodEggs))} eggs · ${num(Math.floor(sum(data.eggs, goodEggs) / 30))} crates`} /><div className="px-3 pb-4"><TrendChart data={data.eggDay.filter((d) => d.day !== lbl(today()))} series={series} /></div></Card>
          <DataTable rows={perFlock.filter((r) => r.eggs)} search={false} columns={[
            { key: 'code', label: 'Flock', render: (r) => <b>{r.code}</b> }, { key: 'breed', label: 'Breed' }, { key: 'eggs', label: 'Eggs', render: (r) => num(r.eggs) }, { key: 'crates', label: 'Crates', render: (r) => num(r.crates) },
            { key: 'lay', label: 'Lay %', render: (r) => (r.lay ? `${r.lay.toFixed(1)}%` : '—') }, { key: 'std', label: 'Standard', render: (r) => (r.std ? `${r.std.toFixed(1)}%` : '—') },
            { key: 'gap', label: 'vs standard', sort: (r) => (r.lay || 0) - (r.std || 0), render: (r) => (r.lay && r.std ? <Badge tone={r.lay >= r.std - 3 ? 'green' : 'red'}>{(r.lay - r.std).toFixed(1)} pts</Badge> : '—') },
          ]} />
        </div>
      )}
      {tab === 'mortality' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card><CardHeader title="Birds lost per day" subtitle={`${num(sum(data.mort, (r) => r.dead))} dead · ${num(sum(data.mort, (r) => r.culled))} culled`} /><div className="px-3 pb-4"><Bars data={data.mortDay} series={series} stack /></div></Card>
            <Card><CardHeader title="Causes" /><div className="p-5"><Donut data={fold(causes)} /></div></Card>
          </div>
          <DataTable rows={perFlock} search={false} initialSort={{ key: 'mortPct', dir: 'desc' }} columns={[
            { key: 'code', label: 'Flock', render: (r) => <b>{r.code}</b> }, { key: 'live', label: 'Birds now', render: (r) => num(r.live) }, { key: 'dead', label: 'Dead' }, { key: 'culled', label: 'Culled' },
            { key: 'mortPct', label: 'Mortality', render: (r) => <Badge tone={r.mortPct > 2 ? 'red' : r.mortPct > 1 ? 'amber' : 'green'}>{r.mortPct.toFixed(2)}%</Badge> },
          ]} />
        </div>
      )}
      {tab === 'feed' && (
        <div className="space-y-6">
          <Card><CardHeader title="Feed used per day (kg)" subtitle={`${num(sum(data.feed, (r) => r.kg))} kg · ${money(sum(perFlock, (r) => r.feedCost))}`} /><div className="px-3 pb-4"><Bars data={data.feedDay} series={series} stack /></div></Card>
          <DataTable rows={perFlock.filter((r) => r.feedKg)} search={false} initialSort={{ key: 'feedKg', dir: 'desc' }} columns={[
            { key: 'code', label: 'Flock', render: (r) => <b>{r.code}</b> }, { key: 'feedKg', label: 'Feed (kg)', render: (r) => num(r.feedKg) }, { key: 'bags', label: 'Bags', render: (r) => num(r.feedKg / 50, 1) },
            { key: 'feedCost', label: 'Cost', render: (r) => money(r.feedCost) }, { key: 'perEgg', label: 'Feed cost / crate', render: (r) => (r.eggs ? money((r.feedCost / r.eggs) * 30) : '—') }, { key: 'fcr', label: 'FCR', render: (r) => r.fcr ?? '—' },
          ]} />
        </div>
      )}
      {tab === 'sales' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card><CardHeader title="Top products" subtitle={`${money(sum(data.sales, (o) => o.total))} from ${data.sales.length} orders`} /><div className="px-3 pb-4"><Bars layout="vertical" data={prodRows.slice(0, 8).map((r) => ({ day: r.name.split(' —')[0], amount: Math.round(r.amount) }))} series={[{ key: 'amount', name: 'Sales' }]} fmt={(v) => money(v)} yFmt={(v) => moneyShort(v).replace('GH₵ ', '')} height={300} /></div></Card>
            <Card><CardHeader title="How customers paid" /><div className="p-5"><Donut data={fold(methods)} fmt={(v) => moneyShort(v)} /></div></Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <DataTable rows={prodRows} search={false} columns={[{ key: 'name', label: 'Product', className: 'whitespace-normal' }, { key: 'qty', label: 'Qty', render: (r) => `${num(r.qty)} ${r.unit}` }, { key: 'amount', label: 'Amount', render: (r) => <b>{money(r.amount)}</b> }]} />
            <DataTable rows={custRows} search={false} columns={[{ key: 'name', label: 'Customer' }, { key: 'orders', label: 'Orders' }, { key: 'amount', label: 'Bought', render: (r) => <b>{money(r.amount)}</b> }]} />
          </div>
        </div>
      )}
      {tab === 'health' && (
        <DataTable rows={vRows} search={false} columns={[
          { key: 'code', label: 'Flock', render: (r) => <b>{r.code}</b> }, { key: 'total', label: 'Due in period' }, { key: 'onTime', label: 'On time' }, { key: 'late', label: 'Late' }, { key: 'missed', label: 'Not given' },
          { key: 'pct', label: 'Compliance', render: (r) => <Badge tone={r.pct >= 90 ? 'green' : r.pct >= 70 ? 'amber' : 'red'}>{r.pct}%</Badge> },
        ]} />
      )}
    </div>
  );
}
