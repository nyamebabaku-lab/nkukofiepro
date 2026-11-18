// Care guide: every programme from the week before arrival to sale, the feed planner,
// biosecurity & disease signs, and drug withdrawal periods.
import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { BookOpen, Wheat, ShieldCheck, Pill, CalendarDays, Syringe, ListChecks, AlertTriangle } from 'lucide-react';
import { useDB } from '../../data/store';
import { useInScope } from '../../data/selectors';
import { PageHeader, Card, CardHeader, Tabs, Badge, Segmented, DataTable, EmptyState, cx } from '../../components/ui';
import { PROGRAMME_LIST, PROGRAMMES, BIOSECURITY_RULES, DISEASES } from '../../lib/programmes';
import { DEFAULT_TEMPLATES } from '../../lib/vaccines';
import { DRUGS } from '../../lib/drugs';
import { farmFeedNeeds, feedPlan } from '../../lib/feedplan';
import { activeFlocks } from '../../lib/flock';
import { num, fmtDate } from '../../lib/format';
import { StageDetail } from '../flocks/CarePlan';

const dayLabel = (d) => (d < 0 ? `${-d} day${d === -1 ? '' : 's'} before` : d === 0 ? 'Arrival day' : d < 14 ? `Day ${d}` : `Week ${Math.floor(d / 7)}${d % 7 ? ` + ${d % 7}d` : ''}`);

