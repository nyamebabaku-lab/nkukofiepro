import { useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Plus, Egg, Lightbulb, Bird, Timer, Pencil, Thermometer } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, CardHeader, Badge, Progress, FormModal, Modal, Field, Input, Select, Segmented, StatCard, DataTable, IconButton, toast } from '../../components/ui';
import { photo } from '../../data/media';
import { hatchDue, candleDue, recordHatch, INCUBATION_DAYS, nextFlockCode } from '../../lib/health';
import { SPECIES, speciesLabel } from '../../lib/standards';
import { fmtDate, num, today, sum } from '../../lib/format';

const INC_STATUS = { working: ['Working', 'green'], 'needs repair': ['Needs repair', 'amber'], 'out of service': ['Out of service', 'red'] };
/** Incubators are equipment of type "Hatchery"; capacity is a field (older records carry it in the name, e.g. "Incubator 1 (5,280 eggs)"). */
const incName = (a) => a.name.split(' (')[0];
const incCapacity = (a) => +a.capacity || +(a.name.match(/\(([\d,]+) eggs\)/)?.[1] || '').replace(/,/g, '') || 0;
const inIncubator = (batches, a) => sum(batches.filter((b) => b.status !== 'closed' && (b.incubatorId ? b.incubatorId === a.id : b.incubator === incName(a))), (b) => b.eggsSet);

const STATUS = { incubating: { label: 'Incubating', tone: 'sky' }, candled: { label: 'Candled', tone: 'gold' }, closed: { label: 'Hatched', tone: 'green' } };

