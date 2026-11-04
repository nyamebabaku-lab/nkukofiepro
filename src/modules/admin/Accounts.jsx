// Owner: approve and manage the customers, workers and managers of their farm business.
import { useCallback, useEffect, useState } from 'react';
import { UserCheck, UserX, PauseCircle, PlayCircle, Power, Trash2, KeyRound, RefreshCw, Copy, Share2, Users, Hourglass, Loader2 } from 'lucide-react';
import { useSession } from '../../data/store';
import { PageHeader, Button, Card, CardHeader, Badge, Tabs, DataTable, Avatar, Select, StatCard, Modal, Field, Input, EmptyState, confirmDialog, toast } from '../../components/ui';
import { listProfiles, setAccountStatus, setMemberRole, deleteAccount, regenerateFarmCode, watchAccounts, fetchProfile, STATUS, MEMBER_ROLES, roleLabel } from '../../lib/accounts';
import { fmtDateTime } from '../../lib/format';

/** Action buttons shared with the super admin's account list. */
export function AccountActions({ p, onDone, compact }) {
  const [reason, setReason] = useState(null);
  const run = async (fn, ok) => {
    try {
      await fn();
      toast.success(ok);
      onDone?.();
    } catch (e) {
      toast.error('Not changed', e.message);
    }
  };
  const ask = (status) => setReason({ status, text: '' });
  const size = compact ? 'sm' : 'sm';
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {p.status === 'pending' && (
        <>
          <Button size={size} icon={UserCheck} onClick={() => run(() => setAccountStatus(p.user_id, 'active'), `${p.full_name} approved`)}>Approve</Button>
          <Button size={size} variant="soft-red" icon={UserX} onClick={() => ask('deactivated')}>Reject</Button>
        </>
      )}
      {p.status === 'active' && <Button size={size} variant="secondary" icon={PauseCircle} onClick={() => ask('suspended')}>Suspend</Button>}
      {(p.status === 'suspended' || p.status === 'deactivated') && <Button size={size} variant="secondary" icon={PlayCircle} onClick={() => run(() => setAccountStatus(p.user_id, 'active'), `${p.full_name} activated`)}>Activate</Button>}
      {p.status === 'active' && <Button size={size} variant="ghost" icon={Power} onClick={() => ask('deactivated')}>Deactivate</Button>}
      <Button
        size={size}
        variant="ghost"
        icon={Trash2}
        onClick={async () => {
          if (await confirmDialog(`Delete ${p.full_name}?`, 'Their login is removed for good. Past orders and records stay in your farm history.', { confirmLabel: 'Delete account' })) run(() => deleteAccount(p.user_id), 'Account deleted');
        }}
      >
        Delete
      </Button>
      <Modal
        open={!!reason}
        onClose={() => setReason(null)}
        title={reason?.status === 'suspended' ? `Suspend ${p.full_name}?` : p.status === 'pending' ? `Reject ${p.full_name}?` : `Deactivate ${p.full_name}?`}
        subtitle={reason?.status === 'suspended' ? 'They are signed out and cannot use the app until you activate them again.' : 'They cannot sign in. You can activate them again later.'}
        size="sm"
        footer={<Button variant="danger" onClick={() => { const r = reason; setReason(null); run(() => setAccountStatus(p.user_id, r.status, r.text), 'Account updated'); }}>Confirm</Button>}
      >
        <Field label="Reason (shown to them)"><Input value={reason?.text || ''} onChange={(e) => setReason({ ...reason, text: e.target.value })} placeholder="Optional" /></Field>
      </Modal>
    </div>
  );
}