export default function Guide() {
  const db = useDB();
  const inScope = useInScope();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'guide';
  const setTab = (t) => setParams({ tab: t });
  const [pid, setPid] = useState('broiler');
  const [span, setSpan] = useState(7);
  const p = PROGRAMMES[pid];
  const templates = db.vaccineTemplates?.length ? db.vaccineTemplates : DEFAULT_TEMPLATES;
  const vt = templates.find((t) => (pid === 'layer' ? t.id === 'vtp_layer' : pid === 'cockerel' ? t.id === 'vtp_cockerel' : t.id === `vtp_${pid}`)) || templates.find((t) => t.name.toLowerCase().startsWith(p.name.toLowerCase().slice(0, 5)));
  const flocks = activeFlocks(db).filter((f) => inScope(f.farmId));
  const needs = farmFeedNeeds(db, flocks, span);
  const farm = (id) => db.farms.find((f) => f.id === id);

  return (
    <div>
      <PageHeader title="Care guide" subtitle="Step-by-step care from the week before birds arrive to sale — feeds, heat, light, vaccines and daily routines" />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: 'guide', label: 'Guide by bird' }, { value: 'feed', label: 'Feed planner' }, { value: 'bio', label: 'Biosecurity & diseases' }, { value: 'drugs', label: 'Drugs & withdrawal' }]} />

      {tab === 'guide' && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {PROGRAMME_LIST.map((x) => (
              <button key={x.id} type="button" onClick={() => setPid(x.id)} className={cx('rounded-full px-4 py-2 text-sm font-semibold ring-1', pid === x.id ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white ring-cream-300 dark:bg-navy-900 dark:ring-white/10')}>{x.emoji} {x.name}</button>
            ))}
          </div>
          <Card className="mb-6 overflow-hidden">
            <div className="grain hero-glow bg-brand-800 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-gold-300">{p.emoji} {p.name}</p>
              <p className="mt-2 max-w-3xl text-lg">{p.summary}</p>
              {p.sale && <p className="mt-2 text-sm text-brand-100/80">{p.sale.label}</p>}
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-brand-900 dark:text-white"><CalendarDays className="h-5 w-5" /> Stages</h2>
              {p.stages.map((st, i) => (
                <Card key={st.key}>
                  <div className="flex items-center gap-3 p-4 pb-0"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-800">{i + 1}</span><div><p className="font-semibold">{st.name}</p><p className="text-xs text-slate-500">{dayLabel(st.from)} → {dayLabel(st.to)}{st.feed ? ` · ${st.feed.name}` : ''}</p></div></div>
                  <StageDetail st={st} />
                </Card>
              ))}
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Key dates & feed changes" icon={ListChecks} />
                <ol className="space-y-2 px-5 pb-4 text-sm">
                  {p.milestones.map((m, i) => (
                    <li key={i} className="flex gap-3"><span className="w-24 shrink-0 text-xs font-bold text-slate-500">{dayLabel(m.day)}</span><span className={m.important ? 'font-semibold' : ''}>{m.title}</span></li>
                  ))}
                </ol>
              </Card>
              <Card>
                <CardHeader title="Vaccination & medication schedule" subtitle="Standard Ghana practice — confirm with your vet. Edit in Settings." icon={Syringe} />
                <ol className="space-y-2 px-5 pb-4 text-sm">
                  {(vt?.items || []).map((v, i) => (
                    <li key={i} className="flex gap-3"><span className="w-24 shrink-0 text-xs font-bold text-slate-500">{dayLabel(v.day)}</span><span><b>{v.name}</b><span className="block text-xs text-slate-500">{v.method}</span></span></li>
                  ))}
                </ol>
              </Card>
              <Card>
                <CardHeader title="Daily routine" subtitle="Installed as tasks with reminders on each new flock" icon={ListChecks} />
                <ul className="space-y-2 px-5 pb-4 text-sm">
                  {p.routines.slice().sort((a, b) => a.time.localeCompare(b.time)).map((r, i) => (
                    <li key={i} className="flex gap-3"><span className="w-12 shrink-0 text-xs font-bold text-slate-500">{r.time}</span><span>{r.title}<span className="block text-xs text-slate-400">{r.repeat === 'weekly' ? 'Weekly · ' : ''}{dayLabel(Math.max(r.from, -7))} → {r.to > 2000 ? 'end' : dayLabel(r.to)}</span></span></li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}

      {tab === 'feed' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-500">Feed needed by all active flocks, from breed feed guides and live bird numbers.</p>
            <Segmented className="ml-auto" options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} value={span} onChange={setSpan} />
          </div>
          {!flocks.length ? <Card><EmptyState icon={Wheat} title="No active flocks" text="Place a flock to see its feed plan." /></Card> : (
            <div className="space-y-6">
              <DataTable
                rows={needs}
                search={false}
                columns={[
                  { key: 'feed', label: 'Feed', render: (r) => <b>{r.feed}</b> },
                  { key: 'farm', label: 'Farm', render: (r) => farm(r.farmId)?.short },
                  { key: 'kg', label: `Need (${span} days)`, render: (r) => `${num(r.kg)} kg` },
                  { key: 'bags', label: 'Bags', render: (r) => r.bags },
                  { key: 'stock', label: 'In stock', render: (r) => (r.inStock == null ? <span className="text-xs text-slate-400">Not in inventory</span> : `${num(r.inStock)} kg`) },
                  { key: 'short', label: 'To buy', render: (r) => (r.short == null ? '—' : r.short > 0 ? <Badge tone="red">{num(r.short)} kg</Badge> : <Badge tone="green">Enough</Badge>) },
                  { key: 'flocks', label: 'Flocks', render: (r) => <span className="text-xs">{r.flocks.join(', ')}</span>, hideOnMobile: true },
                ]}
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {flocks.map((f) => {
                  const pl = feedPlan(db, f, 60);
                  if (!pl) return null;
                  return (
                    <Card key={f.id} className="p-4">
                      <div className="flex items-start justify-between"><Link to={`/app/flocks/${f.id}`} className="font-display text-lg font-semibold text-brand-900 hover:underline dark:text-white">{f.code}</Link><Badge tone="gold">{pl.stage?.name}</Badge></div>
                      <p className="text-xs text-slate-500">{farm(f.farmId)?.short} · {num(pl.live)} birds</p>
                      <p className="mt-3 text-sm"><b>{pl.stage?.feed?.name || '—'}</b> · {pl.gPerBird} g per bird</p>
                      <p className="text-sm">Today <b>{num(pl.todayKg, 1)} kg</b> · this week <b>{num(pl.weekKg)} kg</b> ({pl.weekBags} bags)</p>
                      {pl.nextChange && <p className="mt-2 text-xs font-semibold text-accent-600">Change to {pl.nextChange.feed} on {fmtDate(pl.nextChange.date)}</p>}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'bio' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Biosecurity rules" icon={ShieldCheck} subtitle="Keep disease out — cheaper than any medicine" />
            <ol className="list-decimal space-y-2 px-9 pb-5 text-sm">{BIOSECURITY_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
          </Card>
          <Card>
            <CardHeader title="Disease signs & what to do" icon={AlertTriangle} subtitle="Call your vet early — these are guides, not a diagnosis" />
            <div className="divide-y divide-cream-200 px-5 pb-3 dark:divide-white/5">
              {DISEASES.map((d) => (
                <div key={d.name} className="py-3 text-sm"><p className="font-semibold">{d.name}</p><p className="text-slate-600 dark:text-slate-300"><b>Signs:</b> {d.signs}</p><p className="text-slate-600 dark:text-slate-300"><b>Do:</b> {d.action}</p></div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'drugs' && (
        <>
          <Card className="mb-4 flex items-start gap-3 p-4 text-sm"><Pill className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" /><p>Withdrawal period = days after the <b>last dose</b> before eggs or meat may be sold or eaten. These are typical values — <b>the product label always wins</b>. When you record a treatment, the app fills this in and warns at the point of sale until it ends.</p></Card>
          <DataTable
            rows={DRUGS}
            searchText={(d) => `${d.name} ${d.use}`}
            columns={[
              { key: 'name', label: 'Drug', render: (d) => <b>{d.name}</b> },
              { key: 'use', label: 'Used for', className: 'whitespace-normal' },
              { key: 'meat', label: 'Meat (days)', render: (d) => d.meat },
              { key: 'eggs', label: 'Eggs (days)', render: (d) => (d.eggs == null ? <Badge tone="red">Not for layers</Badge> : d.eggs) },
            ]}
          />
        </>
      )}
      <p className="mt-8 flex items-center gap-2 text-xs text-slate-400"><BookOpen className="h-3.5 w-3.5" /> Based on common Ghana practice and breed guides. Always follow your vet, the feed bag and the vaccine/drug labels where they differ.</p>
    </div>
  );
}
