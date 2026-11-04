// Pieces shared by the live apps: lazy pages, the permission gate and theme handling.
import { lazy, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useDB, useSession } from '../data/store';
import { useCurrentUser } from '../data/selectors';
import { can } from '../lib/nav';
import { setCurrencySymbol } from '../lib/format';
import { EmptyState, Skeleton } from '../components/ui';

export const pages = {
  Dashboard: lazy(() => import('../modules/dashboard/Dashboard')),
  DailyLog: lazy(() => import('../modules/records/DailyLog')),
  Farms: lazy(() => import('../modules/farms/Farms')),
  Flocks: lazy(() => import('../modules/flocks/Flocks')),
  FlockDetail: lazy(() => import('../modules/flocks/FlockDetail')),
  Health: lazy(() => import('../modules/health/Health')),
  Hatchery: lazy(() => import('../modules/hatchery/Hatchery')),
  Inventory: lazy(() => import('../modules/inventory/Inventory')),
  Orders: lazy(() => import('../modules/sales/Orders')),
  OrderDetail: lazy(() => import('../modules/sales/OrderDetail')),
  POS: lazy(() => import('../modules/sales/POS')),
  Pickups: lazy(() => import('../modules/sales/Pickups')),
  Customers: lazy(() => import('../modules/customers/Customers')),
  CustomerDetail: lazy(() => import('../modules/customers/CustomerDetail')),
  Products: lazy(() => import('../modules/products/Products')),
  Staff: lazy(() => import('../modules/staff/Staff')),
  Tasks: lazy(() => import('../modules/staff/Tasks')),
  Attendance: lazy(() => import('../modules/staff/Attendance')),
  Maintenance: lazy(() => import('../modules/staff/Maintenance')),
  Reports: lazy(() => import('../modules/reports/Reports')),
  Notifications: lazy(() => import('../modules/notifications/Notifications')),
};

/** Staff pages every live app may include: [path, permission key, component]. */
export const STAFF_ROUTES = [
  ['log', 'log', pages.DailyLog], ['farms', 'farms', pages.Farms], ['flocks', 'flocks', pages.Flocks], ['flocks/:id', 'flocks', pages.FlockDetail],
  ['health', 'health', pages.Health], ['hatchery', 'hatchery', pages.Hatchery], ['inventory', 'inventory', pages.Inventory], ['orders', 'orders', pages.Orders],
  ['orders/:id', 'orders', pages.OrderDetail], ['pos', 'pos', pages.POS], ['pickups', 'pickups', pages.Pickups], ['customers', 'customers', pages.Customers],
  ['customers/:id', 'customers', pages.CustomerDetail], ['products', 'products', pages.Products], ['staff', 'staff', pages.Staff], ['tasks', 'tasks', pages.Tasks],
  ['attendance', 'attendance', pages.Attendance], ['maintenance', 'maintenance', pages.Maintenance], ['reports', 'reports', pages.Reports], ['notifications', 'notifications', pages.Notifications],
];

export function Loading() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function Gate({ k, children }) {
  const user = useCurrentUser();
  if (!can(user?.role, k)) return <EmptyState icon={ShieldAlert} title="No access" text="Your role cannot open this page. Ask the farm owner if you need it." />;
  return children;
}

/** Dark mode, theme colour and currency symbol. */
export function useAppTheme() {
  const dark = useSession((s) => s.dark);
  const currency = useDB((s) => s.settings?.currency);
  setCurrencySymbol(currency);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a130e' : '#1f3d2b');
  }, [dark]);
}
