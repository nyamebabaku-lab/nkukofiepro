import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LIVE } from '../../config';
import { UserPlus, Phone, Pencil, KeyRound } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, Badge, Avatar, FormModal, IconButton, Segmented, toast, cx } from '../../components/ui';
import { ROLES } from '../../lib/nav';
import { tasksFor, todayAttendance } from '../../lib/tasks';
import { money, fmtDate } from '../../lib/format';

export default function Staff() {
  const db = useDB();
  const me = useCurrentUser();
  const farms = useMyFarms();
  const [edit, setEdit] = useState(null);
  const [farm, setFarm] = useState('all');
  const ids = farms.map((f) => f.id);
  const staff = db.users.filter((u) => u.farmIds.some((f) => ids.includes(f)) && (farm === 'all' || u.farmIds.includes(farm)));
  const isOwner = me.role === 'owner';

  const fields = [
    { name: 'name', label: 'Full name', required: true },
    { name: 'position', label: 'Job title', required: true, placeholder: 'e.g. Poultry Attendant' },
    { name: 'phone', label: 'Phone (MoMo for salary)', type: 'tel', required: true },
    { name: 'email', label: 'Login email', type: 'email', required: true },
    { name: 'role', label: 'App access', type: 'select', required: true, options: Object.entries(ROLES).filter(([k]) => isOwner || k === 'worker').map(([value, r]) => ({ value, label: r.label })) },
    { name: 'salary', label: 'Monthly salary (GH₵)', type: 'number', hidden: () => !isOwner },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'password', label: 'Password', hint: 'Share it with the staff member' },
    { name: 'farmIds', label: 'Works at', type: 'custom', span: 2, render: (v, set) => (
      <div className="flex flex-wrap gap-2">
        {farms.map((f) => { const on = (v.farmIds || []).includes(f.id); return <button key={f.id} type="button" onClick={() => set(on ? v.farmIds.filter((x) => x !== f.id) : [...(v.farmIds || []), f.id])} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold ring-1', on ? 'bg-brand-700 text-white ring-brand-700' : 'text-slate-600 ring-cream-300 dark:text-slate-300 dark:ring-white/10')}>{f.name}</button>; })}
      </div>
    ) },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive (no login)' }] },
  ];

  return (
    <div>
      <PageHeader title="Staff" subtitle="Your team, what they can access and where they work" actions={<><Segmented options={[{ value: 'all', label: 'All' }, ...farms.map((f) => ({ value: f.id, label: f.short }))]} value={farm} onChange={setFarm} />{LIVE ? (isOwner && <Link to="/app/accounts"><Button icon={UserPlus}>Invite & approve</Button></Link>) : <Button icon={UserPlus} onClick={() => setEdit({ role: 'worker', status: 'active', farmIds: farm === 'all' ? [farms[0]?.id] : [farm], password: 'demo123', salary: 1600 })}>Add staff</Button>}</>} />
      {LIVE && <p className="-mt-3 mb-5 text-sm text-slate-500">New workers and managers create their own account in the PoultryPro app with your farm code{isOwner ? ' — approve them on Accounts & approvals.' : '.'} Here you set their job title, pay and farms.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {staff.map((u) => {
          const att = todayAttendance(db, u.id);
          const tasks = tasksFor(db, { userId: u.id });
          const done = tasks.filter((t) => t.done).length;
          return (
            <Card key={u.id} className={cx('p-5', u.status === 'inactive' && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <Avatar name={u.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                  <p className="text-sm text-slate-500">{u.position}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone={ROLES[u.role].tone}>{ROLES[u.role].label}</Badge>{u.farmIds.map((f) => <Badge key={f} tone="slate">{db.farms.find((x) => x.id === f)?.short}</Badge>)}</div>
                </div>
                {(isOwner || u.role === 'worker') && u.id !== 'usr_owner' && <IconButton icon={Pencil} label="Edit" onClick={() => setEdit(u)} />}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-cream-100 p-2.5 dark:bg-white/5"><p className="text-slate-500">Today</p><p className={cx('font-bold', att ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400')}>{att ? `In ${att.in}${att.out ? ` – ${att.out}` : ''}` : u.role === 'owner' ? '—' : 'Not in'}</p></div>
                <div className="rounded-xl bg-cream-100 p-2.5 dark:bg-white/5"><p className="text-slate-500">Tasks today</p><p className="font-bold">{tasks.length ? `${done} / ${tasks.length}` : '—'}</p></div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <a href={`tel:${u.phone}`} className="flex items-center gap-1 hover:text-brand-700"><Phone className="h-3.5 w-3.5" /> {u.phone}</a>
                {isOwner && u.salary > 0 && <span>{money(u.salary)}/month</span>}
                <span>Since {fmtDate(u.startDate, 'MMM yyyy')}</span>
              </div>
            </Card>
          );
        })}
      </div>
      <FormModal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? `Edit ${edit.name}` : 'Add staff member'}
        subtitle={<span className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> They sign in with their email and password</span>}
        fields={fields}
        initial={edit}
        onSubmit={(v) => {
          if (!v.farmIds?.length) return toast.error('Choose at least one farm');
          const s = useDB.getState();
          if (s.users.some((u) => u.email.toLowerCase() === v.email.toLowerCase() && u.id !== v.id)) return toast.error('That email is already used');
          const data = { ...v, salary: +v.salary || 0, momo: { network: 'mtn', number: v.phone } };
          if (v.id) s.update('users', v.id, data);
          else s.add('users', data);
          toast.success(v.id ? 'Saved' : 'Staff member added', v.id ? undefined : `Login: ${v.email}`);
          setEdit(null);
          return null;
        }}
      />
    </div>
  );
}
