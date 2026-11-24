// Customer app (live): customers sign in or create an account with their farm's code, then shop,
// book pick-ups and pay. Farm and admin pages are not part of this build; the database refuses them too.
import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '../components/ui';
import PortalLayout from '../components/layout/PortalLayout';
import LiveRoot from '../modules/live/LiveRoot';
import { Loading, useAppTheme } from './shared';
import { useSession } from '../data/store';

const PortalHome = lazy(() => import('../modules/portal/Home'));
const Shop = lazy(() => import('../modules/portal/Shop'));
const Credits = lazy(() => import('../modules/portal/Credits'));
const BuyerMarket = lazy(() => import('../modules/market/BuyerMarket'));
const Cart = lazy(() => import('../modules/portal/Cart'));
const Account = lazy(() => import('../modules/portal/Account'));
const MyOrders = lazy(() => import('../modules/portal/MyOrders'));

// Marketplace-only buyers (no farm) start on the marketplace.
function Home() {
  const noFarm = useSession((s) => s.profile && !s.profile.business_id);
  return noFarm ? <Navigate to="/market" replace /> : <PortalHome />;
}

function Routed() {
  return (
    <HashRouter>
      <Suspense fallback={<div className="mx-auto max-w-5xl p-6"><Loading /></div>}>
        <Routes>
          <Route element={<PortalLayout />}>
            <Route index element={<Home />} />
            <Route path="shop" element={<Shop />} />
            <Route path="credits" element={<Credits />} />
            <Route path="market" element={<BuyerMarket />} />
            <Route path="cart" element={<Cart />} />
            <Route path="account" element={<Account />} />
            <Route path="account/orders" element={<MyOrders />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
