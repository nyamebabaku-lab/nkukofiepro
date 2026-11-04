import { useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Plus, Egg, Lightbulb, Bird, Timer } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, Badge, Progress, FormModal, Modal, Field, Input, Select, Segmented, StatCard, DataTable, toast } from '../../components/ui';
import { hatchDue, candleDue, recordHatch, INCUBATION_DAYS, nextFlockCode } from '../../lib/health';
import { SPECIES, speciesLabel } from '../../lib/standards';
import { fmtDate, num, today, sum } from '../../lib/format';

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
  const batches = db.hatchBatches.filter((b) => inScope(b.farmId)).sort((a, b) => b.setDate.localeCompare(a.setDate));
  const open = batches.filter((b) => b.status !== 'closed');
  const closed = batches.filter((b) => b.status === 'closed');
  const t = today();
  const hatchRate = sum(closed, (b) => b.hatched) / Math.max(1, sum(closed, (b) => b.eggsSet));
  const fertRate = sum(batches.filter((b) => b.fertile), (b) => b.fertile) / Math.max(1, sum(batches.filter((b) => b.fertile), (b) => b.eggsSet));
  const hof = sum(closed, (b) => b.hatched) / Math.max(1, sum(closed, (b) => b.fertile || b.eggsSet));

  return (
    <div>
      <PageHeader title="Hatchery" subtitle="Incubation batches, candling and hatch results" actions={user.role !== 'worker' && <Button icon={Plus} onClick={() => setAdding(true)}>Set eggs</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="In incubators" value={num(sum(open, (b) => b.eggsSet))} icon={Egg} tone="gold" sub={`${open.length} batches`} />
        <StatCard label="Fertility" value={`${Math.round(fertRate * 100)}%`} icon={Lightbulb} tone="brand" sub="fertile at candling" />
        <StatCard label="Hatch of set" value={`${Math.round(hatchRate * 100)}%`} icon={Bird} tone="green" sub={`${Math.round(hof * 100)}% of fertile eggs`} />
        <StatCard label="Next hatch" value={open.length ? fmtDate(open.map(hatchDue).sort()[0], 'd MMM') : '—'} icon={Timer} tone="teal" sub={open.length ? `${differenceInCalendarDays(parseISO(open.map(hatchDue).sort()[0]), new Date())} days` : ''} />
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {open.map((b) => {
          const total = INCUBATION_DAYS[b.species] || 21;
          const day = differenceInCalendarDays(new Date(), parseISO(b.setDate));
          const due = hatchDue(b);
          const cd = candleDue(b);
          return (
            <Card key={b.id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl font-semibold text-brand-900 dark:text-white">{b.code}</p>
                  <p className="text-xs text-slate-500">{speciesLabel(b.species)} · {b.incubator} · {b.source}</p>
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
          { name: 'farmId', label: 'Farm', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), required: true },
          { name: 'species', label: 'Eggs of', type: 'select', options: SPECIES, required: true },
          { name: 'eggsSet', label: 'Number of eggs', type: 'number', required: true },
          { name: 'setDate', label: 'Date set', type: 'date', required: true },
          { name: 'incubator', label: 'Incubator', type: 'select', options: db.assets.filter((a) => a.category === 'Hatchery').map((a) => a.name.split(' (')[0]), required: true },
          { name: 'costPerEgg', label: 'Cost per egg (GH₵)', type: 'number', step: '0.01' },
          { name: 'source', label: 'Where the eggs came from', span: 2 },
        ]}
        onSubmit={(v) => {
          const n = db.hatchBatches.length + 1;
          db.add('hatchBatches', { ...v, code: `HB-${String(n + 4).padStart(2, '0')}`, eggsSet: +v.eggsSet, costPerEgg: +v.costPerEgg || 0, status: 'incubating', fertile: null, hatched: null, hatchDate: null, candleDate: null, by: user.id });
          if (+v.costPerEgg) db.add('expenses', { farmId: v.farmId, date: v.setDate, category: 'birds', amount: +v.eggsSet * +v.costPerEgg, description: `Hatching eggs × ${v.eggsSet}`, paidFrom: 'bank' });
          toast.success('Batch started', `Hatch due ${fmtDate(hatchDue(v))}`);
          setAdding(false);
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
      {hatching && <HatchModal batch={hatching} onClose={() => setHatching(null)} />}
    </div>
  );
}
