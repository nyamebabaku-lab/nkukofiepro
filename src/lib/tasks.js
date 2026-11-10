// Staff tasks, attendance and payroll.
import { parseISO } from 'date-fns';
import { useDB, useSession } from '../data/store';
import { today, nowISO, sum, round2, money } from './format';
import { payout } from './payments';
import { walletSummary } from './wallet';
import { smsPrefix } from './brand';

export const TASK_CATEGORIES = [
  { value: 'eggs', label: 'Egg collection' },
  { value: 'feeding', label: 'Feeding & water' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'health', label: 'Health' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'hatchery', label: 'Hatchery' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'sales', label: 'Sales & delivery' },
  { value: 'other', label: 'Other' },
];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const runsOn = (t, date) => {
  if (!t.active) return false;
  if (t.repeat === 'once') return t.date === date;
  if (t.repeat === 'weekly') return (t.days || []).includes(parseISO(date).getDay());
  return true;
};

/** Tasks for a day with done / overdue state. Filter by farm and/or user. */
export function tasksFor(db, { date = today(), farmIds, userId } = {}) {
  const now = new Date().toTimeString().slice(0, 5);
  return db.tasks
    .filter((t) => runsOn(t, date) && (!farmIds || farmIds.includes(t.farmId)) && (!userId || t.assigneeId === userId))
    .map((t) => {
      const run = db.taskRuns.find((r) => r.taskId === t.id && r.date === date);
      const overdue = !run && (date < today() || (date === today() && t.time < now));
      return { ...t, run, done: !!run, overdue };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function toggleTask(taskId, date = today(), note = '') {
  const db = useDB.getState();
  const ex = db.taskRuns.find((r) => r.taskId === taskId && r.date === date);
  if (ex) return db.remove('taskRuns', ex.id);
  db.add('taskRuns', { taskId, date, doneBy: useSession.getState().userId, doneAt: nowISO(), note });
  return null;
}

// ---------------- Attendance ----------------
export const todayAttendance = (db, userId) => db.attendance.find((a) => a.userId === userId && a.date === today());

export function clock(userId, code) {
  const db = useDB.getState();
  const u = db.users.find((x) => x.id === userId);
  const farm = db.farms.find((f) => f.clockCode === String(code).trim() && u.farmIds.includes(f.id));
  if (!farm) throw new Error('That farm code is not right. Ask your manager for today’s code.');
  const t = new Date().toTimeString().slice(0, 5);
  const ex = todayAttendance(db, userId);
  if (!ex) {
    db.add('attendance', { userId, farmId: farm.id, date: today(), in: t, out: null, method: 'code' });
    return { action: 'in', time: t, farm };
  }
  if (!ex.out) {
    db.update('attendance', ex.id, { out: t });
    return { action: 'out', time: t, farm };
  }
  throw new Error('You have already clocked out today.');
}

export const hoursWorked = (a) => {
  if (!a.in || !a.out) return 0;
  const [h1, m1] = a.in.split(':').map(Number);
  const [h2, m2] = a.out.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
};

// ---------------- Payroll ----------------
export function draftPayrun(db, month) {
  const pct = db.settings.ssnitPct || 0;
  const lines = db.users
    .filter((u) => u.salary > 0 && u.status !== 'inactive')
    .map((u) => {
      const adv = sum(db.advances.filter((a) => a.userId === u.id && !a.settled), (a) => a.amount);
      const ssnit = round2((u.salary * pct) / 100);
      return { userId: u.id, name: u.name, base: u.salary, allowance: 0, ssnit, advances: adv, net: round2(u.salary - ssnit - adv), method: u.momo?.network || 'mtn', account: u.momo?.number || u.phone, status: 'pending' };
    });
  return { month, lines, total: round2(sum(lines, (l) => l.net)) };
}

/** Pays each staff member to MoMo from the wallet (simulated), books one salary expense and settles advances. */
export async function payPayrun(draft, onProgress) {
  const db = useDB.getState();
  if (db.payruns.some((p) => p.month === draft.month && p.status === 'paid')) throw new Error('This month has already been paid');
  const w = walletSummary(db);
  if (draft.total > w.balance) throw new Error(`Wallet has ${money(w.balance)} — top up or bank cash first`);
  const lines = [];
  for (const l of draft.lines) {
    onProgress?.(l);
    const r = await payout({ method: l.method, account: l.account });
    lines.push({ ...l, status: r.ok ? 'paid' : 'failed', payoutRef: r.ref, error: r.error });
  }
  const paid = round2(sum(lines.filter((l) => l.status === 'paid'), (l) => l.net));
  const pr = useDB.getState().add('payruns', { month: draft.month, lines, total: paid, status: lines.every((l) => l.status === 'paid') ? 'paid' : 'partial', paidAt: nowISO(), by: useSession.getState().userId });
  const exp = useDB.getState().add('expenses', { farmId: null, date: today(), category: 'salaries', amount: paid, description: `Salaries · ${draft.month}`, paidFrom: 'wallet', payrunId: pr.id });
  useDB.getState().add('walletTx', { type: 'payroll', amount: -paid, ref: `PR${Math.floor(Math.random() * 1e6)}`, note: `Salaries · ${draft.month}`, at: nowISO(), status: 'success', expenseId: exp.id });
  const paidIds = lines.filter((l) => l.status === 'paid').map((l) => l.userId);
  useDB.setState((s) => ({ advances: s.advances.map((a) => (paidIds.includes(a.userId) && !a.settled ? { ...a, settled: true, payrunId: pr.id } : a)) }));
  lines.filter((l) => l.status === 'paid').forEach((l) => {
    useDB.getState().notify({ toUserId: l.userId, title: 'Salary paid', text: `${money(l.net)} sent to your MoMo (${draft.month}).`, link: '/app' });
    useDB.getState().sms(l.account, `${smsPrefix()}: Your salary of ${money(l.net)} for ${draft.month} has been sent.`);
  });
  useDB.getState().log('Payroll paid', `${draft.month} · ${money(paid)}`);
  return pr;
}
