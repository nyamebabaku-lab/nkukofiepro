import { useState } from 'react';
import { Plus, Wrench, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Tabs, DataTable, Badge, FormModal, StatCard, IconButton, toast } from '../../components/ui';
import { addExpense } from '../../lib/wallet';
import { money, fmtDate, today, dayKey, sum } from '../../lib/format';

const STATUS = { working: ['Working', 'green'], 'needs repair': ['Needs repair', 'amber'], 'out of service': ['Out of service', 'red'] };
const CATS = ['Power', 'Water', 'Hatchery', 'Vehicle', 'Processing', 'Cold storage', 'Ventilation', 'Feeding', 'Building', 'Other'];

export default function Maintenance() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const farms = useMyFarms();
  const [tab, setTab] = useState('assets');
  const [asset, setAsset] = useState(null);
  const [job, setJob] = useState(null);
  const t = today();
  const assets = db.assets.filter((a) => inScope(a.farmId));
  const jobs = db.maintenance.filter((m) => inScope(m.farmId)).sort((a, b) => b.date.localeCompare(a.date));
  const open = jobs.filter((j) => j.status === 'open');
  const assetName = (id) => db.assets.find((a) => a.id === id)?.name || 'General';

  const saveJob = (v) => {
    const s = useDB.getState();
    const a = s.assets.find((x) => x.id === v.assetId);
    const data = { ...v, farmId: a?.farmId || v.farmId, cost: +v.cost || 0, by: v.by || user.id };
    let rec;
    if (v.id) s.update('maintenance', v.id, data);
    else rec = s.add('maintenance', data);
    const wasOpen = v.id && db.maintenance.find((m) => m.id === v.id)?.status === 'open';
    if (data.status === 'done' && data.cost > 0 && (!v.id || wasOpen) && user.role === 'owner') {
      try {
        addExpense({ farmId: data.farmId, date: data.date, category: 'maintenance', amount: data.cost, description: data.description, paidFrom: v.paidFrom || 'cash', maintenanceId: rec?.id || v.id });
      } catch (e) {
        toast.error('Expense not added', e.message);
      }
    }
    if (data.status === 'done' && a) s.update('assets', a.id, { status: 'working', nextService: v.nextService || a.nextService });
    if (data.status === 'open' && a && a.status === 'working') s.update('assets', a.id, { status: 'needs repair' });
    if (!v.id && data.status === 'open') s.notify({ toRoles: ['owner', 'manager'], farmId: data.farmId, title: 'Repair reported', text: `${a?.name || 'Equipment'}: ${data.description}`, link: '/app/maintenance', tone: 'amber' });
    toast.success('Saved');
    setJob(null);
  };

  return (
    <div>
      <PageHeader title="Equipment & maintenance" subtitle="Generators, incubators, vehicles and repairs" actions={<><Button variant="secondary" icon={Plus} onClick={() => setAsset({ farmId: farms[0]?.id, status: 'working', category: 'Power' })}>Add equipment</Button><Button icon={Wrench} onClick={() => setJob({ date: t, status: 'open', farmId: farms[0]?.id })}>Report repair</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Equipment" value={assets.length} icon={Wrench} tone="brand" sub={money(sum(assets, (a) => a.cost)) + ' value'} />
        <StatCard label="Open repairs" value={open.length} icon={AlertTriangle} tone="red" />
        <StatCard label="Service due ≤ 14 days" value={assets.filter((a) => a.nextService && a.nextService <= dayKey(14)).length} icon={CheckCircle2} tone="gold" />
        <StatCard label="Repairs (60 days)" value={money(sum(jobs.filter((j) => j.date >= dayKey(-60)), (j) => j.cost))} icon={Wrench} tone="teal" />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'assets', label: 'Equipment' }, { value: 'jobs', label: 'Repair log', count: open.length }]} />
      {tab === 'assets' ? (
        <DataTable
          rows={assets}
          searchText={(a) => `${a.name} ${a.category}`}
          columns={[
            { key: 'name', label: 'Equipment', render: (a) => <div><p className="font-semibold">{a.name}</p><p className="text-xs text-slate-400">{a.category}{a.serial ? ` · ${a.serial}` : ''}</p></div> },
            { key: 'farm', label: 'Farm', render: (a) => db.farms.find((f) => f.id === a.farmId)?.short },
            { key: 'status', label: 'Status', render: (a) => <Badge tone={STATUS[a.status]?.[1]} dot>{STATUS[a.status]?.[0]}</Badge> },
            { key: 'nextService', label: 'Next service', render: (a) => (a.nextService ? <Badge tone={a.nextService < t ? 'red' : a.nextService <= dayKey(14) ? 'amber' : 'slate'}>{fmtDate(a.nextService)}</Badge> : '—') },
            { key: 'cost', label: 'Cost', render: (a) => money(a.cost), hideOnMobile: true },
            { key: 'purchaseDate', label: 'Bought', render: (a) => fmtDate(a.purchaseDate, 'MMM yyyy'), hideOnMobile: true },
            { key: 'x', label: '', nosort: true, render: (a) => <IconButton icon={Pencil} label="Edit" onClick={() => setAsset(a)} /> },
          ]}
        />
      ) : (
        <DataTable
          rows={jobs}
          onRowClick={(j) => setJob(j)}
          searchText={(j) => `${assetName(j.assetId)} ${j.description}`}
          columns={[
            { key: 'date', label: 'Date', render: (j) => fmtDate(j.date) },
            { key: 'asset', label: 'Equipment', render: (j) => assetName(j.assetId) },
            { key: 'description', label: 'Work', className: 'whitespace-normal min-w-[200px]' },
            { key: 'vendor', label: 'Done by', hideOnMobile: true },
            { key: 'cost', label: 'Cost', render: (j) => (j.cost ? money(j.cost) : '—') },
            { key: 'status', label: 'Status', render: (j) => <Badge tone={j.status === 'open' ? 'amber' : 'green'}>{j.status === 'open' ? 'Open' : 'Done'}</Badge> },
          ]}
        />
      )}
      <FormModal
        open={!!asset}
        onClose={() => setAsset(null)}
        title={asset?.id ? 'Edit equipment' : 'Add equipment'}
        initial={asset}
        fields={[
          { name: 'name', label: 'Name', required: true, span: 2 },
          { name: 'farmId', label: 'Farm', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), required: true },
          { name: 'category', label: 'Type', type: 'select', options: CATS },
          { name: 'status', label: 'Status', type: 'select', options: Object.entries(STATUS).map(([value, [label]]) => ({ value, label })) },
          { name: 'nextService', label: 'Next service', type: 'date' },
          { name: 'purchaseDate', label: 'Bought on', type: 'date' },
          { name: 'cost', label: 'Cost (GH₵)', type: 'number' },
          { name: 'serial', label: 'Serial / reg. no.' },
        ]}
        onSubmit={(v) => { const s = useDB.getState(); if (v.id) s.update('assets', v.id, { ...v, cost: +v.cost || 0 }); else s.add('assets', { ...v, cost: +v.cost || 0 }); toast.success('Saved'); setAsset(null); }}
      />
      <FormModal
        open={!!job}
        onClose={() => setJob(null)}
        title={job?.id ? 'Repair' : 'Report a repair / service'}
        initial={job}
        fields={[
          { name: 'assetId', label: 'Equipment', type: 'select', options: assets.map((a) => ({ value: a.id, label: `${a.name} (${db.farms.find((f) => f.id === a.farmId)?.short})` })), placeholder: 'General / building' },
          { name: 'farmId', label: 'Farm', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), hidden: (v) => !!v.assetId },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'description', label: 'What is wrong / what was done', type: 'textarea', required: true },
          { name: 'vendor', label: 'Technician / company' },
          { name: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open — needs fixing' }, { value: 'done', label: 'Done' }] },
          { name: 'cost', label: 'Cost (GH₵)', type: 'number', hidden: (v) => v.status !== 'done' },
          { name: 'paidFrom', label: 'Paid from', type: 'select', options: [{ value: 'cash', label: 'Cash' }, { value: 'wallet', label: 'Wallet' }, { value: 'bank', label: 'Bank' }], hidden: (v) => v.status !== 'done' || user.role !== 'owner' },
          { name: 'nextService', label: 'Next service date', type: 'date', hidden: (v) => v.status !== 'done' || !v.assetId },
        ]}
        onSubmit={saveJob}
      />
    </div>
  );
}