export default function Accounts() {
  const profile = useSession((s) => s.profile);
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('pending');
  const [code, setCode] = useState(profile?.business?.farm_code);
  const load = useCallback(() => listProfiles(profile.business_id).then(setRows).catch((e) => toast.error('Could not load accounts', e.message)), [profile?.business_id]);
  useEffect(() => {
    load();
    return watchAccounts(() => load());
  }, [load]);
  const others = (rows || []).filter((p) => p.user_id !== profile.user_id && p.role !== 'owner');
  const pending = others.filter((p) => p.status === 'pending');
  const lists = { pending, staff: others.filter((p) => p.role !== 'customer' && p.status !== 'pending'), customers: others.filter((p) => p.role === 'customer' && p.status !== 'pending') };
  const share = () => {
    const text = `Join ${profile.business?.name} on PoultryPro: install the PoultryPro app, tap "Create account" and enter the farm code ${code}.`;
    if (navigator.share) navigator.share({ title: 'PoultryPro farm code', text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => toast.success('Invitation copied'));
  };
  const newCode = async () => {
    if (!(await confirmDialog('Change the farm code?', 'The old code stops working for new sign-ups. People who already joined are not affected.', { danger: false, confirmLabel: 'Change code' }))) return;
    try {
      const c = await regenerateFarmCode();
      setCode(c);
      fetchProfile().then((p) => useSession.getState().setProfile(p));
      toast.success('New farm code', c);
    } catch (e) {
      toast.error('Not changed', e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Accounts & approvals" subtitle="Approve, suspend or remove the customers, workers and managers of your farm" />
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
        <Card className="grain relative overflow-hidden bg-brand-800 p-5 text-white">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-gold-300"><KeyRound className="h-4 w-4" /> Farm code</p>
          <p className="mt-2 font-display text-4xl font-semibold tracking-wider">{code}</p>
          <p className="mt-1 text-sm text-brand-100/80">Customers and staff enter this code when they create an account in the PoultryPro app.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="bg-gold-500 text-brand-950 hover:bg-gold-400" icon={Share2} onClick={share}>Share invite</Button>
            <Button size="sm" variant="secondary" className="bg-white/10 text-white ring-white/20 hover:bg-white/20" icon={Copy} onClick={() => navigator.clipboard?.writeText(code).then(() => toast.success('Code copied'))}>Copy</Button>
            <Button size="sm" variant="ghost" className="text-brand-100 hover:bg-white/10" icon={RefreshCw} onClick={newCode}>New code</Button>
          </div>
        </Card>
        <StatCard label="Waiting for you" value={pending.length} icon={Hourglass} tone="gold" sub="new account requests" onClick={() => setTab('pending')} />
        <StatCard label="Active accounts" value={others.filter((p) => p.status === 'active').length} icon={Users} tone="brand" sub={`${others.filter((p) => p.status === 'suspended').length} suspended`} />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Requests', count: pending.length }, { value: 'staff', label: 'Workers & managers', count: lists.staff.length }, { value: 'customers', label: 'Customers', count: lists.customers.length }]} />
      {!rows ? (
        <Card className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></Card>
      ) : tab === 'pending' && !pending.length ? (
        <Card><EmptyState icon={UserCheck} title="No requests waiting" text="New sign-ups with your farm code appear here instantly." /></Card>
      ) : (
        <DataTable
          rows={lists[tab]}
          searchText={(p) => `${p.full_name} ${p.phone}`}
          columns={[
            { key: 'full_name', label: 'Name', render: (p) => <div className="flex items-center gap-3"><Avatar name={p.full_name} size="sm" /><div><p className="font-semibold">{p.full_name}</p><p className="text-xs text-slate-400">{p.phone}</p></div></div> },
            {
              key: 'role',
              label: 'Role',
              render: (p) => (p.role === 'customer' ? <Badge tone="sky">Customer</Badge> : (
                <Select className="w-40 py-1.5" value={p.role} onChange={async (e) => { try { await setMemberRole(p.user_id, e.target.value); toast.success('Role changed'); load(); } catch (err) { toast.error('Not changed', err.message); } }} options={MEMBER_ROLES} />
              )),
            },
            { key: 'status', label: 'Status', render: (p) => <div><Badge tone={STATUS[p.status].tone} dot>{STATUS[p.status].label}</Badge>{p.note && p.status !== 'active' && <p className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400">{p.note}</p>}</div> },
            { key: 'requested_at', label: 'Joined', render: (p) => fmtDateTime(p.requested_at), hideOnMobile: true },
            { key: 'x', label: '', nosort: true, render: (p) => <AccountActions p={p} onDone={load} /> },
          ]}
        />
      )}
      <p className="mt-4 text-xs text-slate-400">Pay, farms and job titles for workers are edited on the Staff page. {roleLabel('owner')} accounts are managed by the PoultryPro platform team.</p>
    </div>
  );
}
