// Super admin: approve and manage farm businesses and every account; clear demo & test data.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette, ImagePlus, RotateCcw, Save, MessageSquare, Loader2, KeyRound, Building2, Users, Hourglass, Database, Eye, CheckCircle2, PauseCircle, PlayCircle, Power, Trash2, FlaskConical, LogOut, Moon, Sun, ShieldCheck, LayoutDashboard, AlertTriangle } from 'lucide-react';
import { useSession } from '../../data/store';
import { Button, Card, CardHeader, Badge, Tabs, DataTable, Avatar, StatCard, Modal, Field, Input, EmptyState, Toaster, confirmDialog, toast, cx } from '../../components/ui';
import Logo, { BrandMark } from '../../components/layout/Logo';
import { logoFromFile, setPlatformBrand, splitName, appName, smsPrefix } from '../../lib/brand';
import { DEFAULT_APP_NAME } from '../../config';
import { AccountActions } from '../admin/Accounts';
import { listBusinesses, listProfiles, listAudit, setBusinessStatus, setBusinessTest, deleteBusiness, clearTestData, setPlatform, platformSettings, setPlatformBranding, watchAccounts, enterApp, resetPassword, STATUS, roleLabel } from '../../lib/accounts';
import { TempPasswordModal, ChangePasswordModal } from '../live/Passwords';
import { sendSms, smsBalance, smsHistory } from '../../lib/sms';
import { leave, useLive } from '../live/useLive';
import { fmtDateTime } from '../../lib/format';

function BusinessActions({ b, onDone, onOpen, ownerPhone }) {
  const run = async (fn, ok) => {
    try {
      await fn();
      toast.success(ok);
      onDone();
    } catch (e) {
      toast.error('Not changed', e.message);
    }
  };
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {b.status === 'pending' && <Button size="sm" icon={CheckCircle2} onClick={() => run(async () => { await setBusinessStatus(b.id, 'active'); if (ownerPhone) sendSms(ownerPhone, `${smsPrefix()}: ${b.name} has been approved. Sign in to ${appName()} Farm to set up your farm and share your farm code ${b.farm_code} with your team and customers.`); }, `${b.name} approved`)}>Approve</Button>}
      {b.status === 'active' && <Button size="sm" variant="secondary" icon={Eye} onClick={() => onOpen(b)}>Open</Button>}
      {b.status === 'active' && <Button size="sm" variant="secondary" icon={PauseCircle} onClick={() => run(() => setBusinessStatus(b.id, 'suspended'), 'Business suspended')}>Suspend</Button>}
      {(b.status === 'suspended' || b.status === 'deactivated') && <Button size="sm" variant="secondary" icon={PlayCircle} onClick={() => run(() => setBusinessStatus(b.id, 'active'), 'Business activated')}>Activate</Button>}
      {b.status !== 'deactivated' && b.status !== 'pending' && <Button size="sm" variant="ghost" icon={Power} onClick={() => run(() => setBusinessStatus(b.id, 'deactivated'), 'Business deactivated')}>Deactivate</Button>}
      {b.status === 'pending' && <Button size="sm" variant="soft-red" onClick={() => run(() => setBusinessStatus(b.id, 'deactivated', 'Not approved'), 'Business rejected')}>Reject</Button>}
      <Button
        size="sm"
        variant="ghost"
        icon={Trash2}
        onClick={async () => {
          if (await confirmDialog(`Delete ${b.name}?`, 'The business, all its farm records and every account in it are removed for good.', { confirmLabel: 'Delete business' })) run(() => deleteBusiness(b.id), 'Business deleted');
        }}
      >
        Delete
      </Button>
    </div>
  );
}

/** Owners are managed with their business, but the super admin can still reset their password. */
function OwnerReset({ p, onDone }) {
  const [temp, setTemp] = useState(null);
  const go = async () => {
    if (!(await confirmDialog(`Reset ${p.full_name}'s password?`, 'They are signed out everywhere and get a temporary password.', { danger: false, confirmLabel: 'Reset password' }))) return;
    try {
      setTemp({ code: await resetPassword(p.user_id), name: p.full_name, phone: p.phone });
      onDone();
    } catch (e) {
      toast.error('Not reset', e.message);
    }
  };
  return (
    <div className="flex justify-end">
      <Button size="sm" variant={p.reset_requested_at ? 'primary' : 'ghost'} icon={KeyRound} onClick={go}>Reset password</Button>
      <TempPasswordModal result={temp} onClose={() => setTemp(null)} />
    </div>
  );
}

