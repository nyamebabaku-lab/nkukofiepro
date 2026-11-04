import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Egg, Wheat, HeartCrack, Scale, Syringe, Archive, Bird, Coins } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { PageHeader, Button, Card, CardHeader, Tabs, Badge, StatCard, DataTable, KeyValue, EmptyState, Segmented, confirmDialog, toast } from '../../components/ui';
import { TrendChart } from '../../components/charts';
import { useQuickLog } from '../../components/QuickLog';
import { flockIndex, flockDaily, growthSeries, ageLabel, goodEggs } from '../../lib/flock';
import { isLayingType, isMeatType, speciesLabel, purposeLabel } from '../../lib/standards';
import { num, money, fmtDate, sum, today } from '../../lib/format';
import { vaccineState } from '../../lib/vaccines';
import { markVaccineDone, closeFlock } from '../../lib/health';

export default function FlockDetail() {
  const { id } = useParams();
  const db = useDB();
  const user = useCurrentUser();
  const show = useQuickLog((s) => s.show);
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState(30);
  const f = db.flocks.find((x) => x.id === id);
  const daily = useMemo(() => (f ? flockDaily(db, f, range) : []), [db, f, range]);
  const growth = useMemo(() => (f ? growthSeries(db, f) : []), [db, f]);
  if (!f) return <EmptyState title="Flock not found" action={<Link to="/app/flocks"><Button variant="secondary">Back to flocks</Button></Link>} />;
  const s = flockIndex(db).get(f.id);
  const farm = db.farms.find((x) => x.id === f.farmId);
  const pen = db.pens.find((p) => p.id === f.penId);
  const laying = isLayingType(f) && s.age >= 120;
  const vaccines = db.vaccinations.filter((v) => v.flockId === f.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const treatments = db.treatments.filter((t) => t.flockId === f.id);
  const healthCost = sum(treatments, (t) => (db.items.find((i) => i.id === t.itemId)?.cost || 0) * (t.qty || 0)) + sum(vaccines.filter((v) => v.itemId), (v) => (db.items.find((i) => i.id === v.itemId)?.cost || 0) * (v.qty || 0));
  const totalCost = s.birdCost + s.feedCost + healthCost;
  const eggsAll = s.eggsAll;
  const name = (uid) => db.users.find((u) => u.id === uid)?.name || uid || '—';

  const records = [
    ...db.eggLogs.filter((r) => r.flockId === f.id).map((r) => ({ id: r.id, date: r.date, type: 'Eggs', detail: `${num(goodEggs(r))} good · ${r.cracked} cracked (L ${r.large} / M ${r.medium} / S ${r.small} / J ${r.jumbo})`, by: r.by })),
    ...db.feedLogs.filter((r) => r.flockId === f.id).map((r) => ({ id: r.id, date: r.date, type: 'Feed', detail: `${num(r.kg, 1)} kg ${db.items.find((i) => i.id === r.itemId)?.name || ''}${r.water ? ` · ${num(r.water)} L water` : ''}`, by: r.by })),
    ...db.mortality.filter((r) => r.flockId === f.id).map((r) => ({ id: r.id, date: r.date, type: 'Mortality', detail: `${r.dead} dead${r.culled ? `, ${r.culled} culled` : ''} · ${r.cause}`, by: r.by })),
    ...db.weightLogs.filter((r) => r.flockId === f.id).map((r) => ({ id: r.id, date: r.date, type: 'Weight', detail: `${num(r.avgG)} g average · ${r.sample} birds${r.uniformity ? ` · ${r.uniformity}% uniform` : ''}`, by: r.by })),
    ...db.flockMoves.filter((r) => r.flockId === f.id).map((r) => ({ id: r.id, date: r.date, type: r.kind === 'sold' ? 'Sold' : r.kind === 'processed' ? 'Processed' : 'Transfer', detail: `${num(r.qty)} birds · ${r.note || ''}`, by: r.by })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const TONE = { Eggs: 'gold', Feed: 'green', Mortality: 'red', Weight: 'sky', Sold: 'violet', Processed: 'violet', Transfer: 'slate' };

  const doClose = async () => {
    if (!(await confirmDialog(`Close flock ${f.code}?`, 'Use this when the flock has been sold out, processed or depopulated. Remaining vaccinations will be cancelled.', { confirmLabel: 'Close flock' }))) return;
    closeFlock(f.id, { reason: 'Depopulated' });
    toast.success('Flock closed');
  };

  return (
    <div>
      <Link to="/app/flocks" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Flocks</Link>
      <PageHeader
        title={`${f.code} · ${f.breed}`}
        subtitle={`${farm?.name} · ${pen?.name} · ${f.species === 'chicken' ? purposeLabel(f.purpose) : speciesLabel(f.species)} · placed ${fmtDate(f.placedAt)}`}
        actions={
          f.status === 'active' && (
            <>
              {laying && <Button variant="secondary" icon={Egg} onClick={() => show('eggs', f.id)}>Eggs</Button>}
              <Button variant="secondary" icon={Wheat} onClick={() => show('feed', f.id)}>Feed</Button>
              <Button variant="secondary" icon={HeartCrack} onClick={() => show('deaths', f.id)}>Deaths</Button>
              <Button variant="secondary" icon={Scale} onClick={() => show('weight', f.id)}>Weigh</Button>
              {user.role !== 'worker' && <Button variant="ghost" icon={Archive} onClick={doClose}>Close</Button>}
            </>
          )
        }
      >
        <div className="mt-2 flex gap-2">{f.status === 'closed' ? <Badge tone="slate">Closed {fmtDate(f.closedAt)}</Badge> : <Badge tone="green" dot>Active</Badge>}<Badge tone="slate">Age {ageLabel(s.age)}</Badge></div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Birds alive" value={num(s.live)} icon={Bird} tone="brand" sub={`${num(f.opening)} placed · ${num(s.sold)} sold`} />
        {laying ? <StatCard label="Laying rate (7d)" value={`${s.layPct7}%`} icon={Egg} tone="gold" sub={`Breed target ${Math.round(s.stdLayPct)}%`} trend={`${s.layPct7 - s.stdLayPct >= 0 ? '+' : ''}${(s.layPct7 - s.stdLayPct).toFixed(1)} pts`} /> : <StatCard label="Average weight" value={s.lastWeight ? `${num(s.lastWeight.avgG)} g` : '—'} icon={Scale} tone="gold" sub={`Target now ${num(s.stdWeightNow)} g${s.fcr ? ` · FCR ${s.fcr}` : ''}`} />}
        <StatCard label="Mortality" value={`${s.mortalityPct}%`} icon={HeartCrack} tone="red" sub={`${num(s.dead)} dead · ${num(s.culled)} culled · ${s.dead7} this week`} />
        <StatCard label="Feed per bird" value={`${s.feedPerBird7} g/day`} icon={Wheat} tone="teal" sub={`Guide ${s.stdFeedNow} g · ${num(s.feedKg)} kg so far`} />
      </div>

      <Tabs className="mb-4" tabs={[{ value: 'overview', label: 'Performance' }, { value: 'records', label: 'Records', count: records.length }, { value: 'health', label: 'Health', count: vaccines.filter((v) => v.status === 'due').length }, { value: 'costs', label: 'Costs' }]} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-2">
          {laying && (
            <Card className="xl:col-span-2">
              <CardHeader title="Laying rate vs breed standard" subtitle="Hen-day % — dashed line is the target" icon={Egg} action={<Segmented options={[{ value: 30, label: '30d' }, { value: 60, label: '60d' }]} value={range} onChange={setRange} />} />
              <div className="px-3 pb-4 pt-2"><TrendChart data={daily.filter((d) => d.date < today())} series={[{ key: 'layPct', name: 'Actual %', area: true }, { key: 'std', name: 'Standard %', dashed: true }]} fmt={(v) => `${v}%`} yDomain={[0, 100]} /></div>
            </Card>
          )}
          {growth.length > 0 && (
            <Card className={laying ? '' : 'xl:col-span-2'}>
              <CardHeader title="Growth vs breed target" subtitle="Average body weight (g)" icon={Scale} />
              <div className="px-3 pb-4 pt-2"><TrendChart data={growth} x="label" series={[{ key: 'actual', name: 'Weighed', area: true }, { key: 'std', name: 'Target', dashed: true }]} fmt={(v) => `${num(v)} g`} /></div>
            </Card>
          )}
          <Card>
            <CardHeader title="Feed per bird" subtitle="Grams per bird per day vs guide" icon={Wheat} />
            <div className="px-3 pb-4 pt-2"><TrendChart data={daily.filter((d) => d.date < today())} series={[{ key: 'feedG', name: 'Given (g)' }, { key: 'stdFeed', name: 'Guide (g)', dashed: true }]} fmt={(v) => `${v} g`} height={220} /></div>
          </Card>
          <Card>
            <CardHeader title="Daily losses" subtitle="Deaths + culls" icon={HeartCrack} />
            <div className="px-3 pb-4 pt-2"><TrendChart data={daily} series={[{ key: 'dead', name: 'Birds lost', area: true, color: '#c8643b' }]} height={220} /></div>
          </Card>
          <Card className="p-5 xl:col-span-2">
            <KeyValue cols={4} items={[['Hatch date', fmtDate(f.hatchDate)], ['Placed', `${fmtDate(f.placedAt)} at ${f.ageAtPlacement || 0} days old`], ['Source', f.source], ['Cost per bird', money(f.costPerBird)], ['Eggs collected', laying || eggsAll ? num(eggsAll) : '—'], ['Feed used', `${num(s.feedKg)} kg`], ['FCR', s.fcr ?? (isMeatType(f) ? '—' : 'n/a')], ['House', `${pen?.name} · ${pen?.type}`]]} />
          </Card>
        </div>
      )}

      {tab === 'records' && (
        <DataTable
          rows={records}
          searchText={(r) => `${r.type} ${r.detail}`}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
            { key: 'type', label: 'Record', render: (r) => <Badge tone={TONE[r.type]}>{r.type}</Badge> },
            { key: 'detail', label: 'Details', className: 'whitespace-normal min-w-[240px]' },
            { key: 'by', label: 'By', render: (r) => name(r.by), hideOnMobile: true },
          ]}
        />
      )}

      {tab === 'health' && (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader title="Vaccination schedule" subtitle={`${vaccines.filter((v) => v.status === 'done').length} of ${vaccines.length} done`} icon={Syringe} />
            <div className="space-y-1 p-3">
              {vaccines.map((v) => {
                const st = vaccineState(v, today());
                return (
                  <div key={v.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-cream-100 dark:hover:bg-white/5">
                    <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">Day {v.ageDay}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{v.name}</p>
                      <p className="truncate text-xs text-slate-500">{v.method} · {st === 'done' ? `given ${fmtDate(v.doneAt)}` : `due ${fmtDate(v.dueDate)}`}</p>
                    </div>
                    <Badge tone={{ done: 'green', overdue: 'red', due: v.dueDate <= today() ? 'amber' : 'slate', skipped: 'slate' }[st]}>{st === 'due' && v.dueDate > today() ? 'Upcoming' : st}</Badge>
                    {(st === 'due' || st === 'overdue') && v.dueDate <= today() && f.status === 'active' && <Button size="sm" onClick={() => { markVaccineDone(v.id); toast.success('Recorded', v.name); }}>Given</Button>}
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <CardHeader title="Treatments" subtitle="Drugs given to this flock" />
            <div className="space-y-3 p-4">
              {!treatments.length && <p className="text-sm text-slate-500">No treatments recorded.</p>}
              {treatments.map((t) => (
                <div key={t.id} className="rounded-xl border border-cream-200 p-3 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-800 dark:text-white">{t.drug}</p>{t.withdrawalUntil && t.withdrawalUntil >= today() && <Badge tone="amber">Withdrawal</Badge>}</div>
                  <p className="text-xs text-slate-500">{fmtDate(t.date)} · {t.days} days · {t.reason}</p>
                  {t.withdrawalUntil && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">No sale of eggs/meat until {fmtDate(t.withdrawalUntil)}</p>}
                </div>
              ))}
              <Link to="/app/health?tab=treatments" className="block text-xs font-semibold text-brand-700 dark:text-gold-400">Record a treatment →</Link>
            </div>
          </Card>
        </div>
      )}

      {tab === 'costs' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <CardHeader title="Cost of this flock so far" icon={Coins} />
            <div className="mt-2 space-y-3 px-5 pb-5 text-sm">
              {[['Birds / chicks', s.birdCost], ['Feed', s.feedCost], ['Vaccines & drugs', healthCost]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-semibold">{money(v)}</span></div>
              ))}
              <div className="flex justify-between border-t border-cream-200 pt-3 text-base dark:border-white/10"><span className="font-bold">Total</span><span className="font-extrabold">{money(totalCost)}</span></div>
            </div>
          </Card>
          <Card className="p-5">
            <CardHeader title="Unit costs" />
            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              <div className="rounded-2xl bg-cream-100 p-4 dark:bg-white/5"><p className="text-xs text-slate-500">Per live bird</p><p className="text-xl font-extrabold">{money(s.live ? totalCost / s.live : 0)}</p></div>
              {laying && <div className="rounded-2xl bg-cream-100 p-4 dark:bg-white/5"><p className="text-xs text-slate-500">Feed cost per crate (7d)</p><p className="text-xl font-extrabold">{money(s.eggs7 ? ((s.feed7 * (db.items.find((i) => i.id === 'itm_layer')?.cost || 0)) / s.eggs7) * 30 : 0)}</p></div>}
              {s.fcr && <div className="rounded-2xl bg-cream-100 p-4 dark:bg-white/5"><p className="text-xs text-slate-500">FCR</p><p className="text-xl font-extrabold">{s.fcr}</p><p className="text-[11px] text-slate-400">kg feed per kg gained</p></div>}
              <div className="rounded-2xl bg-cream-100 p-4 dark:bg-white/5"><p className="text-xs text-slate-500">Feed per day now</p><p className="text-xl font-extrabold">{num(s.feed7 / 7)} kg</p></div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
