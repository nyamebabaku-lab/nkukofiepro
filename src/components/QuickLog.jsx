// "Quick log": the two-tap way for workers to record eggs, feed, deaths, weights, house conditions and vaccines.
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { Egg, Wheat, HeartCrack, Scale, Thermometer, Syringe, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useDB } from '../data/store';
import { useInScope } from '../data/selectors';
import { Modal, Button, Field, Select, Input, Stepper, Segmented, Textarea, toast, Badge, cx } from './ui';
import { today, num, fmtDate } from '../lib/format';
import { ageDays, statsFor } from '../lib/flock';
import { isLayingType, feedFor, stdWeight } from '../lib/standards';
import { itemBalance } from '../lib/stock';
import { logEggs, logFeed, logMortality, logWeight, logEnv, weighSummary, MORTALITY_CAUSES } from '../lib/records';
import { vaccineState } from '../lib/vaccines';
import { markVaccineDone } from '../lib/health';

export const useQuickLog = create((set) => ({
  open: false,
  kind: null,
  flockId: null,
  show: (kind = null, flockId = null) => set({ open: true, kind, flockId }),
  close: () => set({ open: false, kind: null, flockId: null }),
}));

export const LOG_KINDS = [
  { key: 'eggs', label: 'Eggs', icon: Egg, tone: 'bg-gold-500 text-brand-950', text: 'Collected eggs' },
  { key: 'feed', label: 'Feed & water', icon: Wheat, tone: 'bg-brand-700 text-white', text: 'Feed given' },
  { key: 'deaths', label: 'Deaths / culls', icon: HeartCrack, tone: 'bg-accent-600 text-white', text: 'Birds lost' },
  { key: 'weight', label: 'Weigh birds', icon: Scale, tone: 'bg-teal-700 text-white', text: 'Sample weights' },
  { key: 'env', label: 'House check', icon: Thermometer, tone: 'bg-orange-500 text-white', text: 'Temp & humidity' },
  { key: 'vaccine', label: 'Vaccination', icon: Syringe, tone: 'bg-sky-600 text-white', text: 'Mark as given' },
];

function FlockPicker({ flocks, value, onChange }) {
  const db = useDB();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {flocks.map((f) => {
        const s = statsFor(db, f.id);
        const farm = db.farms.find((x) => x.id === f.farmId);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={cx('rounded-2xl border p-3 text-left transition', value === f.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-500/10' : 'border-cream-200 hover:border-brand-300 dark:border-white/10')}
          >
            <p className="text-sm font-bold text-slate-900 dark:text-white">{f.code} <span className="font-medium text-slate-500">· {f.breed}</span></p>
            <p className="text-xs text-slate-500">{farm?.short} · {db.pens.find((p) => p.id === f.penId)?.name} · {num(s?.live)} birds</p>
          </button>
        );
      })}
    </div>
  );
}

