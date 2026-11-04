import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bird, LayoutGrid, List } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Tabs, Badge, DataTable, FormModal, Segmented, Card, Progress, EmptyState, toast, cx } from '../../components/ui';
import { flockIndex, ageLabel } from '../../lib/flock';
import { SPECIES, PURPOSES, speciesLabel, purposeLabel, isLayingType } from '../../lib/standards';
import { addFlock, nextFlockCode } from '../../lib/health';
import { num, today, fmtDate } from '../../lib/format';

export function NewFlockModal({ open, onClose, initial }) {
  const db = useDB();
  const farms = useMyFarms();
  const navigate = useNavigate();
  const fields = [
    { name: 'farmId', label: 'Farm', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), required: true },
    { name: 'penId', label: 'House / pen', type: 'select', options: (v) => db.pens.filter((p) => p.farmId === v.farmId && p.type !== 'Hatchery').map((p) => ({ value: p.id, label: `${p.name} (${p.type})` })), required: true },
    { name: 'species', label: 'Bird', type: 'select', options: SPECIES.map((s) => ({ value: s.value, label: `${s.emoji} ${s.label}` })), required: true },
    { name: 'purpose', label: 'Kept for', type: 'select', options: PURPOSES, required: true },
    { name: 'breed', label: 'Breed / strain', required: true, placeholder: 'e.g. Cobb 500, ISA Brown' },
    { name: 'code', label: 'Flock code', required: true, hint: 'Auto-suggested — you can change it' },
    { name: 'opening', label: 'Number of birds', type: 'number', required: true },
    { name: 'placedAt', label: 'Date placed on farm', type: 'date', required: true },
    { name: 'ageAtPlacement', label: 'Age when placed (days)', type: 'number', hint: '0 for day-old chicks, 112 for point-of-lay' },
    { name: 'costPerBird', label: 'Cost per bird (GH₵)', type: 'number', step: '0.01' },
    { name: 'source', label: 'Supplier / source', span: 2 },
  ];
  const init = useMemo(() => {
    const farmId = farms[0]?.id;
    return { farmId, species: 'chicken', purpose: 'broiler', placedAt: today(), ageAtPlacement: 0, code: nextFlockCode(db, 'broiler', 'chicken'), ...initial };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Place a new flock"
      subtitle="A vaccination schedule is created automatically"
      fields={fields}
      initial={init}
      submitLabel="Create flock"
      onSubmit={(v) => {
        const pen = db.pens.find((p) => p.id === v.penId);
        if (!pen || pen.farmId !== v.farmId) return toast.error('Choose a pen on that farm');
        if (db.flocks.some((f) => f.code === v.code)) return toast.error('That flock code is already used');
        const { flock, vaccines } = addFlock(v);
        toast.success(`Flock ${flock.code} created`, `${vaccines} vaccinations scheduled`);
        onClose();
        navigate(`/app/flocks/${flock.id}`);
        return null;
      }}
    />
  );
}

