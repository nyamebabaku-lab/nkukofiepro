// A flock's care plan: where it is in its programme, what to feed and do today, what's coming,
// the feed plan to sale and sale readiness.
import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { CheckCircle2, Circle, Thermometer, Sun, Wheat, Droplets, Ruler, CalendarClock, Sparkles, ChevronDown, AlertTriangle, Scale, RotateCcw } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser } from '../../data/selectors';
import { Card, CardHeader, Badge, Button, Progress, KeyValue, Select, Field, confirmDialog, toast, cx } from '../../components/ui';
import { programmeFor, stageAt, tempRangeAt } from '../../lib/programmes';
import { tasksFor, toggleTask, installProgramme, removeProgramme, isMine } from '../../lib/tasks';
import { feedPlan, saleReadiness } from '../../lib/feedplan';
import { flockIndex, ageLabel } from '../../lib/flock';
import { num, money, fmtDate, today, dayKey } from '../../lib/format';

export default function CarePlan({ f, totalCost }) {
  const db = useDB();
  const user = useCurrentUser();
  const [open, setOpen] = useState(null);
  const [assignee, setAssignee] = useState('');
  const p = programmeFor(f);
  const s = flockIndex(db).get(f.id);
  if (!p || !s) return null;
  const age = s.age;
  const stage = stageAt(p, age);
  const temp = tempRangeAt(p, age);
  const plan = f.status === 'active' ? feedPlan(db, f, 120) : null;
  const sale = saleReadiness(db, f);
  const installed = db.tasks.some((t) => t.flockId === f.id && t.auto);
  const canManage = user.role !== 'worker';
  const dateAt = (day) => format(addDays(parseISO(f.hatchDate), day), 'yyyy-MM-dd');
  const todays = tasksFor(db, { date: today() }).filter((t) => t.flockId === f.id);
  const soon = [
    ...db.tasks.filter((t) => t.flockId === f.id && t.repeat === 'once' && t.date >= today() && t.date <= dayKey(14)).map((t) => ({ date: t.date, title: t.title.replace(` · ${f.code}`, ''), kind: t.category === 'feeding' ? 'Feed' : t.category === 'sales' ? 'Sale' : 'Task', important: t.important })),
    ...db.vaccinations.filter((v) => v.flockId === f.id && v.status === 'due' && v.dueDate <= dayKey(14)).map((v) => ({ date: v.dueDate, title: `${v.name} — ${v.method}`, kind: v.kind === 'vaccine' ? 'Vaccine' : v.kind === 'deworm' ? 'Deworm' : 'Medicine', important: true })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const progress = Math.min(100, Math.max(0, (age / (p.end || 1)) * 100));

  const install = async () => {
    if (installed && !(await confirmDialog('Re-install the care programme?', 'Automatic tasks for this flock are recreated from today. Tasks you added by hand stay.', { danger: false, confirmLabel: 'Re-install' }))) return;
    const n = installProgramme(f, { assigneeId: assignee || null });
    toast.success('Care programme installed', `${n} tasks created`);
  };
  const remove = async () => {
    if (!(await confirmDialog('Remove the care programme tasks?', 'The automatic tasks for this flock are deleted. The guide stays available.'))) return;
    removeProgramme(f.id);
    toast.success('Programme tasks removed');
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="grain hero-glow bg-brand-800 p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-gold-300">{p.emoji} {p.name} care programme</p>
              <p className="mt-1 font-display text-3xl font-semibold">{stage?.name}</p>
              <p className="text-sm text-brand-100/80">Day {age} · {ageLabel(age)}{stage ? ` · stage runs days ${Math.max(stage.from, 0)}–${stage.to}` : ''}</p>
            </div>
            {sale && f.status === 'active' && <Badge tone={sale.overdue ? 'red' : sale.ready ? 'green' : 'gold'}>{sale.overdue ? 'Past best sale age' : sale.ready ? 'Ready for sale' : `Sale in ${sale.daysLeft} days`}</Badge>}
          </div>
          <Progress className="mt-4 h-2" value={progress} tone="gold" />
          <p className="mt-2 text-xs text-brand-100/70">{p.summary}</p>
        </div>
        {canManage && f.status === 'active' && (
          <div className="flex flex-wrap items-end gap-3 border-t border-cream-200 p-4 dark:border-white/10">
            {!installed && <p className="w-full text-sm text-slate-600 dark:text-slate-300">Install the programme to create this flock’s daily tasks, feed changes and reminders automatically.</p>}
            <Field label="Send daily tasks to" className="min-w-[200px]"><Select value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Whole farm team" options={db.users.filter((u) => u.role !== 'owner' && u.status !== 'inactive' && (u.farmIds || []).includes(f.farmId)).map((u) => ({ value: u.id, label: u.name }))} /></Field>
            <Button icon={installed ? RotateCcw : Sparkles} onClick={install}>{installed ? 'Re-install programme' : 'Install care programme'}</Button>
            {installed && <Button variant="secondary" onClick={remove}>Remove programme tasks</Button>}
          </div>
        )}
      </Card>

      {f.status === 'active' && stage && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="p-4 xl:col-span-2"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Wheat className="h-4 w-4 text-gold-600" /> Feed now</p><p className="mt-1 text-lg font-extrabold">{stage.feed?.name || '—'}</p><p className="text-xs text-slate-500">{stage.feed ? `${stage.feed.protein} protein · ${stage.feed.form}` : 'Prepare feed before arrival'}</p>{plan && <p className="mt-2 text-sm">Today: <b>{num(plan.todayKg, 1)} kg</b> ({num(plan.todayBags, 1)} bags) · {plan.gPerBird} g per bird</p>}{plan?.nextChange && <p className="mt-1 text-xs font-semibold text-accent-600">Change to {plan.nextChange.feed} on {fmtDate(plan.nextChange.date)}</p>}</Card>
          <Card className="p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Thermometer className="h-4 w-4 text-accent-600" /> Temperature</p><p className="mt-1 text-lg font-extrabold">{temp ? `${temp[0]}–${temp[1]} °C` : 'No extra heat'}</p><p className="text-xs text-slate-500">{stage.tempNote || (temp ? 'At bird level' : 'Keep cool and well ventilated')}</p></Card>
          <Card className="p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Sun className="h-4 w-4 text-gold-600" /> Light</p><p className="mt-1 text-sm font-semibold">{stage.light}</p></Card>
          <Card className="p-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Ruler className="h-4 w-4 text-brand-600" /> Space & water</p><p className="mt-1 text-sm font-semibold">{stage.space}</p>{stage.water && <p className="mt-1 flex items-start gap-1 text-xs text-slate-500"><Droplets className="mt-0.5 h-3 w-3 shrink-0" />{stage.water}</p>}</Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Today’s care tasks" subtitle={installed ? `${todays.filter((t) => t.done).length} of ${todays.length} done` : 'Install the programme to get daily tasks'} />
          <div className="p-3">
            {!todays.length && <p className="p-3 text-sm text-slate-500">No care tasks today.</p>}
            {todays.map((t) => (
              <button key={t.id} type="button" disabled={!(isMine(t, user) || canManage)} onClick={() => toggleTask(t.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-cream-100 dark:hover:bg-white/5">
                {t.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className={cx('h-5 w-5 shrink-0', t.overdue ? 'text-accent-500' : 'text-slate-300')} />}
                <span className="min-w-0 flex-1"><span className={cx('block text-sm', t.done ? 'text-slate-400 line-through' : 'font-semibold')}>{t.title.replace(` · ${f.code}`, '')}</span><span className="text-xs text-slate-500">{t.time}{t.important ? ' · urgent' : ''}</span></span>
                {t.overdue && <Badge tone="red">Late</Badge>}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Coming up (14 days)" icon={CalendarClock} />
          <div className="divide-y divide-cream-200 px-5 pb-3 dark:divide-white/5">
            {!soon.length && <p className="py-3 text-sm text-slate-500">Nothing special in the next two weeks.</p>}
            {soon.map((x, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 text-sm">
                <span className="w-16 shrink-0 text-xs font-bold text-slate-500">{x.date === today() ? 'Today' : fmtDate(x.date, 'EEE d MMM')}</span>
                <span className="min-w-0 flex-1">{x.title}</span>
                <Badge tone={x.kind === 'Vaccine' ? 'violet' : x.kind === 'Feed' ? 'gold' : x.kind === 'Sale' ? 'green' : 'slate'}>{x.kind}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {sale && f.status === 'active' && (
        <Card>
          <CardHeader title="Growth & sale targets" icon={Scale} subtitle={sale.label} />
          <div className="p-5">
            <KeyValue cols={4} items={[
              ['Latest weight', sale.weight ? `${num(sale.weight)} g` : 'Not weighed yet'],
              ['Target for today', `${num(sale.stdNow)} g`],
              ['Sale weight target', `${num(sale.target)} g`],
              ['Sale from', `${fmtDate(sale.fromDate)}${sale.daysLeft > 0 ? ` (${sale.daysLeft} days)` : ''}`],
              ['Feed conversion (FCR)', sale.fcr ? `${sale.fcr} kg feed per kg` : '—'],
              ['Cost so far per bird', s.live ? money(totalCost / s.live) : '—'],
              ['Feed to sale', sale.feedToSaleKg ? `${num(sale.feedToSaleKg)} kg` : '—'],
              ['Feed cost to sale', sale.feedToSaleCost ? money(sale.feedToSaleCost) : '—'],
            ]} />
            {sale.weight && sale.weight < sale.stdNow * 0.9 && <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Birds are more than 10% under the target weight. Check feed quality and quantity, water, space, heat and disease.</p>}
          </div>
        </Card>
      )}

      {plan && (
        <Card>
          <CardHeader title="Feed plan" subtitle={`For ${num(plan.live)} birds · this week ${num(plan.weekKg)} kg (${plan.weekBags} bags of ${db.settings.feedBagKg || 50} kg)`} icon={Wheat} />
          <div className="overflow-x-auto px-5 pb-4">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2">Feed</th><th>Dates</th><th className="text-right">Need</th><th className="text-right">Bags</th><th className="text-right">In stock</th></tr></thead>
              <tbody className="divide-y divide-cream-200 dark:divide-white/5">
                {plan.byFeed.map((b) => (
                  <tr key={b.from}>
                    <td className="py-2"><b>{b.feed}</b><span className="block text-xs text-slate-500">{b.protein} protein · {b.stage}</span></td>
                    <td className="text-xs">{fmtDate(b.from, 'd MMM')} – {fmtDate(b.to, 'd MMM')}<span className="block text-slate-400">{b.days} days</span></td>
                    <td className="text-right font-semibold">{num(b.kg)} kg</td>
                    <td className="text-right">{b.bags}</td>
                    <td className={cx('text-right text-xs', b.inStock != null && b.inStock < b.kg ? 'font-semibold text-accent-600' : 'text-slate-500')}>{b.inStock == null ? 'Not in inventory' : `${num(b.inStock)} kg${b.inStock < b.kg ? ' — buy more' : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Full programme" subtitle="Tap a stage to see goals and what to watch for" />
        <div className="space-y-2 p-4">
          {p.stages.map((st) => {
            const now = st === stage;
            const isOpen = open === st.key || (open === null && now);
            return (
              <div key={st.key} className={cx('rounded-2xl border', now ? 'border-gold-400 bg-gold-50/60 dark:bg-gold-500/10' : 'border-cream-200 dark:border-white/10')}>
                <button type="button" onClick={() => setOpen(isOpen ? '' : st.key)} className="flex w-full items-center gap-3 p-3 text-left">
                  <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', age > st.to ? 'bg-emerald-500' : now ? 'bg-gold-500' : 'bg-slate-300')} />
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{st.name}{now && <Badge tone="gold" className="ml-2">Now</Badge>}</span><span className="text-xs text-slate-500">Days {st.from}–{st.to} · {fmtDate(dateAt(st.from), 'd MMM')} – {fmtDate(dateAt(st.to), 'd MMM yyyy')}{st.feed ? ` · ${st.feed.name}` : ''}</span></span>
                  <ChevronDown className={cx('h-4 w-4 shrink-0 transition', isOpen && 'rotate-180')} />
                </button>
                {isOpen && <StageDetail st={st} />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export function StageDetail({ st }) {
  return (
    <div className="grid gap-4 border-t border-cream-200 p-4 text-sm sm:grid-cols-2 dark:border-white/10">
      <KeyValue cols={2} items={[
        ['Feed', st.feed ? `${st.feed.name} (${st.feed.protein} protein, ${st.feed.form})` : '—'],
        ['Temperature', st.tempNote || (st.temp ? `${st.temp[0]}–${st.temp[1]} °C` : 'No extra heat')],
        ['Light', st.light],
        ['Space', st.space],
        ...(st.water ? [['Water', st.water]] : []),
      ]} />
      <div className="space-y-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Goals</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{st.goals.map((g) => <li key={g}>{g}</li>)}</ul></div>
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">Watch for</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{st.watch.map((g) => <li key={g}>{g}</li>)}</ul></div>
      </div>
    </div>
  );
}
