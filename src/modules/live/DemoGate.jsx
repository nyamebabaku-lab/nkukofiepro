// Demo site: the super admin can switch it off (platform_settings.demo_enabled). When off, the demo
// data saved in this browser is wiped and a "closed" screen is shown. Without internet the last answer is used.
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import Logo from '../../components/layout/Logo';
import { DB_KEY } from '../../data/store';

const KEY = 'poultrypro-demo-enabled';
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

const lastKnown = () => {
  try {
    return localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
};

function wipeDemo() {
  try {
    [DB_KEY, 'poultrypro-session', 'poultrypro-cart'].forEach((k) => localStorage.removeItem(k));
    indexedDB.deleteDatabase('poultrypro-photos');
  } catch {
    /* ignore */
  }
}

export default function DemoGate({ children }) {
  const [enabled, setEnabled] = useState(lastKnown);
  useEffect(() => {
    if (!url || !anon) return;
    fetch(`${url}/rest/v1/platform_settings?select=demo_enabled&id=eq.1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!rows?.[0]) return;
        const on = rows[0].demo_enabled !== false;
        try {
          localStorage.setItem(KEY, String(on));
        } catch {
          /* ignore */
        }
        if (!on) wipeDemo();
        setEnabled(on);
      })
      .catch(() => {});
  }, []);
  if (enabled) return children;
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-5 dark:bg-navy-950">
      <div className="card w-full max-w-md p-8 text-center">
        <Logo className="mb-8 justify-center" />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cream-200 text-brand-800 dark:bg-white/10 dark:text-white"><Lock className="h-8 w-8" /></div>
        <h1 className="font-display text-2xl font-semibold text-brand-900 dark:text-white">The demo is closed</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">The PoultryPro demo is not available right now. Farms using PoultryPro sign in with the PoultryPro or PoultryPro Admin app.</p>
      </div>
    </div>
  );
}
