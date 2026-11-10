import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Save, Download, Upload, RotateCcw, Plus, Trash2, Building2, ShoppingBasket, Bell, Wallet, Syringe, Database, MessageSquare, History } from 'lucide-react';
import { useDB } from '../../data/store';
import { PageHeader, Button, Card, CardHeader, Field, Input, Select, Tabs, DataTable, Badge, IconButton, confirmDialog, toast, cx } from '../../components/ui';
import { DAYS } from '../../lib/tasks';
import { LIVE } from '../../config';
import { useCurrentUser } from '../../data/selectors';
import { useBrand, setFarmBrand, logoFromFile, appName } from '../../lib/brand';
import { setBusinessLogo } from '../../lib/accounts';
import { fmtDate, fmtDateTime, today } from '../../lib/format';

function Section({ title, icon, children, onSave }) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} action={onSave && <Button size="sm" icon={Save} onClick={onSave}>Save</Button>} />
      <div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function Templates() {
  const db = useDB();
  const [sel, setSel] = useState(db.vaccineTemplates[0]?.id);
  const t = db.vaccineTemplates.find((x) => x.id === sel);
  const setItems = (items) => useDB.setState((s) => ({ vaccineTemplates: s.vaccineTemplates.map((x) => (x.id === sel ? { ...x, items } : x)) }));
  const [row, setRow] = useState({ day: '', name: '', method: 'Drinking water' });
  return (
    <Card>
      <CardHeader title="Vaccination schedules" subtitle="Used for every new flock. Existing flocks keep their schedule." icon={Syringe} />
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2">{db.vaccineTemplates.map((x) => <button key={x.id} type="button" onClick={() => setSel(x.id)} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold ring-1', sel === x.id ? 'bg-brand-700 text-white ring-brand-700' : 'ring-cream-300 dark:ring-white/10')}>{x.name}</button>)}</div>
        <div className="divide-y divide-cream-200 rounded-2xl border border-cream-200 dark:divide-white/5 dark:border-white/10">
          {t?.items.slice().sort((a, b) => a.day - b.day).map((it, i) => (
            <div key={`${it.day}-${it.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-20 text-xs font-semibold text-slate-500">{it.day < 14 ? `Day ${it.day}` : `Week ${Math.round(it.day / 7)}`}</span>
              <span className="flex-1 font-medium">{it.name}</span>
              <span className="hidden text-xs text-slate-500 sm:block">{it.method}</span>
              <IconButton icon={Trash2} label="Remove" onClick={() => setItems(t.items.filter((x) => x !== it))} />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_1fr_auto]">
          <Input placeholder="Age (days)" inputMode="numeric" value={row.day} onChange={(e) => setRow({ ...row, day: e.target.value })} />
          <Input placeholder="Vaccine / task" value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} />
          <Select value={row.method} onChange={(e) => setRow({ ...row, method: e.target.value })} options={['Drinking water', 'Eye drop', 'Injection', 'Wing web', 'Spray']} />
          <Button icon={Plus} onClick={() => { if (!row.name || row.day === '') return toast.error('Enter age and name'); setItems([...t.items, { day: +row.day, name: row.name, method: row.method, kind: 'vaccine' }]); setRow({ day: '', name: '', method: 'Drinking water' }); return null; }}>Add</Button>
        </div>
      </div>
    </Card>
  );
}

/** The farm business's own logo: shown in the farm app, the customer shop and on receipts. */
function FarmLogoCard() {
  const db = useDB();
  const brand = useBrand();
  const user = useCurrentUser();
  const current = LIVE ? brand.farmLogo : db.settings.farmLogo;
  const [busy, setBusy] = useState(false);
  const file = useRef();
  const apply = async (logo) => {
    setBusy(true);
    try {
      if (LIVE) {
        await setBusinessLogo(logo);
        setFarmBrand(brand.farmName, logo);
      } else db.setSettings({ farmLogo: logo });
      toast.success(logo ? 'Farm logo saved' : 'Farm logo removed', 'Shown in your farm app, customer shop and receipts');
    } catch (e) {
      toast.error('Not saved', e.message);
    }
    setBusy(false);
  };
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      await apply(await logoFromFile(f));
    } catch (err) {
      toast.error('Logo not used', err.message);
    }
  };
  if (LIVE && user?.role !== 'owner') return null;
  return (
    <Card>
      <CardHeader title="Farm logo" subtitle="Your customers see it in their shop and on receipts" icon={ImagePlus} />
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex items-center gap-3 rounded-2xl bg-cream-100 p-3 pr-5 dark:bg-white/5">
          {current ? <img src={current} alt="" className="h-16 w-16 rounded-xl object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-cream-300 text-slate-400 dark:border-white/20"><ImagePlus className="h-6 w-6" /></div>}
          <div><p className="font-semibold">{LIVE ? brand.farmName : db.settings.businessName}</p><p className="text-xs text-slate-500">{current ? 'Your logo' : 'No logo yet — the app logo is used'}</p></div>
        </div>
        <Button icon={busy ? Loader2 : ImagePlus} disabled={busy} onClick={() => file.current.click()}>{current ? 'Change logo' : 'Upload logo'}</Button>
        {current && <Button variant="ghost" icon={Trash2} disabled={busy} onClick={() => apply(null)}>Remove</Button>}
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
      </div>
    </Card>
  );
}

export default function Settings() {
  const db = useDB();
  const [s, setS] = useState(db.settings);
  const [tab, setTab] = useState('general');
  const [blocked, setBlocked] = useState('');
  const [pin, setPin] = useState({ old: '', new: '' });
  const file = useRef();
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const save = () => {
    db.setSettings({ ...s, depositPct: +s.depositPct, pickupCapacity: +s.pickupCapacity, mortalityAlertPct: +s.mortalityAlertPct, tempMin: +s.tempMin, tempMax: +s.tempMax, humidityMax: +s.humidityMax, minWithdrawal: +s.minWithdrawal, ssnitPct: +s.ssnitPct, feedBagKg: +s.feedBagKg, lowLayDrop: +s.lowLayDrop });
    db.log('Settings changed', 'Updated settings');
    toast.success('Settings saved');
  };
  const backup = () => {
    const data = Object.fromEntries(Object.entries(useDB.getState()).filter(([, v]) => typeof v !== 'function'));
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nkukofie-backup-${today()}.json`;
    a.click();
    toast.success('Backup downloaded', 'Keep it somewhere safe');
  };
  const restore = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(async (txt) => {
      try {
        const data = JSON.parse(txt);
        if (!data.farms || !data.flocks) throw new Error(`Not a ${appName()} backup`);
        if (!(await confirmDialog('Restore this backup?', 'Everything currently in the app will be replaced.', { confirmLabel: 'Restore' }))) return;
        db.importData(data);
        setS(useDB.getState().settings);
        toast.success('Backup restored');
      } catch (err) {
        toast.error('Could not restore', err.message);
      }
    });
    e.target.value = '';
  };
  const num = (k, label, hint) => <Field label={label} hint={hint}><Input inputMode="decimal" value={s[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></Field>;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business details, shop rules, alerts, wallet and data" />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: 'general', label: 'General' }, { value: 'health', label: 'Vaccination schedules' }, { value: 'data', label: 'Data & logs' }]} />
      {tab === 'general' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="xl:col-span-2"><FarmLogoCard /></div>
          <Section title="Business" icon={Building2} onSave={save}>
            <Field label="Business name" className="sm:col-span-2"><Input value={s.businessName} onChange={(e) => set('businessName', e.target.value)} /></Field>
            <Field label="Phone"><Input value={s.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Email"><Input value={s.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Shop tagline" className="sm:col-span-2"><Input value={s.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
            <Field label="Currency symbol"><Input value={s.currency} onChange={(e) => set('currency', e.target.value)} /></Field>
            {num('feedBagKg', 'Feed bag size (kg)')}
          </Section>
          <Section title="Customer bookings" icon={ShoppingBasket} onSave={save}>
            {num('depositPct', 'Minimum deposit (%)', 'Customers pay at least this much to book')}
            {num('pickupCapacity', 'Online bookings per farm per day')}
            <Field label="Pick-up hours"><Input value={s.pickupHours} onChange={(e) => set('pickupHours', e.target.value)} /></Field>
            <Field label="Allow 'pay cash at the farm'"><Select value={s.allowCashBooking ? 'yes' : 'no'} onChange={(e) => set('allowCashBooking', e.target.value === 'yes')} options={[{ value: 'yes', label: 'Yes — order held for 24 hours' }, { value: 'no', label: 'No — online deposit required' }]} /></Field>
            <div className="sm:col-span-2">
              <span className="label">Open for pick-up</span>
              <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => { const on = s.openDays.includes(i); return <button key={d} type="button" onClick={() => set('openDays', on ? s.openDays.filter((x) => x !== i) : [...s.openDays, i].sort())} className={cx('h-9 w-12 rounded-xl text-xs font-semibold ring-1', on ? 'bg-brand-700 text-white ring-brand-700' : 'ring-cream-300 dark:ring-white/10')}>{d}</button>; })}</div>
            </div>
            <div className="sm:col-span-2">
              <span className="label">Closed dates (holidays)</span>
              <div className="flex gap-2"><Input type="date" value={blocked} min={today()} onChange={(e) => setBlocked(e.target.value)} /><Button variant="secondary" onClick={() => blocked && set('blockedDates', [...new Set([...s.blockedDates, blocked])].sort())}>Add</Button></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{s.blockedDates.map((d) => <button key={d} type="button" onClick={() => set('blockedDates', s.blockedDates.filter((x) => x !== d))}><Badge tone="slate">{fmtDate(d)} ✕</Badge></button>)}</div>
            </div>
          </Section>
          <Section title="Alerts" icon={Bell} onSave={save}>
            {num('mortalityAlertPct', 'Daily deaths alert (% of flock)', 'Alert when deaths in a day reach this share')}
            {num('lowLayDrop', 'Egg drop alert (%)')}
            {num('tempMin', 'Lowest safe temperature (°C)')}
            {num('tempMax', 'Highest safe temperature (°C)')}
            {num('humidityMax', 'Highest safe humidity (%)')}
          </Section>
          <Section title="Wallet & payroll" icon={Wallet} onSave={save}>
            {num('minWithdrawal', 'Minimum withdrawal (GH₵)')}
            {num('ssnitPct', 'SSNIT employee deduction (%)')}
            <div className="space-y-2 sm:col-span-2">
              <span className="label">Change wallet PIN</span>
              <div className="flex gap-2">
                <Input type="password" inputMode="numeric" placeholder="Current PIN" value={pin.old} onChange={(e) => setPin({ ...pin, old: e.target.value })} />
                <Input type="password" inputMode="numeric" placeholder="New PIN (4–6 digits)" value={pin.new} onChange={(e) => setPin({ ...pin, new: e.target.value })} />
                <Button variant="secondary" onClick={() => { if (pin.old !== db.settings.withdrawalPin) return toast.error('Current PIN is wrong'); if (!/^\d{4,6}$/.test(pin.new)) return toast.error('PIN must be 4–6 digits'); db.setSettings({ withdrawalPin: pin.new }); setS((x) => ({ ...x, withdrawalPin: pin.new })); setPin({ old: '', new: '' }); toast.success('Wallet PIN changed'); return null; }}>Change</Button>
              </div>
            </div>
          </Section>
        </div>
      )}
      {tab === 'health' && <Templates />}
      {tab === 'data' && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Backup & restore" subtitle="This version keeps data on this device. Download a backup regularly." icon={Database} />
            <div className="flex flex-wrap gap-2 p-5">
              <Button icon={Download} onClick={backup}>Download backup</Button>
              {!LIVE && <Button variant="secondary" icon={Upload} onClick={() => file.current.click()}>Restore backup</Button>}
              {!LIVE && <Button variant="soft-red" icon={RotateCcw} onClick={async () => { if (await confirmDialog('Reset to demo data?', 'All your changes on this device will be lost.', { confirmLabel: 'Reset' })) { db.resetDemo(); setS(useDB.getState().settings); toast.success('Demo data restored'); } }}>Reset demo data</Button>}
              <input ref={file} type="file" accept="application/json" className="hidden" onChange={restore} />
            </div>
          </Card>
          <DataTable
            rows={db.smsLog}
            toolbar={<span className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" /> SMS sent (simulated)</span>}
            columns={[{ key: 'at', label: 'Time', render: (m) => fmtDateTime(m.at) }, { key: 'to', label: 'To' }, { key: 'text', label: 'Message', className: 'whitespace-normal min-w-[260px]' }, { key: 'status', label: 'Status', render: (m) => <Badge tone="green">{m.status}</Badge> }]}
          />
          <DataTable
            rows={db.audit}
            toolbar={<span className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" /> Activity log</span>}
            columns={[{ key: 'at', label: 'Time', render: (a) => fmtDateTime(a.at) }, { key: 'who', label: 'Who', render: (a) => db.users.find((u) => u.id === a.userId)?.name || (a.userId ? '—' : 'Customer / system') }, { key: 'action', label: 'Action', render: (a) => <b>{a.action}</b> }, { key: 'detail', label: 'Details', className: 'whitespace-normal' }]}
          />
        </div>
      )}
    </div>
  );
}
