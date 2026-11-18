import { useState } from 'react';
import { Plus, CheckCircle2, Circle, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, CardHeader, Badge, Progress, Tabs, FormModal, IconButton, Avatar, DataTable, Segmented, confirmDialog, toast, cx } from '../../components/ui';
import { tasksFor, toggleTask, isMine, TASK_CATEGORIES, DAYS } from '../../lib/tasks';
import { today, dayKey, fmtDate } from '../../lib/format';
import { useReminderPrefs, testReminder, askReminderPermission } from '../../lib/reminders';
import { BellRing } from 'lucide-react';

export default function Tasks() {
  const db = useDB();
  const user = useCurrentUser();
  const farms = useMyFarms();
  const inScope = useInScope();
  const [tab, setTab] = useState(user.role === 'worker' ? 'mine' : 'board');
  const [offset, setOffset] = useState(0);
  const [edit, setEdit] = useState(null);
  const [kind, setKind] = useState('all');
  const date = dayKey(offset);
  const farmIds = farms.map((f) => f.id).filter(inScope);
  const all = tasksFor(db, { date, farmIds, userId: tab === 'mine' ? user.id : undefined });
  const done = all.filter((t) => t.done).length;
  const person = (id) => db.users.find((u) => u.id === id);
  const canEdit = user.role !== 'worker';
  const workers = db.users.filter((u) => u.farmIds.some((f) => farmIds.includes(f)) && u.role !== 'owner');

  const TaskRow = ({ t }) => (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-cream-100 dark:hover:bg-white/5">
      <button type="button" onClick={() => (isMine(t, user) || canEdit) && date <= today() && toggleTask(t.id, date)} aria-label="Done">
        {t.done ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Circle className={cx('h-6 w-6', t.overdue ? 'text-accent-500' : 'text-slate-300')} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm', t.done ? 'text-slate-400 line-through' : 'font-semibold text-slate-800 dark:text-slate-100')}>{t.title}</p>
        <p className="text-xs text-slate-500">{t.time} · {TASK_CATEGORIES.find((c) => c.value === t.category)?.label}{t.penId ? ` · ${db.pens.find((p) => p.id === t.penId)?.name}` : ''}{t.run ? ` · done ${new Date(t.run.doneAt).toTimeString().slice(0, 5)}` : ''}</p>
      </div>
      {t.important && !t.done && <Badge tone="amber">Urgent</Badge>}
      {t.overdue && <Badge tone="red">Late</Badge>}
      {tab !== 'mine' && (t.assigneeId ? <Avatar name={person(t.assigneeId)?.name || '?'} size="xs" /> : <Badge tone="slate">Team</Badge>)}
    </div>
  );

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Daily checklists for each farm and person" actions={canEdit && <Button icon={Plus} onClick={() => setEdit({ repeat: 'daily', time: '08:00', category: 'feeding', farmId: farmIds[0], days: [], active: true })}>New task</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[...(canEdit ? [{ value: 'board', label: 'By farm' }] : []), { value: 'mine', label: 'My tasks' }, ...(canEdit ? [{ value: 'manage', label: 'Manage', count: db.tasks.filter((t) => farmIds.includes(t.farmId)).length }] : [])]} />
        {tab !== 'manage' && (
          <div className="ml-auto flex items-center gap-1 rounded-xl bg-white p-1 shadow-soft dark:bg-navy-900">
            <IconButton icon={ChevronLeft} label="Previous day" onClick={() => setOffset((o) => o - 1)} />
            <span className="w-36 text-center text-sm font-semibold">{offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : fmtDate(date, 'EEE d MMM')}</span>
            <IconButton icon={ChevronRight} label="Next day" onClick={() => setOffset((o) => Math.min(1, o + 1))} />
          </div>
        )}
      </div>
      {tab !== 'manage' && (
        <>
          <Card className="mb-5 p-5">
            <div className="flex items-center justify-between text-sm"><span className="font-semibold">{done} of {all.length} done</span><span className="text-slate-500">{all.filter((t) => t.overdue).length} late</span></div>
            <Progress className="mt-2" value={all.length ? (done / all.length) * 100 : 0} tone="green" />
          </Card>
          {tab === 'mine' && <ReminderCard />}
          {tab === 'mine' ? (
            <Card className="p-3">{all.length ? all.map((t) => <TaskRow key={t.id} t={t} />) : <p className="p-4 text-sm text-slate-500">No tasks for you on this day.</p>}</Card>
          ) : (
            <div className="grid gap-5 xl:grid-cols-3">
              {farms.filter((f) => farmIds.includes(f.id)).map((f) => {
                const list = all.filter((t) => t.farmId === f.id);
                return (
                  <Card key={f.id}>
                    <CardHeader title={f.name} subtitle={`${list.filter((t) => t.done).length} / ${list.length} done`} />
                    <div className="p-3">{list.map((t) => <TaskRow key={t.id} t={t} />)}</div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
      {tab === 'manage' && (
        <DataTable
          toolbar={<Segmented options={[{ value: 'all', label: 'All' }, { value: 'hand', label: 'Added by hand' }, { value: 'auto', label: 'Care programmes' }]} value={kind} onChange={setKind} />}
          rows={db.tasks.filter((t) => farmIds.includes(t.farmId) && (kind === 'all' || (kind === 'auto') === !!t.auto))}
          searchText={(t) => `${t.title} ${person(t.assigneeId)?.name}`}
          columns={[
            { key: 'time', label: 'Time' },
            { key: 'title', label: 'Task', render: (t) => <b>{t.title}</b> },
            { key: 'farm', label: 'Farm', render: (t) => db.farms.find((f) => f.id === t.farmId)?.short },
            { key: 'who', label: 'Assigned to', render: (t) => person(t.assigneeId)?.name || 'Whole farm team' },
            { key: 'flock', label: 'Flock', render: (t) => (t.flockId ? db.flocks.find((f) => f.id === t.flockId)?.code : '—'), hideOnMobile: true },
            { key: 'repeat', label: 'Repeats', render: (t) => `${t.repeat === 'weekly' ? `Weekly · ${t.days.map((d) => DAYS[d]).join(', ')}` : t.repeat === 'once' ? `Once · ${fmtDate(t.date)}` : 'Every day'}${t.fromDay != null ? ` · days ${Math.max(t.fromDay, 0)}–${t.toDay > 2000 ? 'end' : t.toDay}` : ''}` },
            { key: 'active', label: 'Status', render: (t) => <Badge tone={t.active ? 'green' : 'slate'}>{t.active ? 'On' : 'Paused'}</Badge> },
            { key: 'x', label: '', nosort: true, render: (t) => <div className="flex"><IconButton icon={Pencil} label="Edit" onClick={() => setEdit(t)} /><IconButton icon={Trash2} label="Delete" onClick={async () => { if (await confirmDialog('Delete task?', t.title)) { db.remove('tasks', t.id); toast.success('Task deleted'); } }} /></div> },
          ]}
        />
      )}
      <FormModal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit task' : 'New task'}
        initial={edit}
        fields={[
          { name: 'title', label: 'Task', required: true, span: 2, placeholder: 'e.g. Collect eggs — morning' },
          { name: 'farmId', label: 'Farm', type: 'select', options: farms.map((f) => ({ value: f.id, label: f.name })), required: true },
          { name: 'penId', label: 'House (optional)', type: 'select', options: (v) => db.pens.filter((p) => p.farmId === v.farmId).map((p) => ({ value: p.id, label: p.name })), placeholder: 'Whole farm' },
          { name: 'assigneeId', label: 'Assign to', type: 'select', placeholder: 'Whole farm team', options: (v) => workers.filter((u) => u.farmIds.includes(v.farmId)).map((u) => ({ value: u.id, label: u.name })) },
          { name: 'time', label: 'Time', type: 'time', required: true },
          { name: 'category', label: 'Type', type: 'select', options: TASK_CATEGORIES },
          { name: 'repeat', label: 'Repeats', type: 'select', options: [{ value: 'daily', label: 'Every day' }, { value: 'weekly', label: 'Some days each week' }, { value: 'once', label: 'Once' }] },
          { name: 'date', label: 'Date', type: 'date', hidden: (v) => v.repeat !== 'once' },
          { name: 'days', label: 'Days', type: 'custom', span: 2, hidden: (v) => v.repeat !== 'weekly', render: (v, set) => <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => { const on = (v.days || []).includes(i); return <button key={d} type="button" onClick={() => set(on ? v.days.filter((x) => x !== i) : [...(v.days || []), i])} className={cx('h-9 w-12 rounded-xl text-xs font-semibold ring-1', on ? 'bg-brand-700 text-white ring-brand-700' : 'ring-cream-300 dark:ring-white/10')}>{d}</button>; })}</div> },
          { name: 'important', label: 'Urgent — text the manager / owner if it is not done within an hour', type: 'checkbox', span: 2 },
          { name: 'active', label: 'Active', type: 'checkbox' },
        ]}
        onSubmit={(v) => {
          const s = useDB.getState();
          if (v.id) s.update('tasks', v.id, v);
          else s.add('tasks', { ...v, date: v.date || today() });
          if (!v.id && v.assigneeId) s.notify({ toUserId: v.assigneeId, title: 'New task for you', text: `${v.title} · ${v.time}`, link: '/app/tasks' });
          toast.success('Task saved');
          setEdit(null);
        }}
      />
    </div>
  );
}

function ReminderCard() {
  const prefs = useReminderPrefs();
  return (
    <Card className="mb-5 flex flex-wrap items-center gap-3 p-4">
      <BellRing className="h-5 w-5 text-gold-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Phone reminders for my tasks & vaccines</p>
        <p className="text-xs text-slate-500">Rings at each task time{prefs.leadMin ? ` (${prefs.leadMin} min early)` : ''}, even with no internet. Urgent tasks you miss are also texted to your manager.</p>
      </div>
      <select className="input w-auto py-1.5 text-sm" value={prefs.leadMin} onChange={(e) => prefs.set({ leadMin: +e.target.value })} aria-label="When to remind">
        <option value={0}>At task time</option><option value={10}>10 min before</option><option value={30}>30 min before</option>
      </select>
      <Button size="sm" variant={prefs.enabled ? 'secondary' : 'primary'} onClick={async () => { if (!prefs.enabled) await askReminderPermission(); prefs.set({ enabled: !prefs.enabled }); }}>{prefs.enabled ? 'Turn off' : 'Turn on'}</Button>
      {prefs.enabled && <Button size="sm" variant="ghost" onClick={async () => { const ok = await testReminder(); toast[ok ? 'success' : 'info'](ok ? 'Test reminder sent' : 'Allow notifications to get reminders', ok ? 'It arrives in a few seconds' : 'Your phone or browser blocked notifications'); }}>Test</Button>}
    </Card>
  );
}
