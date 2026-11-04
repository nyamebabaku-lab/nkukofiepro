import { useState } from 'react';
import { Clock, UserCheck, UserX, Timer } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Card, CardHeader, StatCard, Avatar, Badge, Button, Input, toast, cx } from '../../components/ui';
import { todayAttendance, clock, hoursWorked } from '../../lib/tasks';
import { lastDays, today, fmtDate, num, sum, downloadCSV } from '../../lib/format';

export default function Attendance() {
  const db = useDB();
  const user = useCurrentUser();
  const farms = useMyFarms();
  const inScope = useInScope();
  const [code, setCode] = useState('');
  const days = lastDays(14);
  const t = today();
  const people = user.role === 'worker' ? [user] : db.users.filter((u) => u.role !== 'owner' && u.farmIds.some((f) => inScope(f)));
  const rec = (uid, d) => db.attendance.find((a) => a.userId === uid && a.date === d);
  const present = people.filter((u) => rec(u.id, t));
  const mine = todayAttendance(db, user.id);
  const month = db.attendance.filter((a) => a.date >= lastDays(30)[0] && people.some((p) => p.id === a.userId));
  const avgHours = month.length ? sum(month, hoursWorked) / month.filter((a) => a.out).length : 0;

  const doClock = () => {
    try {
      const r = clock(user.id, code);
      toast.success(r.action === 'in' ? 'Clocked in' : 'Clocked out', `${r.time} · ${r.farm.name}`);
      setCode('');
    } catch (e) {
      toast.error('Could not clock', e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Clock in and out with the farm's 6-digit code" actions={user.role !== 'worker' && <Button variant="secondary" onClick={() => downloadCSV(`attendance-${t}`, month.map((a) => ({ Date: a.date, Name: db.users.find((u) => u.id === a.userId)?.name, Farm: db.farms.find((f) => f.id === a.farmId)?.name, In: a.in, Out: a.out || '', Hours: hoursWorked(a).toFixed(1) })))}>Export 30 days</Button>} />
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {user.role !== 'owner' ? (
          <Card className="p-5">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 text-white"><Clock className="h-5 w-5" /></span><div><p className="font-bold">Your attendance today</p><p className="text-xs text-slate-500">{mine ? `In ${mine.in}${mine.out ? ` · out ${mine.out}` : ''}` : 'Not clocked in'}</p></div></div>
            {!mine?.out && <div className="mt-4 flex gap-2"><Input inputMode="numeric" maxLength={6} placeholder="Farm code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /><Button onClick={doClock} disabled={code.length !== 6}>{mine ? 'Clock out' : 'Clock in'}</Button></div>}
          </Card>
        ) : (
          <Card className="p-5">
            <p className="font-bold">Clock-in codes</p>
            <p className="mb-3 text-xs text-slate-500">Put these on each farm's notice board. Change them on the Farms page.</p>
            {farms.map((f) => <div key={f.id} className="flex justify-between border-b border-cream-200 py-2 text-sm last:border-0 dark:border-white/5"><span>{f.name}</span><b className="tracking-[.3em]">{f.clockCode}</b></div>)}
          </Card>
        )}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="In today" value={`${present.length}/${people.length}`} icon={UserCheck} tone="green" />
          <StatCard label="Absent today" value={people.length - present.length} icon={UserX} tone="red" sub={people.filter((u) => !rec(u.id, t)).map((u) => u.name.split(' ')[0]).join(', ')} />
          <StatCard label="Avg hours / day" value={num(avgHours, 1)} icon={Timer} tone="gold" sub="last 30 days" />
        </div>
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="Last 14 days" subtitle="Clock-in time · red = absent" />
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs">
            <thead><tr><th className="sticky left-0 bg-white pr-3 text-left dark:bg-navy-900">Staff</th>{days.map((d) => <th key={d} className="px-1 pb-2 text-center font-semibold text-slate-400">{fmtDate(d, 'EEEEE')}<br />{d.slice(8)}</th>)}<th className="pl-2">Days</th></tr></thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.id} className="border-t border-cream-100 dark:border-white/5">
                  <td className="sticky left-0 bg-white py-2 pr-3 dark:bg-navy-900"><div className="flex items-center gap-2 whitespace-nowrap"><Avatar name={u.name} size="xs" /><span className="font-semibold">{u.name}</span></div></td>
                  {days.map((d) => {
                    const a = rec(u.id, d);
                    const sunday = new Date(d).getDay() === 0;
                    return <td key={d} className="px-0.5 py-1 text-center"><span className={cx('inline-block w-11 rounded-md py-1 font-semibold', a ? (a.in > '07:30' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300') : sunday ? 'bg-cream-100 text-slate-400 dark:bg-white/5' : d === t ? 'text-slate-300' : 'bg-accent-50 text-accent-600 dark:bg-accent-500/10')}>{a ? a.in : sunday ? 'off' : d === t ? '·' : '✕'}</span></td>;
                  })}
                  <td className="pl-2 text-center font-bold">{days.filter((d) => rec(u.id, d)).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex gap-3 text-[11px] text-slate-500"><Badge tone="green">On time</Badge><Badge tone="amber">After 7:30</Badge><Badge tone="red">Absent</Badge></div>
        </div>
      </Card>
    </div>
  );
}
