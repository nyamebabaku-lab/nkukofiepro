import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, PackageCheck, Truck, Phone } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, useInScope } from '../../data/selectors';
import { PageHeader, Card, Badge, Button, Segmented, EmptyState, toast, cx } from '../../components/ui';
import { ORDER_STATUS, orderMoney, setOrderStatus } from '../../lib/orders';
import { money, fmtDate, today, dayKey, num, sum } from '../../lib/format';

export default function Pickups() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const [span, setSpan] = useState(7);
  const t = today();
  const open = db.orders.filter((o) => inScope(o.farmId) && ['booked', 'ready'].includes(o.status));
  const missed = open.filter((o) => o.pickupDate < t);
  const days = Array.from({ length: span }, (_, i) => dayKey(i));
  const canAct = user.role !== 'worker';
  const cap = db.settings.pickupCapacity;

  const Row = ({ o }) => {
    const m = orderMoney(db, o);
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-cream-200 p-3 sm:flex-row sm:items-center dark:border-white/10">
        <Link to={`/app/orders/${o.id}`} className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">{o.customerName} <span className="text-xs font-medium text-slate-400">{o.ref}</span></p>
          <p className="truncate text-xs text-slate-500">{o.lines.map((l) => `${num(l.qty)} × ${String(l.name || 'Item').split(' —')[0]}`).join(', ')}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><span>{db.farms.find((f) => f.id === o.farmId)?.short}</span>{o.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{o.phone}</span>}</p>
        </Link>
        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
          <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
          <p className={cx('text-xs font-semibold', m.balance > 0 ? 'text-accent-600' : 'text-emerald-600')}>{m.balance > 0 ? `${money(m.balance)} to collect` : 'Fully paid'}</p>
        </div>
        {canAct && (
          <div className="flex gap-2">
            {o.status === 'booked' && <Button size="sm" variant="secondary" icon={PackageCheck} onClick={() => { setOrderStatus(o.id, 'ready'); toast.success('Marked ready', 'Customer notified'); }}>Ready</Button>}
            <Link to={`/app/orders/${o.id}`}><Button size="sm" icon={Truck}>Hand over</Button></Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Pick-ups" subtitle={`Orders customers will collect · up to ${cap} online bookings per farm per day`} actions={<Segmented options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} value={span} onChange={setSpan} />} />
      {missed.length > 0 && (
        <Card className="mb-6 border-accent-200 dark:border-accent-500/20">
          <div className="flex items-center gap-2 px-5 pt-4 text-sm font-bold text-accent-700 dark:text-accent-300"><CalendarClock className="h-4 w-4" /> Missed pick-ups ({missed.length})</div>
          <div className="space-y-2 p-4">{missed.map((o) => <Row key={o.id} o={o} />)}</div>
        </Card>
      )}
      <div className="space-y-5">
        {days.map((d) => {
          const list = open.filter((o) => o.pickupDate === d);
          const dow = new Date(d).getDay();
          const closed = !db.settings.openDays.includes(dow) || db.settings.blockedDates.includes(d);
          if (!list.length && span > 7) return null;
          return (
            <div key={d}>
              <div className="mb-2 flex items-center gap-3">
                <p className={cx('font-display text-lg font-semibold', d === t ? 'text-gold-600' : 'text-brand-900 dark:text-white')}>{d === t ? 'Today' : d === dayKey(1) ? 'Tomorrow' : fmtDate(d, 'EEEE')} <span className="text-sm font-normal text-slate-500">{fmtDate(d, 'd MMM')}</span></p>
                {closed ? <Badge tone="slate">Farm closed</Badge> : <Badge tone="slate">{list.length} order{list.length === 1 ? '' : 's'}</Badge>}
                {list.length > 0 && <span className="text-xs text-slate-500">{money(sum(list, (o) => orderMoney(db, o).balance))} to collect</span>}
              </div>
              {list.length ? <div className="space-y-2">{list.map((o) => <Row key={o.id} o={o} />)}</div> : <p className="rounded-2xl border border-dashed border-cream-300 p-4 text-sm text-slate-400 dark:border-white/10">{closed ? 'No pick-ups — closed' : 'No pick-ups booked'}</p>}
            </div>
          );
        })}
        {span > 7 && !open.filter((o) => o.pickupDate >= t).length && <EmptyState title="No upcoming pick-ups" />}
      </div>
    </div>
  );
}
