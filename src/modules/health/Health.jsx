import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import { Syringe, Pill, CalendarDays, List, Plus, ChevronLeft, ChevronRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope } from '../../data/selectors';
import { PageHeader, Button, Tabs, Badge, Card, CardHeader, DataTable, FormModal, Modal, Field, Input, Select, StatCard, Segmented, IconButton, toast, cx } from '../../components/ui';
import { vaccineState } from '../../lib/vaccines';
import { markVaccineDone, skipVaccine, addTreatment } from '../../lib/health';
import { fmtDate, today, dayKey } from '../../lib/format';

const ST_TONE = { done: 'green', overdue: 'red', due: 'amber', skipped: 'slate' };

function GiveModal({ v, onClose }) {
  const db = useDB();
  const [form, setForm] = useState({});
  if (!v) return null;
  const f = db.flocks.find((x) => x.id === v.flockId);
  const items = db.items.filter((i) => ['vaccine', 'drug'].includes(i.category) && i.farmIds.includes(v.farmId));
  return (
    <Modal open onClose={onClose} title={`Record: ${v.name}`} subtitle={`${f?.code} · ${v.method}`} size="sm" footer={<><Button variant="ghost" className="mr-auto" onClick={() => { skipVaccine(v.id, form.note || 'Skipped'); toast.info('Marked as skipped'); onClose(); }}>Skip</Button><Button onClick={() => { markVaccineDone(v.id, { batchNo: form.batchNo, note: form.note, date: form.date || today(), itemId: form.itemId }); toast.success('Vaccination recorded', `${v.name} · ${f?.code}`); onClose(); }}>Save as given</Button></>}>
      <div className="space-y-4">
        <Field label="Date given"><Input type="date" max={today()} value={form.date || today()} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Vaccine used from store" hint="Stock is reduced automatically"><Select placeholder="Auto-match" value={form.itemId ?? ''} onChange={(e) => setForm({ ...form, itemId: e.target.value || undefined })} options={items.map((i) => ({ value: i.id, label: i.name }))} /></Field>
        <Field label="Batch number"><Input value={form.batchNo || ''} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} placeholder="From the vial label" /></Field>
        <Field label="Notes"><Input value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function Calendar({ list, onPick }) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const start = addDays(month, -getDay(month));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const t = today();
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth(startOfMonth(addDays(month, -1)))} />
        <p className="font-display text-lg font-semibold text-brand-900 dark:text-white">{format(month, 'MMMM yyyy')}</p>
        <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth(startOfMonth(addDays(endOfMonth(month), 1)))} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = format(d, 'yyyy-MM-dd');
          const items = list.filter((v) => (v.status === 'done' ? v.doneAt : v.dueDate) === k);
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <div key={k} className={cx('min-h-[86px] rounded-xl border p-1.5 text-left', inMonth ? 'border-cream-200 bg-white dark:border-white/5 dark:bg-navy-900' : 'border-transparent bg-cream-100/50 opacity-50 dark:bg-white/[.02]', k === t && 'ring-2 ring-gold-500')}>
              <p className={cx('text-xs font-bold', k === t ? 'text-gold-600' : 'text-slate-500')}>{d.getDate()}</p>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((v) => {
                  const st = vaccineState(v, t);
                  return (
                    <button key={v.id} type="button" onClick={() => onPick(v)} className={cx('block w-full truncate rounded-md px-1 py-0.5 text-left text-[10px] font-semibold', { done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', overdue: 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300', due: 'bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300', skipped: 'bg-cream-200 text-slate-500' }[st])}>
                      {useDB.getState().flocks.find((f) => f.id === v.flockId)?.code} {v.name}
                    </button>
                  );
                })}
                {items.length > 3 && <p className="px-1 text-[10px] text-slate-400">+{items.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Health() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'vaccines';
  const [view, setView] = useState('list');
  const [filter, setFilter] = useState('upcoming');
  const [giving, setGiving] = useState(null);
  const [treating, setTreating] = useState(false);
  const t = today();
  const activeIds = new Set(db.flocks.filter((f) => f.status === 'active').map((f) => f.id));
  const all = useMemo(() => db.vaccinations.filter((v) => inScope(v.farmId) && (activeIds.has(v.flockId) || v.status === 'done')), [db.vaccinations, inScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const overdue = all.filter((v) => vaccineState(v, t) === 'overdue');
  const week = all.filter((v) => v.status === 'due' && v.dueDate >= t && v.dueDate <= dayKey(7));
  const doneMonth = all.filter((v) => v.status === 'done' && v.doneAt >= dayKey(-30));
  const withdrawals = db.treatments.filter((r) => inScope(r.farmId) && r.withdrawalUntil && r.withdrawalUntil >= t);
  const code = (id) => db.flocks.find((f) => f.id === id)?.code;
  const rows = {
    upcoming: all.filter((v) => v.status === 'due').sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    done: all.filter((v) => v.status !== 'due').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')),
  }[filter];
  const items = db.items.filter((i) => ['drug', 'vaccine'].includes(i.category));

  return (
    <div>
      <PageHeader title="Health & vaccines" subtitle="Vaccination schedules, treatments and drug withdrawal periods" actions={user.role !== 'worker' && <Button icon={Plus} onClick={() => setTreating(true)}>Record treatment</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Overdue" value={overdue.length} icon={ShieldAlert} tone="red" sub="vaccinations missed" />
        <StatCard label="Next 7 days" value={week.length} icon={CalendarDays} tone="gold" sub="vaccinations due" />
        <StatCard label="Given (30 days)" value={doneMonth.length} icon={CheckCircle2} tone="green" />
        <StatCard label="In withdrawal" value={withdrawals.length} icon={Pill} tone="orange" sub="flocks — don't sell produce" />
      </div>
      {withdrawals.length > 0 && (
        <div className="mb-6 space-y-2">
          {withdrawals.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p><b>{code(r.flockId)}</b> is on <b>{r.drug}</b>. Do not sell its eggs or meat until <b>{fmtDate(r.withdrawalUntil)}</b>. The shop warns staff automatically.</p>
            </div>
          ))}
        </div>
      )}
      <Tabs className="mb-4" value={tab} onChange={(v) => setParams({ tab: v })} tabs={[{ value: 'vaccines', label: 'Vaccinations', icon: Syringe, count: overdue.length + week.length }, { value: 'treatments', label: 'Treatments', icon: Pill, count: db.treatments.filter((r) => inScope(r.farmId)).length }]} />
      {tab === 'vaccines' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented options={[{ value: 'list', label: <span className="flex items-center gap-1"><List className="h-3.5 w-3.5" /> List</span> }, { value: 'calendar', label: <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Calendar</span> }]} value={view} onChange={setView} />
            {view === 'list' && <Segmented options={[{ value: 'upcoming', label: 'Due & upcoming' }, { value: 'done', label: 'History' }]} value={filter} onChange={setFilter} />}
          </div>
          {view === 'calendar' ? (
            <Calendar list={all} onPick={(v) => v.status === 'due' && v.dueDate <= dayKey(1) && setGiving(v)} />
          ) : (
            <DataTable
              rows={rows}
              searchText={(v) => `${code(v.flockId)} ${v.name}`}
              columns={[
                { key: 'dueDate', label: filter === 'done' ? 'Date' : 'Due', render: (v) => fmtDate(v.status === 'due' ? v.dueDate : v.doneAt) },
                { key: 'flock', label: 'Flock', sort: (v) => code(v.flockId), render: (v) => <b>{code(v.flockId)}</b> },
                { key: 'name', label: 'Vaccine / task' },
                { key: 'method', label: 'Method', hideOnMobile: true },
                { key: 'ageDay', label: 'Bird age', render: (v) => `Day ${v.ageDay}`, hideOnMobile: true },
                { key: 'st', label: 'Status', sort: (v) => vaccineState(v, t), render: (v) => { const st = vaccineState(v, t); return <Badge tone={ST_TONE[st]}>{st === 'due' ? (v.dueDate === t ? 'Due today' : 'Upcoming') : st}</Badge>; } },
                ...(filter === 'done' ? [{ key: 'by', label: 'By', render: (v) => db.users.find((u) => u.id === v.by)?.name || v.by || '—', hideOnMobile: true }, { key: 'batchNo', label: 'Batch', hideOnMobile: true }] : [{ key: 'act', label: '', nosort: true, render: (v) => v.dueDate <= dayKey(1) && <Button size="sm" onClick={() => setGiving(v)}>Record</Button> }]),
              ]}
            />
          )}
        </>
      )}
      {tab === 'treatments' && (
        <DataTable
          rows={db.treatments.filter((r) => inScope(r.farmId)).sort((a, b) => b.date.localeCompare(a.date))}
          searchText={(r) => `${code(r.flockId)} ${r.drug} ${r.reason}`}
          columns={[
            { key: 'date', label: 'Started', render: (r) => fmtDate(r.date) },
            { key: 'flock', label: 'Flock', render: (r) => <b>{code(r.flockId)}</b> },
            { key: 'drug', label: 'Drug' },
            { key: 'days', label: 'Days' },
            { key: 'reason', label: 'Reason', className: 'whitespace-normal min-w-[180px]' },
            { key: 'wd', label: 'Withdrawal', sort: (r) => r.withdrawalUntil || '', render: (r) => (r.withdrawalUntil ? <Badge tone={r.withdrawalUntil >= t ? 'amber' : 'slate'}>{r.withdrawalUntil >= t ? 'Until ' : 'Ended '}{fmtDate(r.withdrawalUntil)}</Badge> : '—') },
            { key: 'vet', label: 'Vet', hideOnMobile: true },
          ]}
        />
      )}
      <GiveModal v={giving} onClose={() => setGiving(null)} />
      <FormModal
        open={treating}
        onClose={() => setTreating(false)}
        title="Record a treatment"
        subtitle="Drugs given in water/feed or by injection"
        initial={{ date: today(), days: 5, withdrawalDays: 0 }}
        fields={[
          { name: 'flockId', label: 'Flock', type: 'select', required: true, options: db.flocks.filter((f) => f.status === 'active' && inScope(f.farmId)).map((f) => ({ value: f.id, label: `${f.code} · ${f.breed}` })) },
          { name: 'itemId', label: 'Drug from store', type: 'select', options: items.map((i) => ({ value: i.id, label: i.name })), placeholder: 'Not from store' },
          { name: 'drug', label: 'Drug name', required: true, placeholder: 'e.g. Oxytetracycline 20%' },
          { name: 'qty', label: 'Quantity used (sachets / vials)', type: 'number' },
          { name: 'date', label: 'Start date', type: 'date', required: true },
          { name: 'days', label: 'Number of days', type: 'number', required: true },
          { name: 'withdrawalDays', label: 'Withdrawal period (days)', type: 'number', hint: 'From the drug label: days before eggs/meat can be sold' },
          { name: 'vet', label: 'Vet (optional)' },
          { name: 'reason', label: 'Signs / reason', type: 'textarea', required: true },
        ]}
        onSubmit={(v) => {
          const item = db.items.find((i) => i.id === v.itemId);
          addTreatment({ ...v, drug: v.drug || item?.name });
          toast.success('Treatment recorded', +v.withdrawalDays > 0 ? 'Withdrawal warning is now active' : undefined);
          setTreating(false);
        }}
      />
    </div>
  );
}
