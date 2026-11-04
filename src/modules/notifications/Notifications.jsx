import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useDB } from '../../data/store';
import { useCurrentUser, notificationsFor } from '../../data/selectors';
import { PageHeader, Button, Card, EmptyState, cx } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';

const DOT = { red: 'bg-accent-500', amber: 'bg-amber-500', green: 'bg-emerald-500' };

/** Shared list used by staff and the customer portal. */
export function NotificationList({ list, onOpen }) {
  if (!list.length) return <EmptyState icon={Bell} title="No notifications" text="Alerts, bookings and payments will appear here." />;
  return (
    <div className="divide-y divide-cream-200 dark:divide-white/5">
      {list.map((n) => (
        <button key={n.id} type="button" onClick={() => onOpen(n)} className={cx('flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-cream-100 dark:hover:bg-white/5', !n.read && 'bg-gold-50/60 dark:bg-gold-500/5')}>
          <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-cream-300 dark:bg-white/10' : DOT[n.tone] || 'bg-brand-600')} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{n.title}</span>
            <span className="block text-sm text-slate-600 dark:text-slate-300">{n.text}</span>
            <span className="mt-1 block text-xs text-slate-400">{fmtDateTime(n.at)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Notifications() {
  const db = useDB();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const list = notificationsFor(user, null, db.notifications);
  const unread = list.filter((n) => !n.read);
  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread.length} unread`} actions={unread.length > 0 && <Button variant="secondary" icon={CheckCheck} onClick={() => db.markRead(unread.map((n) => n.id))}>Mark all read</Button>} />
      <Card className="overflow-hidden">
        <NotificationList list={list} onOpen={(n) => { db.markRead([n.id]); if (n.link) navigate(n.link); }} />
      </Card>
    </div>
  );
}
