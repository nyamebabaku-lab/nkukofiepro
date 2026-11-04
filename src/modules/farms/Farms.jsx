import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Phone, Pencil, Warehouse, KeyRound, RefreshCw } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, Badge, Progress, FormModal, IconButton, Avatar, toast } from '../../components/ui';
import { flockIndex } from '../../lib/flock';
import { num, sum } from '../../lib/format';

const PEN_TYPES = ['Layer house (deep litter)', 'Layer house (battery cage)', 'Broiler house', 'Brooder', 'Free range run', 'Semi-intensive pen', 'Pond & shelter', 'Hatchery', 'Store room'];
const COLORS = ['#2f6146', '#c8643b', '#d9a441', '#2a7f8a', '#7a5c3c', '#5d6b2f'];

export default function Farms() {
  const db = useDB();
  const user = useCurrentUser();
  const farms = useMyFarms();
  const [farmForm, setFarmForm] = useState(null);
  const [penForm, setPenForm] = useState(null);
  const fi = flockIndex(db);
  const isOwner = user.role === 'owner';
  const managers = db.users.filter((u) => u.role !== 'worker');

  const saveFarm = (v) => {
    const s = useDB.getState();
    const data = { ...v, acres: +v.acres || 0, short: v.short || v.name.split(' ')[0] };
    if (v.id) s.update('farms', v.id, data);
    else {
      const f = s.add('farms', { ...data, clockCode: String(Math.floor(100000 + Math.random() * 900000)), color: COLORS[s.farms.length % COLORS.length] });
      s.update('users', user.id, (u) => ({ farmIds: [...new Set([...u.farmIds, f.id])] }));
    }
    toast.success(v.id ? 'Farm updated' : 'Farm added');
    setFarmForm(null);
  };
  const savePen = (v) => {
    const s = useDB.getState();
    const data = { ...v, capacity: +v.capacity || 0 };
    if (v.id) s.update('pens', v.id, data);
    else s.add('pens', data);
    toast.success(v.id ? 'House updated' : 'House added');
    setPenForm(null);
  };

  return (
    <div>
      <PageHeader title="Farms & pens" subtitle="Your sites, their houses and how full they are" actions={isOwner && <Button icon={Plus} onClick={() => setFarmForm({})}>Add farm</Button>} />
      <div className="space-y-6">
        {farms.map((farm) => {
          const pens = db.pens.filter((p) => p.farmId === farm.id);
          const flocks = db.flocks.filter((f) => f.farmId === farm.id && f.status === 'active');
          const birds = sum(flocks, (f) => fi.get(f.id)?.live || 0);
          const mgr = db.users.find((u) => u.id === farm.managerId);
          const staff = db.users.filter((u) => u.farmIds.includes(farm.id) && u.role === 'worker');
          return (
            <Card key={farm.id} className="overflow-hidden">
              <div className="grain relative p-5 text-white sm:p-6" style={{ background: `linear-gradient(135deg, ${farm.color}, #1f3d2b)` }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">{farm.name}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80"><span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {farm.location}</span>{farm.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {farm.phone}</span>}{farm.acres ? <span>{farm.acres} acres</span> : null}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.role !== 'worker' && (
                      <span className="flex items-center gap-1.5 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-semibold" title="Workers type this to clock in">
                        <KeyRound className="h-3.5 w-3.5" /> Clock-in code <b className="tracking-widest">{farm.clockCode}</b>
                        {isOwner && <button type="button" aria-label="New code" onClick={() => { useDB.getState().update('farms', farm.id, { clockCode: String(Math.floor(100000 + Math.random() * 900000)) }); toast.success('New clock-in code set'); }}><RefreshCw className="h-3.5 w-3.5" /></button>}
                      </span>
                    )}
                    {isOwner && <IconButton icon={Pencil} label="Edit farm" className="text-white hover:bg-white/10" onClick={() => setFarmForm(farm)} />}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[['Birds', num(birds)], ['Active flocks', flocks.length], ['Houses', pens.length], ['Staff', staff.length + (mgr ? 1 : 0)]].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10"><p className="text-xl font-extrabold">{v}</p><p className="text-xs text-white/70">{k}</p></div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-b border-cream-200 px-5 py-3 text-sm dark:border-white/5">
                {mgr && <span className="flex items-center gap-2"><Avatar name={mgr.name} size="xs" /> <span className="text-slate-500">Manager:</span> <b>{mgr.name}</b></span>}
                <span className="flex -space-x-2">{staff.map((s) => <Avatar key={s.id} name={s.name} size="xs" />)}</span>
                {user.role !== 'worker' && <Button size="sm" variant="soft" icon={Plus} className="ml-auto" onClick={() => setPenForm({ farmId: farm.id, type: PEN_TYPES[0] })}>Add house</Button>}
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                {pens.map((p) => {
                  const inPen = flocks.filter((f) => f.penId === p.id);
                  const n = sum(inPen, (f) => fi.get(f.id)?.live || 0);
                  const pct = p.capacity ? (n / p.capacity) * 100 : 0;
                  return (
                    <div key={p.id} className="rounded-2xl border border-cream-200 p-4 dark:border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-brand-600" /><p className="font-bold text-slate-900 dark:text-white">{p.name}</p></div>
                        {user.role !== 'worker' && <IconButton icon={Pencil} label="Edit" className="-m-1.5" onClick={() => setPenForm(p)} />}
                      </div>
                      <p className="text-xs text-slate-500">{p.type}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {inPen.length ? inPen.map((f) => <Link key={f.id} to={`/app/flocks/${f.id}`}><Badge tone="green">{f.code}</Badge></Link>) : <Badge tone="slate">{p.type === 'Hatchery' ? 'Incubators' : 'Empty — ready for birds'}</Badge>}
                      </div>
                      {p.capacity > 0 && (
                        <>
                          <div className="mt-3 flex justify-between text-xs"><span className="text-slate-500">{num(n)} / {num(p.capacity)} birds</span><span className="font-semibold">{Math.round(pct)}%</span></div>
                          <Progress className="mt-1 h-1.5" value={pct} tone={pct > 100 ? 'red' : pct > 85 ? 'amber' : 'green'} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      <FormModal
        open={!!farmForm}
        onClose={() => setFarmForm(null)}
        title={farmForm?.id ? 'Edit farm' : 'Add a farm'}
        initial={farmForm}
        onSubmit={saveFarm}
        fields={[
          { name: 'name', label: 'Farm name', required: true },
          { name: 'short', label: 'Short name', placeholder: 'e.g. Dodowa' },
          { name: 'location', label: 'Location', required: true, span: 2 },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'acres', label: 'Size (acres)', type: 'number' },
          { name: 'managerId', label: 'Manager', type: 'select', options: managers.map((u) => ({ value: u.id, label: u.name })) },
        ]}
      />
      <FormModal
        open={!!penForm}
        onClose={() => setPenForm(null)}
        title={penForm?.id ? 'Edit house / pen' : 'Add a house / pen'}
        initial={penForm}
        onSubmit={savePen}
        fields={[
          { name: 'name', label: 'Name', required: true, placeholder: 'e.g. House C' },
          { name: 'type', label: 'Type', type: 'select', options: PEN_TYPES, required: true },
          { name: 'capacity', label: 'Bird capacity', type: 'number' },
        ]}
      />
    </div>
  );
}
