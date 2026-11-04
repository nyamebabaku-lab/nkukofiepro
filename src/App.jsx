import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useDB, useSession } from './data/store';
import { useCurrentUser } from './data/selectors';
import { can } from './lib/nav';
import { setCurrencySymbol } from './lib/format';
import { Toaster, EmptyState, Skeleton } from './components/ui';
import AppShell from './components/layout/AppShell';
import PortalLayout from './components/layout/PortalLayout';

const Login = lazy(() => import('./modules/auth/Login'));
const Signup = lazy(() => import('./modules/auth/Signup'));
const PortalHome = lazy(() => import('./modules/portal/Home'));
const Shop = lazy(() => import('./modules/portal/Shop'));
const Cart = lazy(() => import('./modules/portal/Cart'));
const Account = lazy(() => import('./modules/portal/Account'));
const MyOrders = lazy(() => import('./modules/portal/MyOrders'));
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));
const DailyLog = lazy(() => import('./modules/records/DailyLog'));
const Farms = lazy(() => import('./modules/farms/Farms'));
const Flocks = lazy(() => import('./modules/flocks/Flocks'));
const FlockDetail = lazy(() => import('./modules/flocks/FlockDetail'));
const Health = lazy(() => import('./modules/health/Health'));
const Hatchery = lazy(() => import('./modules/hatchery/Hatchery'));
const Inventory = lazy(() => import('./modules/inventory/Inventory'));
const Orders = lazy(() => import('./modules/sales/Orders'));
const OrderDetail = lazy(() => import('./modules/sales/OrderDetail'));
const POS = lazy(() => import('./modules/sales/POS'));
const Pickups = lazy(() => import('./modules/sales/Pickups'));
const Customers = lazy(() => import('./modules/customers/Customers'));
const CustomerDetail = lazy(() => import('./modules/customers/CustomerDetail'));
const Products = lazy(() => import('./modules/products/Products'));
const Finance = lazy(() => import('./modules/finance/Finance'));
const Wallet = lazy(() => import('./modules/finance/Wallet'));
const Payroll = lazy(() => import('./modules/staff/Payroll'));
const Staff = lazy(() => import('./modules/staff/Staff'));
const Tasks = lazy(() => import('./modules/staff/Tasks'));
const Attendance = lazy(() => import('./modules/staff/Attendance'));
const Maintenance = lazy(() => import('./modules/staff/Maintenance'));
const Reports = lazy(() => import('./modules/reports/Reports'));
const Settings = lazy(() => import('./modules/settings/Settings'));
const Notifications = lazy(() => import('./modules/notifications/Notifications'));

function Loading() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

function RequireStaff({ children }) {
  const user = useCurrentUser();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

function Gate({ k, children }) {
  const user = useCurrentUser();
  if (!can(user?.role, k)) return <EmptyState icon={ShieldAlert} title="No access" text="Your role cannot open this page. Ask the farm owner if you need it." />;
  return children;
}

const page = (k, El) => <Gate k={k}><El /></Gate>;

export default function App() {
  const dark = useSession((s) => s.dark);
  const currency = useDB((s) => s.settings.currency);
  setCurrencySymbol(currency);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a130e' : '#1f3d2b');
  }, [dark]);

  return (
    <HashRouter>
      <Suspense fallback={<div className="mx-auto max-w-5xl p-6"><Loading /></div>}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="shop" element={<Shop />} />
            <Route path="cart" element={<Cart />} />
            <Route path="account" element={<Account />} />
            <Route path="account/orders" element={<MyOrders />} />
          </Route>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="app" element={<RequireStaff><AppShell /></RequireStaff>}>
            <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
            {[
              ['log', 'log', DailyLog], ['farms', 'farms', Farms], ['flocks', 'flocks', Flocks], ['flocks/:id', 'flocks', FlockDetail], ['health', 'health', Health],
              ['hatchery', 'hatchery', Hatchery], ['inventory', 'inventory', Inventory], ['orders', 'orders', Orders], ['orders/:id', 'orders', OrderDetail], ['pos', 'pos', POS],
              ['pickups', 'pickups', Pickups], ['customers', 'customers', Customers], ['customers/:id', 'customers', CustomerDetail], ['products', 'products', Products],
              ['finance', 'finance', Finance], ['wallet', 'wallet', Wallet], ['payroll', 'payroll', Payroll], ['staff', 'staff', Staff], ['tasks', 'tasks', Tasks],
              ['attendance', 'attendance', Attendance], ['maintenance', 'maintenance', Maintenance], ['reports', 'reports', Reports], ['settings', 'settings', Settings], ['notifications', 'notifications', Notifications],
            ].map(([path, k, El]) => (
              <Route key={path} path={path} element={<Suspense fallback={<Loading />}>{page(k, El)}</Suspense>} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </HashRouter>
  );
}
