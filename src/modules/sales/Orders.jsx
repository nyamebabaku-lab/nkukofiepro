import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ShoppingBag, Globe, Download } from 'lucide-react';
import { useDB } from '../../data/store';
import { useInScope } from '../../data/selectors';
import { PageHeader, Button, Tabs, DataTable, Badge, Segmented, StatCard } from '../../components/ui';
import { ORDER_STATUS, PAY_STATE, orderMoney } from '../../lib/orders';
import { money, fmtDate, today, sum, dayKey, downloadCSV } from '../../lib/format';

export default function Orders() {
  const db = useDB();
  const inScope = useInScope();
  const navigate = useNavigate();
  const [tab, setTab] = useState('open');
  const [channel, setChannel] = useState('all');
  const all = db.orders.filter((o) => inScope(o.farmId) && (channel === 'all' || o.channel === channel));
  const groups = {
    open: all.filter((o) => ['booked', 'ready'].includes(o.status)),
    picked: all.filter((o) => o.status === 'picked'),
    debt: all.filter((o) => o.status === 'picked' && orderMoney(db, o).balance > 0),
    cancelled: all.filter((o) => o.status === 'cancelled'),
    all,
  };
  const rows = [...groups[tab]].sort((a, b) => (tab === 'open' ? a.pickupDate.localeCompare(b.pickupDate) : b.createdAt.localeCompare(a.createdAt)));
  const week = all.filter((o) => o.status === 'picked' && o.pickedAt >= dayKey(-6));
  const farm = (id) => db.farms.find((f) => f.id === id)?.short;
  const exportCSV = () =>
    downloadCSV(`orders-${today()}`, rows.map((o) => { const m = orderMoney(db, o); return { Ref: o.ref, Date: o.createdAt.slice(0, 10), Customer: o.customerName, Phone: o.phone, Farm: farm(o.farmId), Pickup: o.pickupDate, Items: o.lines.map((l) => `${l.qty} × ${l.name}`).join('; '), Total: o.total, Paid: m.paid, Balance: m.balance, Status: ORDER_STATUS[o.status].label, Channel: o.channel }; }));

  return (
    <div>
      <PageHeader title="Orders" subtitle="Bookings from the customer shop and sales at the farm" actions={<><Button variant="secondary" icon={Download} onClick={exportCSV}>Export</Button><Button icon={Store} onClick={() => navigate('/app/pos')}>New sale / booking</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Waiting for pick-up" value={groups.open.length} icon={ShoppingBag} tone="gold" sub={`${money(sum(groups.open, (o) => orderMoney(db, o).balance))} still to collect`} />
        <StatCard label="Sold (7 days)" value={money(sum(week, (o) => o.total))} icon={Store} tone="brand" sub={`${week.length} orders`} />
        <StatCard label="From online shop" value={all.filter((o) => o.channel === 'portal' && o.createdAt >= dayKey(-30)).length} icon={Globe} tone="teal" sub="bookings in 30 days" />
        <StatCard label="Unpaid after pick-up" value={money(sum(groups.debt, (o) => orderMoney(db, o).balance))} icon={ShoppingBag} tone="red" sub={`${groups.debt.length} orders`} onClick={() => setTab('debt')} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Open', count: groups.open.length }, { value: 'picked', label: 'Picked up' }, { value: 'debt', label: 'Owing', count: groups.debt.length }, { value: 'cancelled', label: 'Cancelled' }, { value: 'all', label: 'All' }]} />
        <Segmented options={[{ value: 'all', label: 'All channels' }, { value: 'portal', label: 'Online' }, { value: 'counter', label: 'At farm' }]} value={channel} onChange={setChannel} />
      </div>
      <DataTable
        rows={rows}
        pageSize={15}
        onRowClick={(o) => navigate(`/app/orders/${o.id}`)}
        searchText={(o) => `${o.ref} ${o.customerName} ${o.phone}`}
        columns={[
          { key: 'ref', label: 'Order', render: (o) => <div><p className="font-bold">{o.ref}</p><p className="text-xs text-slate-400">{fmtDate(o.createdAt)}</p></div> },
          { key: 'customerName', label: 'Customer', render: (o) => <div><p className="font-medium">{o.customerName}</p><p className="max-w-[220px] truncate text-xs text-slate-400">{o.lines.map((l) => `${l.qty} ${l.name.split(' —')[0]}`).join(', ')}</p></div> },
          { key: 'farm', label: 'Farm', render: (o) => farm(o.farmId), hideOnMobile: true },
          { key: 'pickupDate', label: 'Pick-up', render: (o) => <span className={o.pickupDate < today() && ['booked', 'ready'].includes(o.status) ? 'font-semibold text-accent-600' : ''}>{fmtDate(o.pickupDate, 'd MMM')}</span> },
          { key: 'total', label: 'Total', render: (o) => <b>{money(o.total)}</b> },
          { key: 'pay', label: 'Payment', sort: (o) => orderMoney(db, o).balance, render: (o) => { const m = orderMoney(db, o); return o.status === 'cancelled' ? '—' : <div><Badge tone={PAY_STATE[m.state].tone}>{PAY_STATE[m.state].label}</Badge>{m.balance > 0 && <p className="mt-0.5 text-xs text-slate-500">{money(m.balance)} due</p>}</div>; } },
          { key: 'status', label: 'Status', render: (o) => <Badge tone={ORDER_STATUS[o.status].tone} dot>{ORDER_STATUS[o.status].label}</Badge> },
          { key: 'channel', label: '', nosort: true, render: (o) => (o.channel === 'portal' ? <Globe className="h-4 w-4 text-slate-400" aria-label="Online" /> : null), hideOnMobile: true },
        ]}
      />
    </div>
  );
}
