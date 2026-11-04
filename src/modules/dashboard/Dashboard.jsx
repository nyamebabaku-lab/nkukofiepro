import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Egg, Bird, HeartCrack, Wheat, Wallet, TrendingUp, HandCoins, Percent, Plus, Store, AlertTriangle, AlertOctagon, Info, ChevronRight, CalendarClock, Clock, CheckCircle2, Circle, Sun, Moon, Sunrise } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useFarmScope, useInScope, useMyFarms } from '../../data/selectors';
import { Card, CardHeader, StatCard, Badge, Button, Progress, Input, Segmented, toast, cx } from '../../components/ui';
import { TrendChart, Bars } from '../../components/charts';
import { useQuickLog, LOG_KINDS } from '../../components/QuickLog';
import { Photo } from '../../components/ProductArt';
import { flockPhoto } from '../../data/media';
import { money, moneyShort, num, today, dayKey, lastDays, sum, fmtDate } from '../../lib/format';
import { activeFlocks, flockIndex, goodEggs, ageLabel } from '../../lib/flock';
import { isLayingType, speciesLabel, purposeLabel } from '../../lib/standards';
import { itemBalance, itemUsage } from '../../lib/stock';
import { debtAgeing, orderMoney, ORDER_STATUS } from '../../lib/orders';
import { walletSummary } from '../../lib/wallet';
import { farmAlerts } from '../../lib/alerts';
import { tasksFor, toggleTask, todayAttendance, clock } from '../../lib/tasks';

