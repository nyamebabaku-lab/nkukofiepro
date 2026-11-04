// PoultryPro (live): customers, farm workers and farm managers. Sign in or create an account only —
// owner and admin pages are not part of this build, and the database refuses them too.
import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '../data/store';
import { Toaster } from '../components/ui';
import AppShell from '../components/layout/AppShell';
import PortalLayout from '../components/layout/PortalLayout';
import LiveRoot from '../modules/live/LiveRoot';
import { pages, STAFF_ROUTES, Loading, Gate, useAppTheme } from './shared';

const { Dashboard } = pages;

const PortalHome = lazy(() => import('../modules/portal/Home'));
const Shop = lazy(() => import('../modules/portal/Shop'));
const Cart = lazy(() => import('../modules/portal/Cart'));
const Account = lazy(() => import('../modules/portal/Account'));
const MyOrders = lazy(() => import('../modules/portal/MyOrders'));

function Routed() {
  const customer = useSession((s) => s.customerId);
  return (
    <HashRouter>
      <Suspense fallback={<div className="mx-auto max-w-5xl p-6"><Loading /></div>}>
        {customer ? (
          <Routes>
            <Route element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="shop" element={<Shop />} />
              <Route path="cart" element={<Cart />} />
              <Route path="account" element={<Account />} />
              <Route path="account/orders" element={<MyOrders />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="app" element={<AppShell />}>
              <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
              {STAFF_ROUTES.map(([path, k, El]) => (
                <Route key={path} path={path} element={<Suspense fallback={<Loading />}><Gate k={k}><El /></Gate></Suspense>} />
              ))}
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        )}
      </Suspense>
      <Toaster />
    </HashRouter>
  );
}

export default function MainApp() {
  useAppTheme();
  return (
    <LiveRoot>
      <Routed />
    </LiveRoot>
  );
}