function HatchModal({ batch, onClose }) {
  const db = useDB();
  const [v, setV] = useState({ hatched: batch?.fertile ? Math.round(batch.fertile * 0.9) : '', destination: 'chick-stock', productId: batch?.species === 'guinea' ? 'prd_keets' : 'prd_doc_b' });
  if (!batch) return null;
  const pens = db.pens.filter((p) => p.type !== 'Hatchery');
  const products = db.products.filter((p) => p.category === 'chicks');
  const save = () => {
    if (!(+v.hatched > 0)) return toast.error('Enter how many hatched');
    if (v.destination === 'flock' && !v.penId) return toast.error('Choose a house for the new flock');
    const pen = db.pens.find((p) => p.id === v.penId);
    recordHatch(batch.id, {
      hatched: v.hatched,
      destination: v.destination,
      productId: v.productId,
      flock: v.destination === 'flock' ? { farmId: pen.farmId, penId: pen.id, species: batch.species, purpose: v.purpose || 'broiler', breed: v.breed || 'Own hatch', code: nextFlockCode(db, v.purpose || 'broiler', batch.species) } : null,
    });
    toast.success('Hatch recorded', `${num(v.hatched)} chicks`);
    onClose();
    return null;
  };
  return (
    <Modal open onClose={onClose} title={`Record hatch · ${batch.code}`} subtitle={`${num(batch.eggsSet)} set · ${batch.fertile ? `${num(batch.fertile)} fertile` : 'not candled'}`} size="md" footer={<Button onClick={save}>Save hatch</Button>}>
      <div className="space-y-4">
        <Field label="Chicks hatched"><Input inputMode="numeric" value={v.hatched} onChange={(e) => setV({ ...v, hatched: e.target.value })} /></Field>
        <div><span className="label">Where do the chicks go?</span><Segmented options={[{ value: 'chick-stock', label: 'Shop stock (for sale)' }, { value: 'flock', label: 'New flock on a farm' }]} value={v.destination} onChange={(d) => setV({ ...v, destination: d })} /></div>
        {v.destination === 'chick-stock' ? (
          <Field label="Add to product"><Select value={v.productId} onChange={(e) => setV({ ...v, productId: e.target.value })} options={products.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="House" className="sm:col-span-2"><Select placeholder="Choose…" value={v.penId || ''} onChange={(e) => setV({ ...v, penId: e.target.value })} options={pens.map((p) => ({ value: p.id, label: `${db.farms.find((f) => f.id === p.farmId)?.short} · ${p.name}` }))} /></Field>
            <Field label="Kept for"><Select value={v.purpose || 'broiler'} onChange={(e) => setV({ ...v, purpose: e.target.value })} options={[{ value: 'broiler', label: 'Broilers' }, { value: 'layer', label: 'Layers' }, { value: 'meat', label: 'Meat birds' }]} /></Field>
            <Field label="Breed"><Input value={v.breed || ''} onChange={(e) => setV({ ...v, breed: e.target.value })} placeholder="e.g. Cobb 500" /></Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Hatchery() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const farms = useMyFarms();
  const [adding, setAdding] = useState(false);
  const [candling, setCandling] = useState(null);
  const [hatching, setHatching] = useState(null);
  const [inc, setInc] = useState(null);
  const canManage = user.role !== 'worker';
  const incubators = db.assets.filter((a) => a.category === 'Hatchery' && inScope(a.farmId));
  const allBatches = db.hatchBatches;
  const startSetting = () => {
    if (!incubators.some((a) => a.status !== 'out of service')) {
      toast.info('Add an incubator first', 'Then you can set eggs in it.');
      return setInc({ farmId: farms[0]?.id, status: 'working', category: 'Hatchery' });
    }
    return setAdding(true);
  };
  const batches = db.hatchBatches.filter((b) => inScope(b.farmId)).sort((a, b) => b.setDate.localeCompare(a.setDate));
  const open = batches.filter((b) => b.status !== 'closed');
  const closed = batches.filter((b) => b.status === 'closed');
  const t = today();
  const hatchRate = sum(closed, (b) => b.hatched) / Math.max(1, sum(closed, (b) => b.eggsSet));
  const fertRate = sum(batches.filter((b) => b.fertile), (b) => b.fertile) / Math.max(1, sum(batches.filter((b) => b.fertile), (b) => b.eggsSet));
  const hof = sum(closed, (b) => b.hatched) / Math.max(1, sum(closed, (b) => b.fertile || b.eggsSet));

  return (
    <div>
      <PageHeader title="Hatchery" subtitle="Incubation batches, candling and hatch results" actions={canManage && <><Button variant="secondary" icon={Plus} onClick={() => setInc({ farmId: farms[0]?.id, status: 'working', category: 'Hatchery' })}>Add incubator</Button><Button icon={Egg} onClick={startSetting}>Set eggs</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="In incubators" value={num(sum(open, (b) => b.eggsSet))} icon={Egg} tone="gold" sub={`${open.length} batches`} />
        <StatCard label="Fertility" value={`${Math.round(fertRate * 100)}%`} icon={Lightbulb} tone="brand" sub="fertile at candling" />
        <StatCard label="Hatch of set" value={`${Math.round(hatchRate * 100)}%`} icon={Bird} tone="green" sub={`${Math.round(hof * 100)}% of fertile eggs`} />
        <StatCard label="Next hatch" value={open.length ? fmtDate(open.map(hatchDue).sort()[0], 'd MMM') : '—'} icon={Timer} tone="teal" sub={open.length ? `${differenceInCalendarDays(parseISO(open.map(hatchDue).sort()[0]), new Date())} days` : ''} />
      </div>
      <Card className="mb-6">
        <CardHeader title="Incubators" subtitle="Capacity and how many eggs are in each now" icon={Thermometer} action={canManage && <Button size="sm" variant="ghost" icon={Plus} onClick={() => setInc({ farmId: farms[0]?.id, status: 'working', category: 'Hatchery' })}>Add</Button>} />
        {!incubators.length ? (
          <div className="px-5 pb-5 text-sm text-slate-500">No incubators yet. {canManage ? <button type="button" className="font-semibold text-brand-700 underline dark:text-brand-300" onClick={() => setInc({ farmId: farms[0]?.id, status: 'working', category: 'Hatchery' })}>Add your first incubator</button> : 'Ask the owner or manager to add one.'}</div>
        ) : (
          <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {incubators.map((a) => {
              const cap = incCapacity(a);
              const used = inIncubator(allBatches, a);
              const [label, tone] = INC_STATUS[a.status] || INC_STATUS.working;
              return (
                <div key={a.id} className="rounded-2xl border border-cream-200 p-4 dark:border-white/10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="font-bold text-slate-900 dark:text-white">{incName(a)}</p><p className="truncate text-xs text-slate-500">{db.farms.find((f) => f.id === a.farmId)?.short}{a.model ? ` · ${a.model}` : ''}</p></div>
                    <div className="flex items-center gap-1"><Badge tone={tone}>{label}</Badge>{canManage && <IconButton icon={Pencil} label="Edit incubator" onClick={() => setInc({ ...a, name: incName(a), capacity: cap || '' })} />}</div>
                  </div>
                  <p className="mt-3 text-sm"><b>{num(used)}</b> eggs in{cap ? <> of <b>{num(cap)}</b> · {num(Math.max(0, cap - used))} free</> : ''}</p>
                  {cap > 0 && <Progress className="mt-2" value={Math.min(100, (used / cap) * 100)} tone={used > cap ? 'red' : 'gold'} />}
                  {a.nextService && <p className="mt-2 text-xs text-slate-400">Next service {fmtDate(a.nextService)}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {open.map((b) => {
          const total = INCUBATION_DAYS[b.species] || 21;
          const day = differenceInCalendarDays(new Date(), parseISO(b.setDate));
          const due = hatchDue(b);
          const cd = candleDue(b);
          return (
            <Card key={b.id} className="overflow-hidden p-5">
              <img src={photo(b.species === 'guinea' ? 'keets' : 'incubator')} alt="" loading="lazy" className="-mx-5 -mt-5 mb-4 h-28 w-[calc(100%+2.5rem)] max-w-none object-cover" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl font-semibold text-brand-900 dark:text-white">{b.code}</p>
                  <p className="text-xs text-slate-500">{[speciesLabel(b.species), b.incubator, b.source].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Badge>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white">Day {Math.min(day, total)}<span className="text-base font-semibold text-slate-400"> / {total}</span></p>
                <p className="text-right text-xs text-slate-500">Hatch due<br /><b className="text-sm text-slate-800 dark:text-white">{fmtDate(due, 'EEE d MMM')}</b></p>
              </div>
              <Progress className="mt-3" value={(day / total) * 100} tone="gold" />
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-cream-100 p-2.5 dark:bg-white/5"><p className="text-xs text-slate-500">Eggs set</p><p className="font-bold">{num(b.eggsSet)}</p></div>
                <div className="rounded-xl bg-cream-100 p-2.5 dark:bg-white/5"><p className="text-xs text-slate-500">Fertile</p><p className="font-bold">{b.fertile ? `${num(b.fertile)} (${Math.round((b.fertile / b.eggsSet) * 100)}%)` : `Candle ${fmtDate(cd, 'd MMM')}`}</p></div>
              </div>
              {user.role !== 'worker' || user.position.includes('Hatchery') ? (
                <div className="mt-4 flex gap-2">
                  {b.status === 'incubating' && <Button size="sm" variant="secondary" disabled={t < cd} onClick={() => setCandling(b)}>Record candling</Button>}
                  <Button size="sm" disabled={day < total - 1} onClick={() => setHatching(b)}>Record hatch</Button>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
      <DataTable
        rows={closed}
        columns={[
          { key: 'code', label: 'Batch', render: (b) => <b>{b.code}</b> },
          { key: 'species', label: 'Bird', render: (b) => speciesLabel(b.species) },
          { key: 'setDate', label: 'Set', render: (b) => fmtDate(b.setDate) },
          { key: 'hatchDate', label: 'Hatched', render: (b) => fmtDate(b.hatchDate) },
          { key: 'eggsSet', label: 'Eggs set', render: (b) => num(b.eggsSet) },
          { key: 'hatched', label: 'Chicks', render: (b) => num(b.hatched) },
          { key: 'rate', label: 'Hatch %', sort: (b) => b.hatched / b.eggsSet, render: (b) => <b>{Math.round((b.hatched / b.eggsSet) * 100)}%</b> },
          { key: 'dest', label: 'Went to', render: (b) => (b.destination === 'flock' ? `Flock ${db.flocks.find((f) => f.id === b.flockId)?.code || ''}` : 'Shop stock'), hideOnMobile: true },
        ]}
      />
      <FormModal
        open={adding}
        onClose={() => setAdding(false)}
        title="Set eggs in the incubator"
        initial={{ farmId: farms.find((f) => db.pens.some((p) => p.farmId === f.id && p.type === 'Hatchery'))?.id || farms[0]?.id, species: 'chicken', setDate: today(), costPerEgg: 2.2 }}
        fields={[
          { name: 'species', label: 'Eggs of', type: 'select', options: SPECIES, required: true },
          { name: 'eggsSet', label: 'Number of eggs', type: 'number', required: true },
          { name: 'setDate', label: 'Date set', type: 'date', required: true },
          { name: 'incubatorId', label: 'Incubator', type: 'select', options: incubators.filter((a) => a.status !== 'out of service').map((a) => { const cap = incCapacity(a); return { value: a.id, label: `${incName(a)} · ${db.farms.find((f) => f.id === a.farmId)?.short}${cap ? ` · ${num(Math.max(0, cap - inIncubator(allBatches, a)))} free` : ''}` }; }), required: true },
          { name: 'costPerEgg', label: 'Cost per egg (GH₵)', type: 'number', step: '0.01' },
          { name: 'source', label: 'Where the eggs came from', span: 2 },
        ]}
        onSubmit={(v) => {
          const a = db.assets.find((x) => x.id === v.incubatorId);
          const cap = a ? incCapacity(a) : 0;
          if (a && cap && inIncubator(db.hatchBatches, a) + +v.eggsSet > cap) return toast.error('Not enough space', `${incName(a)} has room for ${num(Math.max(0, cap - inIncubator(db.hatchBatches, a)))} more eggs.`);
          if (a) v = { ...v, incubator: incName(a), farmId: a.farmId };
          const n = db.hatchBatches.length + 1;
          db.add('hatchBatches', { ...v, code: `HB-${String(n + 4).padStart(2, '0')}`, eggsSet: +v.eggsSet, costPerEgg: +v.costPerEgg || 0, status: 'incubating', fertile: null, hatched: null, hatchDate: null, candleDate: null, by: user.id });
          if (+v.costPerEgg) db.add('expenses', { farmId: v.farmId, date: v.setDate, category: 'birds', amount: +v.eggsSet * +v.costPerEgg, description: `Hatching eggs × ${v.eggsSet}`, paidFrom: 'bank' });
          toast.success('Batch started', `Hatch due ${fmtDate(hatchDue(v))}`);
          setAdding(false);
          return null;
        }}
      />
      <FormModal
        open={!!candling}
        onClose={() => setCandling(null)}
        title={`Candling · ${candling?.code}`}
        subtitle="Count the eggs that show a growing embryo"
        initial={{ fertile: candling ? Math.round(candling.eggsSet * 0.88) : '' }}
        fields={[{ name: 'fertile', label: 'Fertile eggs', type: 'number', required: true, span: 2 }]}
        onSubmit={(v) => {
          db.update('hatchBatches', candling.id, { fertile: +v.fertile, candleDate: today(), status: 'candled' });
          toast.success('Candling saved', `${Math.round((+v.fertile / candling.eggsSet) * 100)}% fertile`);
          setCandling(null);
        }}
      />
      <FormModal
        open={!!inc}
        onClose={() => setInc(null)}
        title={inc?.id ? 'Edit incubator' : 'Add incubator'}
        subtitle="Also listed under Equipment for servicing and repairs"
        initial={inc}
        fields={[
          { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Incubator 4' },
          { name: 'capacity', label: 'Holds (eggs)', type: 'number', required: true },
          { name: 'farmId', label: 'Farm', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), required: true },
          { name: 'status', label: 'Status', type: 'select', options: Object.entries(INC_STATUS).map(([value, [label]]) => ({ value, label })) },
          { name: 'model', label: 'Make / model' },
          { name: 'serial', label: 'Serial no.' },
          { name: 'purchaseDate', label: 'Bought on', type: 'date' },
          { name: 'cost', label: 'Cost (GH₵)', type: 'number' },
          { name: 'nextService', label: 'Next service', type: 'date' },
        ]}
        onSubmit={(v) => {
          const s = useDB.getState();
          const data = { ...v, category: 'Hatchery', capacity: +v.capacity || 0, cost: +v.cost || 0 };
          if (v.id) s.update('assets', v.id, data); else s.add('assets', data);
          toast.success(v.id ? 'Incubator updated' : 'Incubator added');
          setInc(null);
        }}
      />
      {hatching && <HatchModal batch={hatching} onClose={() => setHatching(null)} />}
    </div>
  );
}