const LEVEL = {
  critical: { icon: AlertOctagon, cls: 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300', label: 'Urgent' },
  warning: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', label: 'Warning' },
  info: { icon: Info, cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', label: 'To do' },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? ['Good morning', Sunrise] : h < 17 ? ['Good afternoon', Sun] : ['Good evening', Moon];
}

function Alerts({ alerts }) {
  const show = useQuickLog((s) => s.show);
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const list = all ? alerts : alerts.slice(0, 6);
  return (
    <Card>
      <CardHeader title="Needs attention" subtitle={`${alerts.length} item${alerts.length === 1 ? '' : 's'}`} icon={AlertTriangle} action={alerts.length > 6 && <Button size="sm" variant="ghost" onClick={() => setAll((a) => !a)}>{all ? 'Less' : 'See all'}</Button>} />
      <div className="space-y-1.5 p-3 pt-2">
        {!alerts.length && <p className="flex items-center gap-2 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" /> All clear — nothing needs attention right now.</p>}
        {list.map((a, i) => {
          const L = LEVEL[a.level];
          return (
            <button key={i} type="button" onClick={() => (a.action ? show(a.action.kind, a.action.flockId) : navigate(a.link))} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-cream-100 dark:hover:bg-white/5">
              <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', L.cls)}><L.icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</span>
                <span className="block truncate text-xs text-slate-500">{a.text}</span>
              </span>
              {a.action ? <Badge tone="gold">Log now</Badge> : <ChevronRight className="h-4 w-4 text-slate-300" />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function TodayHero({ db, flocks, scope }) {
  const fi = flockIndex(db);
  const inS = (fid) => flocks.some((f) => f.id === fid);
  const t = today();
  const eggs = sum(db.eggLogs.filter((e) => e.date === t && inS(e.flockId)), goodEggs);
  const eggsY = sum(db.eggLogs.filter((e) => e.date === dayKey(-1) && inS(e.flockId)), goodEggs);
  const live = sum(flocks, (f) => fi.get(f.id)?.live || 0);
  const dead = sum(db.mortality.filter((m) => m.date === t && inS(m.flockId)), (m) => m.dead);
  const feed = sum(db.feedLogs.filter((r) => r.date === t && inS(r.flockId)), (r) => r.kg);
  const layers = flocks.filter((f) => isLayingType(f) && (fi.get(f.id)?.age || 0) >= 126);
  const hens = sum(layers, (f) => fi.get(f.id)?.live || 0);
  const eggs7 = sum(layers, (f) => fi.get(f.id)?.eggs7 || 0);
  const lay = hens ? (eggs7 / 7 / hens) * 100 : 0;
  const tiles = [
    { icon: Egg, label: 'Eggs today', value: num(eggs), sub: `${num(Math.floor(eggs / 30))} crates · yesterday ${num(eggsY)}` },
    { icon: Bird, label: 'Birds alive', value: num(live), sub: `${flocks.length} active flocks` },
    { icon: HeartCrack, label: 'Deaths today', value: num(dead), sub: live ? `${((dead / live) * 100).toFixed(2)}% of birds` : '—' },
    { icon: Wheat, label: 'Feed used today', value: `${num(feed)} kg`, sub: `${num(feed / (db.settings.feedBagKg || 50), 1)} bags` },
  ];
  return (
    <div className="grain hero-glow relative overflow-hidden rounded-3xl bg-brand-800 p-5 text-white shadow-lift sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-gold-300">Today on the farm{scope !== 'all' ? ` · ${db.farms.find((f) => f.id === scope)?.name}` : ''}</p>
          <p className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{lay ? `${lay.toFixed(1)}% laying rate` : `${num(live)} birds`}</p>
          <p className="text-sm text-brand-100/80">{layers.length ? `${num(hens)} hens in lay · 7-day average` : 'Across your active flocks'}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-2xl bg-white/[.07] p-3.5 ring-1 ring-white/10 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-100/80"><x.icon className="h-4 w-4 text-gold-400" /> {x.label}</div>
            <p className="mt-2 text-2xl font-extrabold tracking-tight">{x.value}</p>
            <p className="truncate text-[11px] text-brand-200/70">{x.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlockCards({ db, flocks }) {
  const fi = flockIndex(db);
  return (
    <Card>
      <CardHeader title="Flocks" subtitle="Live birds, age and performance" icon={Bird} action={<Link to="/app/flocks" className="text-xs font-semibold text-brand-700 hover:underline dark:text-gold-400">All flocks</Link>} />
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {flocks.map((f) => {
          const s = fi.get(f.id);
          const laying = isLayingType(f) && s.age >= 126;
          return (
            <Link key={f.id} to={`/app/flocks/${f.id}`} className="rounded-2xl border border-cream-200 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft dark:border-white/10">
              <div className="flex items-start justify-between gap-2">
                <img src={flockPhoto(f)} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{f.code}</p>
                  <p className="truncate text-xs text-slate-500">{f.breed} · {db.pens.find((p) => p.id === f.penId)?.name}</p>
                </div>
                <Badge tone={f.purpose === 'layer' ? 'gold' : f.purpose === 'broiler' ? 'green' : 'terracotta'}>{f.species === 'chicken' ? purposeLabel(f.purpose) : speciesLabel(f.species)}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-base font-extrabold text-slate-900 dark:text-white">{num(s.live)}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">Birds</p></div>
                <div><p className="text-base font-extrabold text-slate-900 dark:text-white">{ageLabel(s.age).replace(' wks', 'w').replace(/ \d+d$/, '')}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">Age</p></div>
                <div>
                  <p className={cx('text-base font-extrabold', laying ? (s.layPct7 >= s.stdLayPct - 5 ? 'text-emerald-600' : 'text-accent-600') : 'text-slate-900 dark:text-white')}>
                    {laying ? `${s.layPct7.toFixed(0)}%` : s.lastWeight ? `${(s.lastWeight.avgG / 1000).toFixed(2)}kg` : `${s.mortalityPct}%`}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{laying ? 'Laying' : s.lastWeight ? 'Avg wt' : 'Mortality'}</p>
                </div>
              </div>
              {laying && <Progress value={(s.layPct7 / Math.max(1, s.stdLayPct)) * 100} tone={s.layPct7 >= s.stdLayPct - 5 ? 'green' : 'amber'} className="mt-3 h-1.5" />}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function PickupsToday({ db, inScope }) {
  const list = db.orders.filter((o) => inScope(o.farmId) && ['booked', 'ready'].includes(o.status) && o.pickupDate <= today()).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  return (
    <Card>
      <CardHeader title="Pick-ups due" subtitle="Today and missed" icon={CalendarClock} action={<Link to="/app/pickups" className="text-xs font-semibold text-brand-700 hover:underline dark:text-gold-400">Calendar</Link>} />
      <div className="divide-y divide-cream-200 px-2 pb-2 dark:divide-white/5">
        {!list.length && <p className="p-4 text-sm text-slate-500">No pick-ups due today.</p>}
        {list.slice(0, 6).map((o) => {
          const m = orderMoney(db, o);
          return (
            <Link key={o.id} to={`/app/orders/${o.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-cream-100 dark:hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{o.customerName}</p>
                <p className="truncate text-xs text-slate-500">{o.lines.map((l) => `${l.qty} ${l.name.split(' —')[0]}`).join(', ')}</p>
              </div>
              <div className="text-right">
                <Badge tone={o.pickupDate < today() ? 'red' : ORDER_STATUS[o.status].tone}>{o.pickupDate < today() ? 'Missed' : ORDER_STATUS[o.status].label}</Badge>
                <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{m.balance > 0 ? `${money(m.balance)} to collect` : 'Paid'}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function MyDay({ user }) {
  const db = useDB();
  const att = todayAttendance(db, user.id);
  const [code, setCode] = useState('');
  const tasks = tasksFor(db, { userId: user.id });
  const done = tasks.filter((t) => t.done).length;
  const doClock = () => {
    try {
      const r = clock(user.id, code);
      toast.success(r.action === 'in' ? 'Clocked in' : 'Clocked out', `${r.time} at ${r.farm.name}`);
      setCode('');
    } catch (e) {
      toast.error('Could not clock', e.message);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-white"><Clock className="h-5 w-5" /></span>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Attendance</p>
            <p className="text-xs text-slate-500">{att ? `In at ${att.in}${att.out ? ` · out at ${att.out}` : ''}` : 'Not clocked in yet'}</p>
          </div>
        </div>
        {!att?.out && (
          <div className="mt-4 flex gap-2">
            <Input inputMode="numeric" maxLength={6} placeholder="6-digit farm code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <Button onClick={doClock} disabled={code.length !== 6}>{att ? 'Clock out' : 'Clock in'}</Button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">The code is shown on the farm notice board (demo: Dodowa {db.farms[0].clockCode}).</p>
      </Card>
      <Card>
        <CardHeader title="My tasks today" subtitle={`${done} of ${tasks.length} done`} icon={CheckCircle2} />
        <div className="px-5"><Progress value={tasks.length ? (done / tasks.length) * 100 : 0} tone="green" /></div>
        <div className="space-y-1 p-3">
          {tasks.map((t) => (
            <button key={t.id} type="button" onClick={() => toggleTask(t.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-cream-100 dark:hover:bg-white/5">
              {t.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className={cx('h-5 w-5', t.overdue ? 'text-accent-500' : 'text-slate-300')} />}
              <span className={cx('flex-1 text-sm', t.done ? 'text-slate-400 line-through' : 'font-medium text-slate-800 dark:text-slate-100')}>{t.title}</span>
              <span className={cx('text-xs font-semibold', t.overdue ? 'text-accent-600' : 'text-slate-400')}>{t.time}</span>
            </button>
          ))}
          {!tasks.length && <p className="p-3 text-sm text-slate-500">No tasks assigned to you today.</p>}
        </div>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const db = useDB();
  const user = useCurrentUser();
  const scope = useFarmScope();
  const inScope = useInScope();
  const myFarms = useMyFarms();
  const show = useQuickLog((s) => s.show);
  const navigate = useNavigate();
  const [range, setRange] = useState(30);
  const flocks = useMemo(() => activeFlocks(db).filter((f) => inScope(f.farmId)), [db, inScope]);
  const alerts = useMemo(() => farmAlerts(db, inScope), [db, inScope]);
  const [hello, HelloIcon] = greeting();

  const days = lastDays(range);
  const eggSeries = useMemo(() => {
    const m = new Map(days.map((d) => [d, 0]));
    db.eggLogs.forEach((e) => m.has(e.date) && inScope(e.farmId) && m.set(e.date, m.get(e.date) + goodEggs(e)));
    return days.map((d) => ({ day: `${d.slice(8)}/${d.slice(5, 7)}`, eggs: d === today() ? null : m.get(d) }));
  }, [db.eggLogs, range, inScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const salesSeries = useMemo(() => {
    const m = new Map(days.map((d) => [d, 0]));
    db.orders.forEach((o) => o.status === 'picked' && inScope(o.farmId) && m.has(o.pickedAt?.slice(0, 10)) && m.set(o.pickedAt.slice(0, 10), m.get(o.pickedAt.slice(0, 10)) + o.total));
    return days.map((d) => ({ day: `${d.slice(8)}/${d.slice(5, 7)}`, sales: Math.round(m.get(d)) }));
  }, [db.orders, range, inScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const isWorker = user.role === 'worker';
  const month = today().slice(0, 7);
  const lastMonth = dayKey(-new Date().getDate()).slice(0, 7);
  const salesIn = (mk) => sum(db.orders.filter((o) => o.status === 'picked' && inScope(o.farmId) && o.pickedAt?.slice(0, 7) === mk), (o) => o.total);
  const sm = salesIn(month);
  const dayOfMonth = new Date().getDate();
  const lmPace = salesIn(lastMonth) * ((dayOfMonth - 1 + new Date().getHours() / 24) / 30);
  const trend = lmPace ? `${sm >= lmPace ? '+' : ''}${Math.round(((sm - lmPace) / lmPace) * 100)}%` : null;
  const debt = debtAgeing(db, scope);
  const w = walletSummary(db);
  const feedItem = db.items.find((i) => i.id === 'itm_layer');
  const feedDays = feedItem ? itemUsage(db, feedItem, scope).daysLeft : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-500"><HelloIcon className="h-4 w-4 text-gold-500" /> {fmtDate(new Date(), 'EEEE, d MMMM')}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-brand-900 dark:text-white">{hello}, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500">{scope === 'all' ? `${myFarms.length} farms · ${flocks.length} active flocks` : db.farms.find((f) => f.id === scope)?.location}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isWorker && <Button variant="secondary" icon={Store} onClick={() => navigate('/app/pos')}>New sale</Button>}
          <Button icon={Plus} onClick={() => show()}>Quick log</Button>
        </div>
      </div>

      {isWorker && <MyDay user={user} />}
      <TodayHero db={db} flocks={flocks} scope={scope} />

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:hidden">
        {LOG_KINDS.map((k) => (
          <button key={k.key} type="button" onClick={() => show(k.key)} className="relative h-24 overflow-hidden rounded-2xl text-left shadow-soft active:scale-[.98]">
            <Photo k={k.photo} className="absolute inset-0 h-full w-full" rounded="rounded-none" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <span className={cx('absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg', k.tone)}><k.icon className="h-4 w-4" /></span>
            <span className="absolute inset-x-2 bottom-2 text-[11px] font-bold leading-tight text-white">{k.label}</span>
          </button>
        ))}
      </div>

      {!isWorker && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Sales this month" value={moneyShort(sm)} icon={TrendingUp} tone="brand" trend={trend} sub="vs last month's pace" onClick={() => navigate('/app/orders')} />
          {user.role === 'owner' ? (
            <StatCard label="Wallet balance" value={money(w.balance)} icon={Wallet} tone="gold" sub={`${money(w.cashOnHand)} cash on hand`} onClick={() => navigate('/app/wallet')} />
          ) : (
            <StatCard label="Layer feed left" value={feedDays != null ? `${feedDays} days` : '—'} icon={Wheat} tone="gold" sub={`${num(feedItem ? itemBalance(db, feedItem.id, scope) : 0)} kg in store`} onClick={() => navigate('/app/inventory')} />
          )}
          <StatCard label="Customer debt" value={money(debt.total)} icon={HandCoins} tone="red" sub={`${debt.rows.length} unpaid pick-ups`} onClick={() => navigate('/app/customers?tab=debts')} />
          <StatCard label="Open bookings" value={num(db.orders.filter((o) => inScope(o.farmId) && ['booked', 'ready'].includes(o.status)).length)} icon={Percent} tone="teal" sub="waiting for pick-up" onClick={() => navigate('/app/pickups')} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Egg production" subtitle={`Good eggs per day · last ${range} days`} icon={Egg} action={<Segmented options={[{ value: 14, label: '14d' }, { value: 30, label: '30d' }, { value: 60, label: '60d' }]} value={range} onChange={setRange} />} />
            <div className="px-3 pb-4 pt-2"><TrendChart data={eggSeries} series={[{ key: 'eggs', name: 'Eggs', area: true }]} height={240} /></div>
          </Card>
          {!isWorker && (
            <Card>
              <CardHeader title="Sales" subtitle={`Value of orders picked up · last ${range} days`} icon={TrendingUp} />
              <div className="px-3 pb-4 pt-2"><Bars data={salesSeries} series={[{ key: 'sales', name: 'Sales' }]} fmt={(v) => money(v)} yFmt={(v) => moneyShort(v).replace('GH₵ ', '')} height={220} /></div>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Alerts alerts={alerts} />
          {!isWorker && <PickupsToday db={db} inScope={inScope} />}
        </div>
      </div>
      <FlockCards db={db} flocks={flocks} />
    </div>
  );
}