export default function QuickLog() {
  const { open, kind, flockId, close, show } = useQuickLog();
  const db = useDB();
  const inScope = useInScope();
  const active = useMemo(() => db.flocks.filter((f) => f.status === 'active' && inScope(f.farmId)), [db.flocks, inScope]);
  const [form, setForm] = useState({});
  const [done, setDone] = useState(null);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setDone(null);
    const list = kind === 'eggs' ? active.filter((f) => isLayingType(f) && ageDays(f) >= 120) : active;
    const fl = flockId || (list.length === 1 ? list[0].id : '');
    const f = db.flocks.find((x) => x.id === fl);
    setForm({ flockId: fl, date: today(), large: 0, medium: 0, small: 0, jumbo: 0, cracked: 0, useTrays: true, kg: '', water: '', itemId: f ? feedFor(f, ageDays(f)) : '', dead: 1, culled: 0, cause: 'Unknown', mode: 'avg', time: new Date().toTimeString().slice(0, 5), ammonia: 'Low' });
  }, [open, kind, flockId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flock = db.flocks.find((f) => f.id === form.flockId);
  const meta = LOG_KINDS.find((k) => k.key === kind);
  const finish = (title, text) => {
    setDone({ title, text });
    toast.success(title, text);
  };

  const submit = () => {
    try {
      if (kind === 'eggs') {
        if (!flock) throw new Error('Choose a flock');
        const total = ['large', 'medium', 'small', 'jumbo', 'cracked'].reduce((a, k) => a + (+form[k] || 0), 0);
        if (!total) throw new Error('Enter the eggs collected');
        logEggs({ ...form, trays: form.useTrays ? total / 30 : 0 });
        finish('Eggs saved', `${num(total)} eggs for ${flock.code} (${Math.floor(total / 30)} crates + ${total % 30})`);
      } else if (kind === 'feed') {
        if (!flock) throw new Error('Choose a flock');
        if (!(+form.kg > 0)) throw new Error('Enter how many kg of feed');
        const { left } = logFeed({ ...form, kg: +form.kg });
        finish('Feed saved', `${form.kg} kg for ${flock.code}. ${num(Math.max(0, left))} kg left in store.`);
      } else if (kind === 'deaths') {
        if (!flock) throw new Error('Choose a flock');
        if (!(+form.dead || +form.culled)) throw new Error('Enter the number of birds');
        const pct = logMortality(form);
        finish('Saved', `${form.dead} dead, ${form.culled} culled in ${flock.code}${pct >= db.settings.mortalityAlertPct ? ' — the manager has been alerted' : ''}.`);
      } else if (kind === 'weight') {
        if (!flock) throw new Error('Choose a flock');
        const sum = form.mode === 'samples' ? weighSummary(String(form.samples || '').split(/[\s,]+/)) : form.avgG > 0 ? { sample: +form.sample || 0, avgG: +form.avgG, uniformity: form.uniformity } : null;
        if (!sum) throw new Error('Enter weights in grams');
        logWeight({ flockId: flock.id, date: form.date, ...sum });
        const std = Math.round(stdWeight(flock, ageDays(flock)));
        finish('Weighing saved', `${flock.code}: ${num(sum.avgG)} g average (target ${num(std)} g)`);
      } else if (kind === 'env') {
        if (!form.penId) throw new Error('Choose a house / pen');
        if (form.temp === undefined || form.temp === '') throw new Error('Enter the temperature');
        const pen = db.pens.find((p) => p.id === form.penId);
        const issues = logEnv({ ...form, farmId: pen.farmId });
        finish(issues.length ? 'Saved — alert sent' : 'Saved', issues.length ? issues.join('; ') : `${pen.name}: ${form.temp} °C, ${form.humidity || '—'}% humidity`);
      }
    } catch (e) {
      toast.error('Not saved', e.message);
    }
  };

  const pens = db.pens.filter((p) => inScope(p.farmId) && p.type !== 'Hatchery');
  const dueVaccines = db.vaccinations
    .filter((v) => inScope(v.farmId) && v.status === 'due' && v.dueDate <= today() && db.flocks.find((f) => f.id === v.flockId)?.status === 'active')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const eggTotal = ['large', 'medium', 'small', 'jumbo', 'cracked'].reduce((a, k) => a + (+form[k] || 0), 0);
  const feedItems = db.items.filter((i) => i.category === 'feed' && (!flock || i.farmIds.includes(flock.farmId)));

  const body = () => {
    if (done)
      return (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-4 flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><CheckCircle2 className="h-9 w-9" /></div>
          <p className="font-display text-xl font-semibold text-brand-900 dark:text-white">{done.title}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{done.text}</p>
          <div className="mt-6 flex gap-2">
            <Button variant="secondary" onClick={() => show(kind, null)}>Log another</Button>
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      );
    if (!kind)
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LOG_KINDS.map((k) => (
            <button key={k.key} type="button" onClick={() => show(k.key, flockId)} className="group flex flex-col items-start gap-3 rounded-2xl border border-cream-200 bg-cream-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift active:scale-[.98] dark:border-white/10 dark:bg-white/5">
              <span className={cx('flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg', k.tone)}><k.icon className="h-6 w-6" /></span>
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{k.label}</span>
                <span className="block text-xs text-slate-500">{k.text}</span>
              </span>
            </button>
          ))}
        </div>
      );
    if (kind === 'vaccine')
      return dueVaccines.length ? (
        <div className="space-y-2">
          {dueVaccines.map((v) => {
            const f = db.flocks.find((x) => x.id === v.flockId);
            const st = vaccineState(v, today());
            return (
              <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-cream-200 p-3 dark:border-white/10">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{v.name}</p>
                  <p className="text-xs text-slate-500">{f?.code} · {v.method} · due {fmtDate(v.dueDate)}</p>
                </div>
                <Badge tone={st === 'overdue' ? 'red' : 'amber'}>{st === 'overdue' ? 'Overdue' : 'Today'}</Badge>
                <Button size="sm" onClick={() => { markVaccineDone(v.id, {}); toast.success('Vaccination recorded', `${v.name} · ${f?.code}`); }}>Given</Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">No vaccinations due today. 🎉</p>
      );

    const flockList = kind === 'eggs' ? active.filter((f) => isLayingType(f) && ageDays(f) >= 120) : active;
    return (
      <div className="space-y-5">
        {kind !== 'env' && (
          <div>
            <span className="label">Flock</span>
            <FlockPicker flocks={flockList} value={form.flockId} onChange={(id) => { const f = db.flocks.find((x) => x.id === id); setForm((s) => ({ ...s, flockId: id, itemId: feedFor(f, ageDays(f)) })); }} />
          </div>
        )}
        {kind === 'eggs' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {[['large', 'Large'], ['medium', 'Medium'], ['small', 'Small'], ['jumbo', 'Jumbo'], ['cracked', 'Cracked / broken']].map(([k, l]) => (
                <Field key={k} label={`${l} eggs`}><Stepper value={form[k]} onChange={(v) => set(k, v)} step={30} /></Field>
              ))}
              <Field label="Date"><Input type="date" value={form.date} max={today()} onChange={(e) => set('date', e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gold-50 p-4 dark:bg-gold-500/10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-800 dark:text-gold-300">Total</p>
                <p className="font-display text-2xl font-semibold text-brand-900 dark:text-white">{num(eggTotal)} eggs</p>
                <p className="text-xs text-slate-500">{Math.floor(eggTotal / 30)} crates + {eggTotal % 30} · steppers move in crates of 30</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.useTrays} onChange={(e) => set('useTrays', e.target.checked)} /> Take egg trays from store</label>
            </div>
          </>
        )}
        {kind === 'feed' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Feed type" hint={form.itemId && flock ? `${num(itemBalance(db, form.itemId, flock.farmId))} kg in store at this farm` : ''}>
              <Select value={form.itemId} onChange={(e) => set('itemId', e.target.value)} options={feedItems.map((i) => ({ value: i.id, label: i.name }))} />
            </Field>
            <Field label="Date"><Input type="date" value={form.date} max={today()} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Feed given (kg)" hint={flock ? `Guide: about ${num((statsFor(db, flock.id).live * statsFor(db, flock.id).stdFeedNow) / 1000)} kg a day for this flock` : ''}>
              <Stepper value={form.kg} onChange={(v) => set('kg', v)} step={25} />
            </Field>
            <Field label="Water (litres, optional)"><Input inputMode="decimal" value={form.water} onChange={(e) => set('water', e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {[1, 2, 4, 6, 10].map((b) => (
                <button key={b} type="button" onClick={() => set('kg', b * (db.settings.feedBagKg || 50))} className="rounded-full bg-cream-200 px-3 py-1.5 text-xs font-semibold text-brand-800 dark:bg-white/10 dark:text-white">{b} bag{b > 1 ? 's' : ''}</button>
              ))}
            </div>
          </div>
        )}
        {kind === 'deaths' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dead birds"><Stepper value={form.dead} onChange={(v) => set('dead', v)} /></Field>
            <Field label="Culled (removed)"><Stepper value={form.culled} onChange={(v) => set('culled', v)} /></Field>
            <Field label="Likely cause"><Select value={form.cause} onChange={(e) => set('cause', e.target.value)} options={MORTALITY_CAUSES} /></Field>
            <Field label="Date"><Input type="date" value={form.date} max={today()} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Notes (signs seen)" className="sm:col-span-2"><Textarea value={form.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="e.g. birds gasping, droppings watery…" /></Field>
          </div>
        )}
        {kind === 'weight' && (
          <div className="space-y-4">
            <Segmented options={[{ value: 'avg', label: 'Average weight' }, { value: 'samples', label: 'Each bird' }]} value={form.mode} onChange={(v) => set('mode', v)} />
            {form.mode === 'avg' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Average weight (g)"><Input inputMode="numeric" value={form.avgG || ''} onChange={(e) => set('avgG', e.target.value)} /></Field>
                <Field label="Birds weighed"><Input inputMode="numeric" value={form.sample || ''} onChange={(e) => set('sample', e.target.value)} /></Field>
                <Field label="Uniformity %"><Input inputMode="numeric" value={form.uniformity || ''} onChange={(e) => set('uniformity', e.target.value)} /></Field>
              </div>
            ) : (
              <Field label="Weights in grams, separated by spaces or commas" hint={(() => { const s = weighSummary(String(form.samples || '').split(/[\s,]+/)); return s ? `${s.sample} birds · average ${num(s.avgG)} g · uniformity ${s.uniformity}%` : 'e.g. 1850 1920 1780 2010'; })()}>
                <Textarea value={form.samples || ''} onChange={(e) => set('samples', e.target.value)} />
              </Field>
            )}
            {flock && <p className="text-xs text-slate-500">Breed target at {Math.floor(ageDays(flock) / 7)} weeks: <b>{num(stdWeight(flock, ageDays(flock)))} g</b></p>}
          </div>
        )}
        {kind === 'env' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="House / pen" className="sm:col-span-2">
              <Select value={form.penId || ''} placeholder="Choose…" onChange={(e) => set('penId', e.target.value)} options={pens.map((p) => ({ value: p.id, label: `${db.farms.find((f) => f.id === p.farmId)?.short} · ${p.name}` }))} />
            </Field>
            <Field label="Temperature (°C)"><Input inputMode="decimal" value={form.temp ?? ''} onChange={(e) => set('temp', e.target.value)} /></Field>
            <Field label="Humidity (%)"><Input inputMode="numeric" value={form.humidity ?? ''} onChange={(e) => set('humidity', e.target.value)} /></Field>
            <Field label="Time"><Input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} /></Field>
            <div>
              <span className="label">Ammonia smell</span>
              <Segmented options={['Low', 'Moderate', 'High']} value={form.ammonia} onChange={(v) => set('ammonia', v)} />
            </div>
            <Field label="Notes" className="sm:col-span-2"><Input value={form.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="Fans, curtains, litter…" /></Field>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={done ? 'Saved' : meta ? meta.label : 'Quick log'}
      subtitle={!done && !meta ? 'What would you like to record?' : !done && meta ? `Recording for ${fmtDate(form.date || today())}` : undefined}
      size="lg"
      footer={
        !done && kind && kind !== 'vaccine' ? (
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => show(null, flockId)} className="mr-auto">Back</Button>
            <Button size="lg" onClick={submit}>Save record</Button>
          </>
        ) : null
      }
    >
      {body()}
    </Modal>
  );
}