/** mNotify credit, a test message and the latest SMS sent on the platform. */
function SmsCard() {
  const [bal, setBal] = useState(null);
  const [log, setLog] = useState([]);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    smsBalance().then(setBal).catch((e) => setBal({ ok: false, error: e.message }));
    smsHistory().then(setLog).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);
  const test = async () => {
    setBusy(true);
    const r = await sendSms(to, `${smsPrefix()}: test message — SMS through mNotify is working.`);
    setBusy(false);
    if (r.ok) toast.success('Test SMS sent', to);
    else toast.error('SMS not sent', r.error);
    load();
  };
  return (
    <Card className="xl:col-span-2">
      <CardHeader title="SMS (mNotify)" subtitle="Bookings, payments, pick-ups, approvals and password resets are texted automatically" icon={MessageSquare} />
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-4">
          <div className="rounded-2xl bg-cream-100 p-4 dark:bg-white/5">
            <p className="text-xs text-slate-500">mNotify credit</p>
            {bal === null ? <Loader2 className="mt-2 h-5 w-5 animate-spin text-slate-400" /> : bal.ok ? <p className="text-2xl font-extrabold">{bal.balance ?? '—'} <span className="text-sm font-medium text-slate-500">SMS{bal.bonus ? ` + ${bal.bonus} bonus` : ''}</span></p> : <p className="mt-1 text-sm font-medium text-accent-600">{bal.error || bal.raw?.message || 'Not connected yet'}</p>}
          </div>
          <Field label="Send a test SMS to"><Input inputMode="tel" value={to} onChange={(e) => setTo(e.target.value)} placeholder="024 123 4567" /></Field>
          <Button icon={busy ? Loader2 : MessageSquare} disabled={busy || to.replace(/\D/g, '').length < 9} onClick={test}>Send test SMS</Button>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-2xl border border-cream-200 dark:border-white/10">
          {!log.length && <p className="p-4 text-sm text-slate-500">No SMS sent yet.</p>}
          {log.map((m) => (
            <div key={m.id} className="flex gap-3 border-b border-cream-100 px-4 py-2.5 text-sm last:border-0 dark:border-white/5">
              <span className="w-28 shrink-0 text-xs text-slate-400">{fmtDateTime(m.at)}</span>
              <span className="min-w-0 flex-1"><b>{m.to_phone}</b> · <span className="text-slate-600 dark:text-slate-300">{m.message}</span>{m.error && <span className="block text-xs text-accent-600">{m.error}</span>}</span>
              <Badge tone={m.status === 'sent' ? 'green' : 'red'}>{m.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** App name + logo for the whole platform (login screens, splash, menus, receipts without a farm logo). */
function BrandingTab({ settings, reload }) {
  const [name, setName] = useState(settings.app_name || DEFAULT_APP_NAME);
  const [logo, setLogo] = useState(settings.app_logo || null);
  const [busy, setBusy] = useState(false);
  const file = useRef();
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setLogo(await logoFromFile(f));
    } catch (err) {
      toast.error('Logo not used', err.message);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await setPlatformBranding(name.trim(), logo);
      setPlatformBrand({ name: name.trim(), logo });
      toast.success('Branding saved', 'All apps show the new name and logo the next time they open');
      reload();
    } catch (e) {
      toast.error('Not saved', e.message);
    }
    setBusy(false);
  };
  const [first, last] = splitName(name);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader title="App name & logo" subtitle="Shown on every sign-in screen, menu and receipt" icon={Palette} />
        <div className="space-y-5 p-5">
          <Field label="App name" hint="e.g. Nkukɔ Fie Pro — the last word is shown in gold"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
          <div>
            <span className="label">Logo</span>
            <div className="flex flex-wrap items-center gap-3">
              <BrandMark src={logo} className="h-16 w-16" />
              <Button variant="secondary" icon={ImagePlus} onClick={() => file.current.click()}>{logo ? 'Change logo' : 'Upload logo'}</Button>
              {logo && <Button variant="ghost" icon={RotateCcw} onClick={() => setLogo(null)}>Use the egg mark</Button>}
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
            </div>
            <p className="mt-2 text-xs text-slate-500">A square PNG with a transparent background looks best. It is resized to 256 × 256.</p>
          </div>
          <Button icon={busy ? Loader2 : Save} disabled={busy || name.trim().length < 2} onClick={save}>Save branding</Button>
          <p className="text-xs text-slate-500">Installed Android apps keep the name and icon they were built with until the next APK; everything inside the apps updates straight away.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Preview" />
        <div className="space-y-4 p-5">
          {[['bg-brand-900', true], ['bg-cream-100', false]].map(([bg, dark]) => (
            <div key={bg} className={cx('flex items-center gap-3 rounded-2xl p-5', bg)}>
              <BrandMark src={logo} className="h-12 w-12" />
              <div className="leading-none">
                <p className={cx('font-display text-2xl font-semibold', dark ? 'text-cream-100' : 'text-brand-900')}>{first}{last && <span className="text-gold-500"> {last}</span>}</p>
                <p className={cx('mt-1 text-[10px] font-semibold uppercase tracking-[.2em]', dark ? 'text-brand-200/70' : 'text-slate-500')}>Farm management</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function DataTab({ businesses, profiles, settings, reload }) {
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const testBiz = businesses.filter((b) => b.is_test);
  const testUsers = profiles.filter((p) => p.is_test && p.role !== 'super_admin');
  const clear = async () => {
    try {
      const r = await clearTestData();
      toast.success('Demo & test data cleared', `${r.businesses} businesses and ${r.accounts} accounts removed`);
      setOpen(false);
      setTyped('');
      reload();
    } catch (e) {
      toast.error('Not cleared', e.message);
    }
  };
  const toggle = async (k) => {
    try {
      await setPlatform(k === 'demo' ? { demo: !settings.demo_enabled } : { testing: !settings.test_mode });
      reload();
    } catch (e) {
      toast.error('Not changed', e.message);
    }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Clear all demo & test data" subtitle="Real farm businesses are never touched" icon={Trash2} />
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-cream-100 p-3 dark:bg-white/5"><p className="text-xs text-slate-500">Test businesses</p><p className="text-2xl font-extrabold">{testBiz.length}</p></div>
            <div className="rounded-xl bg-cream-100 p-3 dark:bg-white/5"><p className="text-xs text-slate-500">Test accounts</p><p className="text-2xl font-extrabold">{testUsers.length}</p></div>
          </div>
          {testBiz.length > 0 && <p className="text-xs text-slate-500">Will remove: {testBiz.map((b) => b.name).join(', ')}</p>}
          <Button variant="danger" icon={Trash2} disabled={!testBiz.length && !testUsers.length} onClick={() => setOpen(true)}>Clear demo & test data…</Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Platform switches" icon={ShieldCheck} />
        <div className="space-y-4 p-5">
          {[
            ['demo', 'Public demo site', settings.demo_enabled ? 'On — anyone can try the demo with fake farms' : 'Off — the demo link shows "The demo is closed" and wipes demo data in visitors\' browsers', settings.demo_enabled],
            ['test', 'Test mode', settings.test_mode ? 'On — new businesses and accounts are marked as test data (cleared by the button)' : 'Off — new sign-ups are real. Turn this off when you go live.', settings.test_mode],
          ].map(([k, title, text, on]) => (
            <div key={k} className="flex items-start gap-4 rounded-2xl border border-cream-200 p-4 dark:border-white/10">
              <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-slate-500">{text}</p></div>
              <button type="button" role="switch" aria-checked={on} onClick={() => toggle(k)} className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-brand-600' : 'bg-cream-300 dark:bg-white/20')}>
                <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition', on ? 'left-6' : 'left-1')} />
              </button>
            </div>
          ))}
          <p className="flex items-start gap-2 text-xs text-slate-500"><FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Mark or unmark single businesses as test on the Businesses tab.</p>
        </div>
      </Card>
      <SmsCard />
      <Modal open={open} onClose={() => setOpen(false)} title="Clear all demo & test data?" size="sm" footer={<Button variant="danger" disabled={typed !== 'CLEAR'} onClick={clear}>Clear for good</Button>}>
        <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" /> {testBiz.length} businesses and {testUsers.length} accounts, with all their records, will be deleted. This cannot be undone.</p>
        <Field label="Type CLEAR to confirm" className="mt-4"><Input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} /></Field>
      </Modal>
    </div>
  );
}

export default function Platform() {
  const profile = useSession((s) => s.profile);
  const { dark, toggleDark } = useSession();
  const [tab, setTab] = useState('overview');
  const [pw, setPw] = useState(false);
  const [data, setData] = useState({ businesses: [], profiles: [], audit: [], settings: null, loaded: false });
  const load = useCallback(async () => {
    try {
      const [businesses, profiles, audit, settings] = await Promise.all([listBusinesses(), listProfiles(), listAudit(), platformSettings()]);
      setData({ businesses, profiles, audit, settings, loaded: true });
    } catch (e) {
      toast.error('Could not load', e.message);
    }
  }, []);
  useEffect(() => {
    load();
    return watchAccounts(() => load());
  }, [load]);
  const bizName = useMemo(() => new Map(data.businesses.map((b) => [b.id, b.name])), [data.businesses]);
  const pendingBiz = data.businesses.filter((b) => b.status === 'pending');
  const pendingUsers = data.profiles.filter((p) => p.status === 'pending' && p.role !== 'owner');
  const open = async (b) => {
    useLive.setState({ phase: 'loading' });
    try {
      await enterApp(profile, { viewBusinessId: b.id });
      window.location.hash = '#/app';
    } catch (e) {
      toast.error('Could not open', e.message);
    }
    useLive.setState({ phase: 'in' });
  };

  return (
    <div className="min-h-screen bg-cream-100 dark:bg-navy-950">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-brand-900 text-white">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Logo dark />
          <Badge tone="gold" className="ml-1">Super admin</Badge>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={toggleDark} className="rounded-xl p-2 text-brand-100 hover:bg-white/10" aria-label="Dark mode">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
            <span className="hidden px-2 text-sm sm:block">{profile?.full_name}</span>
            <button type="button" onClick={() => setPw(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-white/10"><KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">Password</span></button>
            <button type="button" onClick={() => leave()} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-white/10"><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <h1 className="font-display text-3xl font-semibold text-brand-900 dark:text-white">Platform</h1>
        <p className="mb-5 text-sm text-slate-500">Every farm business and account on {appName()}</p>
        <Tabs
          className="mb-5"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'overview', label: 'Overview', icon: LayoutDashboard, count: pendingBiz.length + pendingUsers.length || undefined },
            { value: 'businesses', label: 'Businesses', icon: Building2, count: data.businesses.length },
            { value: 'accounts', label: 'Accounts', icon: Users, count: data.profiles.length },
            { value: 'branding', label: 'Branding', icon: Palette },
            { value: 'data', label: 'Data', icon: Database },
          ]}
        />
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <StatCard label="Farm businesses" value={data.businesses.filter((b) => b.status === 'active').length} icon={Building2} tone="brand" sub={`${data.businesses.length} registered`} />
              <StatCard label="Businesses waiting" value={pendingBiz.length} icon={Hourglass} tone="gold" onClick={() => setTab('businesses')} />
              <StatCard label="Accounts" value={data.profiles.filter((p) => p.status === 'active').length} icon={Users} tone="teal" sub={`${pendingUsers.length} waiting for their farm owner`} />
              <StatCard label="Suspended" value={data.profiles.filter((p) => p.status === 'suspended').length + data.businesses.filter((b) => b.status === 'suspended').length} icon={PauseCircle} tone="red" sub="accounts + businesses" />
            </div>
            <Card>
              <CardHeader title="Businesses waiting for approval" icon={Hourglass} />
              <div className="space-y-2 p-4">
                {!pendingBiz.length && <EmptyState icon={CheckCircle2} title="Nothing waiting" text="New farm business registrations appear here instantly." />}
                {pendingBiz.map((b) => {
                  const owner = data.profiles.find((p) => p.user_id === b.owner_id);
                  return (
                    <div key={b.id} className="flex flex-col gap-3 rounded-2xl border border-cream-200 p-4 sm:flex-row sm:items-center dark:border-white/10">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{b.name} {b.is_test && <Badge tone="violet">Test</Badge>}</p>
                        <p className="text-xs text-slate-500">{b.location} · owner {owner?.full_name} ({owner?.phone}) · {fmtDateTime(b.created_at)}</p>
                      </div>
                      <BusinessActions b={b} onDone={load} onOpen={open} ownerPhone={data.profiles.find((p) => p.user_id === b.owner_id)?.phone} />
                    </div>
                  );
                })}
              </div>
            </Card>
            {data.profiles.some((p) => p.reset_requested_at && p.role === 'owner') && (
              <Card>
                <CardHeader title="Owners asking for a password reset" icon={KeyRound} />
                <div className="space-y-2 p-4">
                  {data.profiles.filter((p) => p.reset_requested_at && p.role === 'owner').map((p) => (
                    <div key={p.user_id} className="flex items-center gap-3 rounded-2xl border border-cream-200 p-3 dark:border-white/10">
                      <div className="min-w-0 flex-1"><p className="font-semibold">{p.full_name}</p><p className="text-xs text-slate-500">{bizName.get(p.business_id)} · {p.phone} · {fmtDateTime(p.reset_requested_at)}</p></div>
                      <OwnerReset p={p} onDone={load} />
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <Card>
              <CardHeader title="Recent activity" />
              <div className="max-h-96 divide-y divide-cream-200 overflow-y-auto px-5 pb-3 text-sm dark:divide-white/5">
                {data.audit.slice(0, 40).map((a) => (
                  <div key={a.id} className="flex gap-3 py-2"><span className="w-36 shrink-0 text-xs text-slate-400">{fmtDateTime(a.at)}</span><span><b>{a.action}</b> · {a.detail}{a.business_id ? <span className="text-slate-400"> · {bizName.get(a.business_id)}</span> : ''}</span></div>
                ))}
              </div>
            </Card>
          </div>
        )}
        {tab === 'businesses' && (
          <DataTable
            rows={data.businesses}
            searchText={(b) => `${b.name} ${b.location} ${b.farm_code}`}
            columns={[
              { key: 'name', label: 'Business', render: (b) => <div><p className="font-semibold">{b.name}</p><p className="text-xs text-slate-400">{b.location} · code {b.farm_code}</p></div> },
              { key: 'owner', label: 'Owner', render: (b) => { const o = data.profiles.find((p) => p.user_id === b.owner_id); return o ? <div><p>{o.full_name}</p><p className="text-xs text-slate-400">{o.phone}</p></div> : '—'; } },
              { key: 'people', label: 'Accounts', sort: (b) => data.profiles.filter((p) => p.business_id === b.id).length, render: (b) => data.profiles.filter((p) => p.business_id === b.id).length, hideOnMobile: true },
              { key: 'status', label: 'Status', render: (b) => <Badge tone={STATUS[b.status].tone} dot>{b.status === 'pending' ? 'Waiting' : STATUS[b.status].label}</Badge> },
              { key: 'is_test', label: 'Test', render: (b) => <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={b.is_test} onChange={async (e) => { try { await setBusinessTest(b.id, e.target.checked); load(); } catch (err) { toast.error(err.message); } }} aria-label="Test business" /> },
              { key: 'x', label: '', nosort: true, render: (b) => <BusinessActions b={b} onDone={load} onOpen={open} ownerPhone={data.profiles.find((p) => p.user_id === b.owner_id)?.phone} /> },
            ]}
          />
        )}
        {tab === 'accounts' && (
          <DataTable
            rows={data.profiles.filter((p) => p.user_id !== profile?.user_id)}
            searchText={(p) => `${p.full_name} ${p.phone} ${bizName.get(p.business_id) || ''} ${p.role}`}
            columns={[
              { key: 'full_name', label: 'Name', render: (p) => <div className="flex items-center gap-3"><Avatar name={p.full_name} size="sm" /><div><p className="font-semibold">{p.full_name} {p.is_test && <Badge tone="violet">Test</Badge>}</p><p className="text-xs text-slate-400">{p.phone}</p></div></div> },
              { key: 'role', label: 'Role', render: (p) => roleLabel(p.role) },
              { key: 'business', label: 'Business', sort: (p) => bizName.get(p.business_id) || '', render: (p) => bizName.get(p.business_id) || '—' },
              { key: 'status', label: 'Status', render: (p) => <div className="flex flex-wrap gap-1"><Badge tone={STATUS[p.status].tone} dot>{STATUS[p.status].label}</Badge>{p.reset_requested_at && <Badge tone="gold">Reset requested</Badge>}</div> },
              { key: 'x', label: '', nosort: true, render: (p) => (p.role === 'owner' ? <OwnerReset p={p} onDone={load} /> : <AccountActions p={p} onDone={load} />) },
            ]}
          />
        )}
        {tab === 'branding' && data.settings && <BrandingTab settings={data.settings} reload={load} />}
        {tab === 'data' && data.settings && <DataTab businesses={data.businesses} profiles={data.profiles} settings={data.settings} reload={load} />}
      </main>
      <ChangePasswordModal open={pw} onClose={() => setPw(false)} />
      <Toaster />
    </div>
  );
}
