import { useMemo, useState } from 'react';
import { PackagePlus, ArrowLeftRight, MinusCircle, Plus, Package, AlertTriangle, Coins, Truck } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useFarmScope, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Tabs, DataTable, Badge, FormModal, StatCard, Segmented, Progress, toast } from '../../components/ui';
import { ITEM_CATEGORIES, itemBalance, itemUsage, lowStock } from '../../lib/stock';
import { addExpense } from '../../lib/wallet';
import { money, num, fmtDate, today, dayKey, sum } from '../../lib/format';

export default function Inventory() {
  const db = useDB();
  const user = useCurrentUser();
  const scope = useFarmScope();
  const inScope = useInScope();
  const farms = useMyFarms();
  const [tab, setTab] = useState('stock');
  const [cat, setCat] = useState('all');
  const [modal, setModal] = useState(null);
  const farmIds = farms.map((f) => f.id);
  const balanceIn = (it) => (scope === 'all' ? sum(farmIds, (fid) => itemBalance(db, it.id, fid)) : itemBalance(db, it.id, scope));

  const rows = useMemo(
    () =>
      db.items
        .filter((it) => (cat === 'all' || it.category === cat) && it.farmIds.some((f) => farmIds.includes(f)))
        .map((it) => {
          const bal = balanceIn(it);
          const u = itemUsage(db, it, scope);
          const reorder = (it.reorder || 0) * (scope === 'all' ? it.farmIds.filter((f) => farmIds.includes(f)).length : 1);
          return { ...it, bal, perDay: u.perDay, daysLeft: u.daysLeft, value: bal * (it.cost || 0), low: bal <= reorder, reorderAt: reorder };
        }),
    [db, cat, scope], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const low = lowStock(db, scope).filter((l) => farmIds.includes(l.farm.id));
  const expiring = db.items.filter((i) => i.expiry && i.expiry <= dayKey(30));
  const moves = [
    ...db.stockMoves.filter((m) => inScope(m.farmId)).map((m) => ({ ...m, src: m.kind })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const item = (id) => db.items.find((i) => i.id === id);
  const farmName = (id) => db.farms.find((f) => f.id === id)?.short;
  const defaultFarm = scope === 'all' ? farms[0]?.id : scope;
  const itemOpts = db.items.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const farmOpts = farms.map((f) => ({ value: f.id, label: f.name }));

  const submit = (v) => {
    const s = useDB.getState();
    const it = item(v.itemId);
    const qty = +v.qty;
    if (!(qty > 0) && modal !== 'item') return toast.error('Enter a quantity');
    try {
      if (modal === 'receive') {
        const cost = +v.totalCost || qty * (it.cost || 0);
        s.add('stockMoves', { itemId: v.itemId, farmId: v.farmId, date: v.date, qty, kind: 'purchase', cost, supplierId: v.supplierId, ref: v.ref || `GRN-${Date.now().toString().slice(-5)}`, by: user.id });
        if (cost > 0 && user.role === 'owner') addExpense({ farmId: v.farmId, date: v.date, category: it.category === 'feed' ? 'feed' : ['drug', 'vaccine'].includes(it.category) ? 'health' : it.category === 'packaging' ? 'packaging' : 'equipment', amount: cost, description: `${it.name} × ${qty} ${it.unit}`, paidFrom: v.paidFrom || 'bank', supplierId: v.supplierId });
        if (+v.totalCost && qty) s.update('items', it.id, { cost: Math.round((+v.totalCost / qty) * 100) / 100 });
        if (!it.farmIds.includes(v.farmId)) s.update('items', it.id, { farmIds: [...it.farmIds, v.farmId] });
        toast.success('Stock received', `${num(qty)} ${it.unit} ${it.name}`);
      } else if (modal === 'use') {
        const bal = itemBalance(s, v.itemId, v.farmId);
        if (qty > bal) return toast.error('Not enough stock', `Only ${num(bal)} ${it.unit} at this farm`);
        s.add('stockMoves', { itemId: v.itemId, farmId: v.farmId, date: v.date, qty: -qty, kind: v.kind || 'use', note: v.note, by: user.id });
        toast.success('Stock updated');
      } else if (modal === 'transfer') {
        if (v.farmId === v.toFarmId) return toast.error('Choose two different farms');
        const bal = itemBalance(s, v.itemId, v.farmId);
        if (qty > bal) return toast.error('Not enough stock', `Only ${num(bal)} ${it.unit} at the sending farm`);
        const ref = `TRF-${Date.now().toString().slice(-5)}`;
        s.add('stockMoves', { itemId: v.itemId, farmId: v.farmId, date: v.date, qty: -qty, kind: 'transfer-out', ref, note: `To ${farmName(v.toFarmId)}`, by: user.id });
        s.add('stockMoves', { itemId: v.itemId, farmId: v.toFarmId, date: v.date, qty, kind: 'transfer-in', ref, note: `From ${farmName(v.farmId)}`, by: user.id });
        if (!it.farmIds.includes(v.toFarmId)) s.update('items', it.id, { farmIds: [...it.farmIds, v.toFarmId] });
        toast.success('Transfer saved', `${num(qty)} ${it.unit} → ${farmName(v.toFarmId)}`);
      } else if (modal === 'item') {
        s.add('items', { name: v.name, category: v.category, unit: v.unit, cost: +v.cost || 0, reorder: +v.reorder || 0, expiry: v.expiry || null, farmIds: farmIds });
        toast.success('Item added');
      } else if (modal === 'supplier') {
        s.add('suppliers', v);
        toast.success('Supplier added');
      }
    } catch (e) {
      return toast.error('Not saved', e.message);
    }
    setModal(null);
    return null;
  };

  const FORMS = {
    receive: { title: 'Receive stock', fields: [
      { name: 'itemId', label: 'Item', type: 'select', options: itemOpts, required: true, span: 2 },
      { name: 'farmId', label: 'Into farm', type: 'select', options: farmOpts, required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'qty', label: 'Quantity (in item units, e.g. kg)', type: 'number', required: true },
      { name: 'totalCost', label: 'Total cost (GH₵)', type: 'number', step: '0.01', hint: 'Leave blank to use the last unit price' },
      { name: 'supplierId', label: 'Supplier', type: 'select', options: db.suppliers.map((s) => ({ value: s.id, label: s.name })) },
      { name: 'paidFrom', label: 'Paid from', type: 'select', options: [{ value: 'bank', label: 'Bank / other' }, { value: 'wallet', label: 'PoultryPro wallet' }, { value: 'cash', label: 'Cash on hand' }], hidden: () => user.role !== 'owner' },
      { name: 'ref', label: 'Invoice / delivery note no.' },
    ], initial: { farmId: defaultFarm, date: today(), paidFrom: 'bank' } },
    use: { title: 'Use or adjust stock', fields: [
      { name: 'itemId', label: 'Item', type: 'select', options: itemOpts, required: true, span: 2 },
      { name: 'farmId', label: 'Farm', type: 'select', options: farmOpts, required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'qty', label: 'Quantity', type: 'number', required: true },
      { name: 'kind', label: 'Reason', type: 'select', options: [{ value: 'use', label: 'Used on farm' }, { value: 'damaged', label: 'Damaged / expired' }, { value: 'adjust', label: 'Stock count correction' }] },
      { name: 'note', label: 'Note', span: 2 },
    ], initial: { farmId: defaultFarm, date: today(), kind: 'use' } },
    transfer: { title: 'Move stock between farms', fields: [
      { name: 'itemId', label: 'Item', type: 'select', options: itemOpts, required: true, span: 2 },
      { name: 'farmId', label: 'From', type: 'select', options: farmOpts, required: true },
      { name: 'toFarmId', label: 'To', type: 'select', options: db.farms.map((f) => ({ value: f.id, label: f.name })), required: true },
      { name: 'qty', label: 'Quantity', type: 'number', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
    ], initial: { farmId: defaultFarm, date: today() } },
    item: { title: 'New inventory item', fields: [
      { name: 'name', label: 'Name', required: true, span: 2 },
      { name: 'category', label: 'Category', type: 'select', options: ITEM_CATEGORIES, required: true },
      { name: 'unit', label: 'Unit', required: true, placeholder: 'kg, bag, vial, piece…' },
      { name: 'cost', label: 'Cost per unit (GH₵)', type: 'number', step: '0.01' },
      { name: 'reorder', label: 'Reorder level (per farm)', type: 'number' },
      { name: 'expiry', label: 'Expiry date', type: 'date' },
    ], initial: { category: 'drug' } },
    supplier: { title: 'New supplier', fields: [
      { name: 'name', label: 'Name', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'supplies', label: 'Supplies' }, { name: 'location', label: 'Location' },
    ], initial: {} },
  };
  const KIND = { purchase: ['Received', 'green'], use: ['Used', 'slate'], 'transfer-in': ['Transfer in', 'sky'], 'transfer-out': ['Transfer out', 'sky'], damaged: ['Damaged', 'red'], adjust: ['Adjusted', 'amber'] };

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Feed, vaccines, drugs, packaging and equipment at each farm"
        actions={
          <>
            <Button variant="secondary" icon={MinusCircle} onClick={() => setModal('use')}>Use / adjust</Button>
            <Button variant="secondary" icon={ArrowLeftRight} onClick={() => setModal('transfer')}>Transfer</Button>
            <Button icon={PackagePlus} onClick={() => setModal('receive')}>Receive stock</Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Stock value" value={money(sum(rows, (r) => Math.max(0, r.value)))} icon={Coins} tone="brand" sub="at last purchase price" />
        <StatCard label="Low stock" value={low.length} icon={AlertTriangle} tone="red" sub="items at or below reorder level" onClick={() => setCat('all')} />
        <StatCard label="Expiring ≤ 30 days" value={expiring.length} icon={Package} tone="gold" sub={expiring.map((e) => e.name.split(' (')[0]).slice(0, 2).join(', ')} />
        <StatCard label="Deliveries (30 days)" value={db.stockMoves.filter((m) => m.kind === 'purchase' && m.date >= dayKey(-30) && inScope(m.farmId)).length} icon={Truck} tone="teal" />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'stock', label: 'Stock levels' }, { value: 'moves', label: 'Movements' }, { value: 'suppliers', label: 'Suppliers', count: db.suppliers.length }]} />
      {tab === 'stock' && (
        <DataTable
          rows={rows}
          pageSize={25}
          searchText={(r) => r.name}
          initialSort={{ key: 'daysLeft', dir: 'asc' }}
          toolbar={
            <>
              <Segmented options={[{ value: 'all', label: 'All' }, ...ITEM_CATEGORIES.slice(0, 5).map((c) => ({ value: c.value, label: c.label.split(' ')[0] }))]} value={cat} onChange={setCat} />
              {user.role !== 'worker' && <Button size="sm" variant="soft" icon={Plus} onClick={() => setModal('item')}>New item</Button>}
            </>
          }
          columns={[
            { key: 'name', label: 'Item', render: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-slate-400">{ITEM_CATEGORIES.find((c) => c.value === r.category)?.label}</p></div> },
            { key: 'bal', label: 'In stock', render: (r) => <span className={r.low ? 'font-bold text-accent-600' : 'font-bold'}>{num(Math.max(0, r.bal), r.unit === 'kg' && r.bal < 100 ? 1 : 0)} {r.unit}{r.unit === 'kg' && r.category === 'feed' ? <span className="block text-xs font-normal text-slate-400">{num(r.bal / (db.settings.feedBagKg || 50), 1)} bags</span> : null}</span> },
            { key: 'daysLeft', label: 'Lasts', sort: (r) => r.daysLeft ?? 9999, render: (r) => (r.daysLeft != null ? <div className="w-28"><p className="text-xs font-semibold">{r.daysLeft} days</p><Progress className="mt-1 h-1.5" value={Math.min(100, (r.daysLeft / 30) * 100)} tone={r.daysLeft <= 3 ? 'red' : r.daysLeft <= 7 ? 'amber' : 'green'} /></div> : <span className="text-xs text-slate-400">—</span>) },
            { key: 'perDay', label: 'Use / day', render: (r) => (r.perDay ? `${num(r.perDay, r.perDay < 10 ? 1 : 0)} ${r.unit}` : '—'), hideOnMobile: true },
            { key: 'reorderAt', label: 'Reorder at', render: (r) => `${num(r.reorderAt)} ${r.unit}`, hideOnMobile: true },
            { key: 'cost', label: 'Unit cost', render: (r) => money(r.cost), hideOnMobile: true },
            { key: 'expiry', label: 'Expiry', render: (r) => (r.expiry ? <Badge tone={r.expiry < today() ? 'red' : r.expiry <= dayKey(30) ? 'amber' : 'slate'}>{fmtDate(r.expiry)}</Badge> : '—'), hideOnMobile: true },
            { key: 'status', label: 'Status', sort: (r) => (r.low ? 0 : 1), render: (r) => <Badge tone={r.low ? 'red' : 'green'} dot>{r.low ? 'Reorder' : 'OK'}</Badge> },
          ]}
        />
      )}
      {tab === 'moves' && (
        <DataTable
          rows={moves}
          pageSize={20}
          searchText={(m) => `${item(m.itemId)?.name} ${m.note || ''} ${m.ref || ''}`}
          columns={[
            { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
            { key: 'item', label: 'Item', render: (m) => item(m.itemId)?.name },
            { key: 'farm', label: 'Farm', render: (m) => farmName(m.farmId) },
            { key: 'kind', label: 'Type', render: (m) => <Badge tone={KIND[m.kind]?.[1]}>{KIND[m.kind]?.[0] || m.kind}</Badge> },
            { key: 'qty', label: 'Qty', render: (m) => <b className={m.qty < 0 ? 'text-accent-600' : 'text-emerald-600'}>{m.qty > 0 ? '+' : ''}{num(m.qty)} {item(m.itemId)?.unit}</b> },
            { key: 'cost', label: 'Cost', render: (m) => (m.cost ? money(m.cost) : '—'), hideOnMobile: true },
            { key: 'ref', label: 'Ref / note', render: (m) => [m.ref, m.note, db.suppliers.find((s) => s.id === m.supplierId)?.name].filter(Boolean).join(' · '), hideOnMobile: true },
          ]}
        />
      )}
      {tab === 'suppliers' && (
        <DataTable
          rows={db.suppliers}
          toolbar={<Button size="sm" variant="soft" icon={Plus} onClick={() => setModal('supplier')}>Add supplier</Button>}
          columns={[
            { key: 'name', label: 'Supplier', render: (s) => <b>{s.name}</b> },
            { key: 'supplies', label: 'Supplies' },
            { key: 'phone', label: 'Phone', render: (s) => <a href={`tel:${s.phone}`} className="text-brand-700 dark:text-gold-400">{s.phone}</a> },
            { key: 'location', label: 'Location', hideOnMobile: true },
            { key: 'spend', label: 'Bought (60 days)', sort: (s) => sum(db.stockMoves.filter((m) => m.supplierId === s.id), (m) => m.cost || 0), render: (s) => money(sum(db.stockMoves.filter((m) => m.supplierId === s.id && m.date >= dayKey(-60)), (m) => m.cost || 0)) },
          ]}
        />
      )}
      {modal && <FormModal open onClose={() => setModal(null)} title={FORMS[modal].title} fields={FORMS[modal].fields} initial={FORMS[modal].initial} onSubmit={submit} />}
    </div>
  );
}