export default function Flocks() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [kind, setKind] = useState('all');
  const [view, setView] = useState('grid');
  const [adding, setAdding] = useState(false);
  const fi = flockIndex(db);
  const list = db.flocks.filter((f) => inScope(f.farmId) && f.status === tab && (kind === 'all' || (kind === 'layers' ? isLayingType(f) && f.species === 'chicken' : kind === 'broilers' ? f.purpose === 'broiler' : f.species !== 'chicken')));
  const count = (st) => db.flocks.filter((f) => inScope(f.farmId) && f.status === st).length;
  const farm = (id) => db.farms.find((f) => f.id === id);

  return (
    <div>
      <PageHeader title="Flocks" subtitle="Every batch of birds on your farms" actions={user.role !== 'worker' && <Button icon={Plus} onClick={() => setAdding(true)}>New flock</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs tabs={[{ value: 'active', label: 'Active', count: count('active') }, { value: 'closed', label: 'Closed', count: count('closed') }]} value={tab} onChange={setTab} />
        <Segmented options={[{ value: 'all', label: 'All' }, { value: 'layers', label: 'Layers' }, { value: 'broilers', label: 'Broilers' }, { value: 'other', label: 'Other birds' }]} value={kind} onChange={setKind} />
        <Segmented className="ml-auto" options={[{ value: 'grid', label: <LayoutGrid className="h-4 w-4" /> }, { value: 'table', label: <List className="h-4 w-4" /> }]} value={view} onChange={setView} />
      </div>
      {!list.length ? (
        <Card><EmptyState icon={Bird} title="No flocks here" text="Place a new flock to start recording." /></Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((f) => {
            const s = fi.get(f.id);
            const laying = isLayingType(f) && s.age >= 126;
            const fm = farm(f.farmId);
            return (
              <Card key={f.id} className="cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift" onClick={() => navigate(`/app/flocks/${f.id}`)}>
                <div className="h-1.5" style={{ background: fm?.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-xl font-semibold text-brand-900 dark:text-white">{f.code}</p>
                      <p className="text-sm text-slate-500">{f.breed}</p>
                    </div>
                    <Badge tone={f.purpose === 'layer' ? 'gold' : f.purpose === 'broiler' ? 'green' : 'terracotta'}>{f.species === 'chicken' ? purposeLabel(f.purpose) : speciesLabel(f.species)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{fm?.name} · {db.pens.find((p) => p.id === f.penId)?.name}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-cream-100 p-3 dark:bg-white/5"><p className="text-xs text-slate-500">Birds</p><p className="text-lg font-extrabold text-slate-900 dark:text-white">{num(s.live)}</p><p className="text-[11px] text-slate-400">of {num(f.opening)} placed</p></div>
                    <div className="rounded-xl bg-cream-100 p-3 dark:bg-white/5"><p className="text-xs text-slate-500">Age</p><p className="text-lg font-extrabold text-slate-900 dark:text-white">{ageLabel(s.age)}</p><p className="text-[11px] text-slate-400">since {fmtDate(f.hatchDate)}</p></div>
                    <div className="rounded-xl bg-cream-100 p-3 dark:bg-white/5"><p className="text-xs text-slate-500">{laying ? 'Laying (7d)' : 'Avg weight'}</p><p className={cx('text-lg font-extrabold', laying && s.layPct7 < s.stdLayPct - 5 ? 'text-accent-600' : 'text-slate-900 dark:text-white')}>{laying ? `${s.layPct7}%` : s.lastWeight ? `${num(s.lastWeight.avgG)} g` : '—'}</p><p className="text-[11px] text-slate-400">{laying ? `target ${Math.round(s.stdLayPct)}%` : `target ${num(s.stdWeightNow)} g`}</p></div>
                    <div className="rounded-xl bg-cream-100 p-3 dark:bg-white/5"><p className="text-xs text-slate-500">Mortality</p><p className="text-lg font-extrabold text-slate-900 dark:text-white">{s.mortalityPct}%</p><p className="text-[11px] text-slate-400">{num(s.dead + s.culled)} birds</p></div>
                  </div>
                  {laying && <Progress className="mt-4 h-1.5" value={(s.layPct7 / Math.max(1, s.stdLayPct)) * 100} tone={s.layPct7 >= s.stdLayPct - 5 ? 'green' : 'amber'} />}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <DataTable
          rows={list}
          onRowClick={(f) => navigate(`/app/flocks/${f.id}`)}
          searchText={(f) => `${f.code} ${f.breed}`}
          columns={[
            { key: 'code', label: 'Flock', render: (f) => <span className="font-bold">{f.code}</span> },
            { key: 'breed', label: 'Breed' },
            { key: 'farm', label: 'Farm', render: (f) => farm(f.farmId)?.short, hideOnMobile: true },
            { key: 'type', label: 'Type', render: (f) => (f.species === 'chicken' ? purposeLabel(f.purpose) : speciesLabel(f.species)) },
            { key: 'live', label: 'Birds', sort: (f) => fi.get(f.id).live, render: (f) => num(fi.get(f.id).live) },
            { key: 'age', label: 'Age', sort: (f) => fi.get(f.id).age, render: (f) => ageLabel(fi.get(f.id).age) },
            { key: 'mort', label: 'Mortality', sort: (f) => fi.get(f.id).mortalityPct, render: (f) => `${fi.get(f.id).mortalityPct}%`, hideOnMobile: true },
            { key: 'perf', label: 'Lay % / weight', render: (f) => { const s = fi.get(f.id); return isLayingType(f) && s.age >= 126 ? `${s.layPct7}%` : s.lastWeight ? `${num(s.lastWeight.avgG)} g` : '—'; } },
          ]}
        />
      )}
      <NewFlockModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
