import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, CheckCircle2, Circle, Egg, Wheat, HeartCrack, Scale, Thermometer, Trash2 } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope } from '../../data/selectors';
import { PageHeader, Button, Tabs, DataTable, Badge, Card, CardHeader, IconButton, confirmDialog, toast, cx } from '../../components/ui';
import { useQuickLog } from '../../components/QuickLog';
import { activeFlocks, goodEggs, ageDays } from '../../lib/flock';
import { isLayingType } from '../../lib/standards';
import { fmtDate, num, today } from '../../lib/format';

export default function DailyLog() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const show = useQuickLog((s) => s.show);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'eggs';
  const setTab = (t) => setParams({ tab: t });
  const flocks = activeFlocks(db).filter((f) => inScope(f.farmId));
  const code = (id) => db.flocks.find((f) => f.id === id)?.code || '—';
  const person = (id) => db.users.find((u) => u.id === id)?.name.split(' ')[0] || id || '—';
  const t = today();

  const checklist = useMemo(
    () =>
      flocks.map((f) => ({
        f,
        eggs: isLayingType(f) && ageDays(f) >= 126 ? db.eggLogs.some((e) => e.flockId === f.id && e.date === t) : null,
        feed: db.feedLogs.some((e) => e.flockId === f.id && e.date === t),
        deaths: db.mortality.some((e) => e.flockId === f.id && e.date === t),
      })),
    [db, flocks, t],
  );

  const canDelete = user.role !== 'worker';
  const del = (col, id) => async () => {
    if (!(await confirmDialog('Delete this record?', 'Totals and stock will be recalculated.'))) return;
    useDB.getState().remove(col, id);
    toast.success('Record deleted');
  };
  const delCol = (col) => (canDelete ? [{ key: 'x', label: '', nosort: true, render: (r) => <IconButton icon={Trash2} label="Delete" onClick={del(col, r.id)} /> }] : []);
  const base = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    { key: 'flock', label: 'Flock', sort: (r) => code(r.flockId), render: (r) => <span className="font-semibold">{code(r.flockId)}</span> },
  ];
  const by = { key: 'by', label: 'By', render: (r) => person(r.by), hideOnMobile: true };
  const recent = (list) => list.filter((r) => inScope(r.farmId)).sort((a, b) => b.date.localeCompare(a.date));

  const TABLES = {
    eggs: {
      rows: recent(db.eggLogs),
      cols: [...base, { key: 'good', label: 'Good eggs', sort: goodEggs, render: (r) => <b>{num(goodEggs(r))}</b> }, { key: 'crates', label: 'Crates', render: (r) => num(Math.floor(goodEggs(r) / 30)) }, { key: 'large', label: 'L / M / S / J', render: (r) => `${r.large} / ${r.medium} / ${r.small} / ${r.jumbo}`, hideOnMobile: true }, { key: 'cracked', label: 'Cracked' }, by, ...delCol('eggLogs')],
    },
    feed: {
      rows: recent(db.feedLogs),
      cols: [...base, { key: 'item', label: 'Feed', render: (r) => db.items.find((i) => i.id === r.itemId)?.name }, { key: 'kg', label: 'Kg', render: (r) => <b>{num(r.kg, 1)}</b> }, { key: 'bags', label: 'Bags', render: (r) => num(r.kg / (db.settings.feedBagKg || 50), 1), hideOnMobile: true }, { key: 'water', label: 'Water (L)', render: (r) => (r.water ? num(r.water) : '—'), hideOnMobile: true }, by, ...delCol('feedLogs')],
    },
    deaths: {
      rows: recent(db.mortality),
      cols: [...base, { key: 'dead', label: 'Dead', render: (r) => <b className={r.dead >= 10 ? 'text-accent-600' : ''}>{r.dead}</b> }, { key: 'culled', label: 'Culled' }, { key: 'cause', label: 'Cause', className: 'whitespace-normal' }, by, ...delCol('mortality')],
    },
    weights: {
      rows: recent(db.weightLogs),
      cols: [...base, { key: 'avgG', label: 'Average', render: (r) => <b>{num(r.avgG)} g</b> }, { key: 'sample', label: 'Birds weighed' }, { key: 'uniformity', label: 'Uniformity', render: (r) => (r.uniformity ? `${r.uniformity}%` : '—') }, by, ...delCol('weightLogs')],
    },
    env: {
      rows: recent(db.envLogs),
      cols: [
        { key: 'date', label: 'Date', render: (r) => `${fmtDate(r.date)} ${r.time || ''}` },
        { key: 'pen', label: 'House', render: (r) => `${db.farms.find((f) => f.id === r.farmId)?.short} · ${db.pens.find((p) => p.id === r.penId)?.name}` },
        { key: 'temp', label: 'Temp', render: (r) => <span className={cx('font-bold', (r.temp > db.settings.tempMax || r.temp < db.settings.tempMin) && 'text-accent-600')}>{r.temp} °C</span> },
        { key: 'humidity', label: 'Humidity', render: (r) => (r.humidity != null ? <span className={r.humidity > db.settings.humidityMax ? 'font-bold text-accent-600' : ''}>{r.humidity}%</span> : '—') },
        { key: 'ammonia', label: 'Ammonia', render: (r) => <Badge tone={r.ammonia === 'High' ? 'red' : r.ammonia === 'Moderate' ? 'amber' : 'green'}>{r.ammonia}</Badge> },
        { key: 'note', label: 'Notes', className: 'whitespace-normal', hideOnMobile: true },
        ...delCol('envLogs'),
      ],
    },
  };
  const KIND = { eggs: 'eggs', feed: 'feed', deaths: 'deaths', weights: 'weight', env: 'env' };
  const tbl = TABLES[tab];
  const doneCount = checklist.reduce((a, c) => a + [c.eggs, c.feed].filter((x) => x === true).length, 0);
  const needCount = checklist.reduce((a, c) => a + [c.eggs, c.feed].filter((x) => x !== null).length, 0);

  return (
    <div>
      <PageHeader title="Daily records" subtitle="Eggs, feed, losses, weights and house conditions" actions={<Button icon={Plus} onClick={() => show(KIND[tab])}>Add record</Button>} />
      <Card className="mb-6">
        <CardHeader title="Today's checklist" subtitle={`${doneCount} of ${needCount} egg & feed records done · tap to fill in`} icon={CheckCircle2} />
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {checklist.map(({ f, eggs, feed, deaths }) => (
            <div key={f.id} className="rounded-2xl border border-cream-200 p-3 dark:border-white/10">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{f.code} <span className="font-normal text-slate-500">· {db.farms.find((x) => x.id === f.farmId)?.short}</span></p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[['eggs', eggs, 'Eggs'], ['feed', feed, 'Feed'], ['deaths', deaths, 'Deaths']].filter(([, v]) => v !== null).map(([k, v, l]) => (
                  <button key={k} type="button" onClick={() => show(k, f.id)} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', v ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : k === 'deaths' ? 'bg-cream-200 text-slate-600 dark:bg-white/10 dark:text-slate-300' : 'bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300')}>
                    {v ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />} {l}{!v && k === 'deaths' ? ' (none yet)' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'eggs', label: 'Eggs', icon: Egg },
          { value: 'feed', label: 'Feed', icon: Wheat },
          { value: 'deaths', label: 'Mortality', icon: HeartCrack },
          { value: 'weights', label: 'Weights', icon: Scale },
          { value: 'env', label: 'House conditions', icon: Thermometer },
        ]}
      />
      <DataTable key={tab} rows={tbl.rows} columns={tbl.cols} pageSize={15} searchText={(r) => `${code(r.flockId)} ${r.cause || ''} ${r.note || ''}`} />
    </div>
  );
}
