// PoultryPro Admin (live): farm-business owners run their farms and approve their people;
// the super admin manages the whole platform.
import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '../data/store';
import { Toaster } from '../components/ui';
import AppShell from '../components/layout/AppShell';
import LiveRoot from '../modules/live/LiveRoot';
import { pages, STAFF_ROUTES, Loading, Gate, useAppTheme } from './shared';

const { Dashboard } = pages;

const Finance = lazy(() => import('../modules/finance/Finance'));
const Wallet = lazy(() => import('../modules/finance/Wallet'));
const Payroll = lazy(() => import('../modules/staff/Payroll'));
const Settings = lazy(() => import('../modules/settings/Settings'));
const Accounts = lazy(() => import('../modules/admin/Accounts'));
const Platform = lazy(() => import('../modules/platform/Platform'));

const OWNER_ROUTES = [...STAFF_ROUTES, ['finance', 'finance', Finance], ['wallet', 'wallet', Wallet], ['payroll', 'payroll', Payroll], ['settings', 'settings', Settings], ['accounts', 'accounts', Accounts]];

function Routed() {
  const role = useSession((s) => s.profile?.role);
  const viewing = useSession((s) => s.viewBusinessId);
  const platform = role === 'super_admin' && !viewing;
  return (
    <HashRouter>
      <Suspense fallback={<div className="mx-auto max-w-5xl p-6"><Loading /></div>}>
        <Routes>
          {role === 'super_admin' && <Route path="platform" element={<Platform />} />}
          {!platform && (
            <Route path="app" element={<AppShell />}>
              <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
              {OWNER_ROUTES.map(([path, k, El]) => (
                <Route key={path} path={path} element={<Suspense fallback={<Loading />}><Gate k={k}><El /></Gate></Suspense>} />
              ))}
            </Route>
          )}
          <Route path="*" element={<Navigate to={platform ? '/platform' : '/app'} replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </HashRouter>
  );
}

export default function AdminApp() {
  useAppTheme();
  return (
    <LiveRoot>
      <Routed />
    </LiveRoot>
  );
}
