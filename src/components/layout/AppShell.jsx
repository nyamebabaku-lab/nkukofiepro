import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Eye, Menu, X, Bell, Moon, Sun, LogOut, ChevronsLeft, ChevronsRight, Search, Plus, Store, ChevronDown, MapPin, WifiOff, Download, Check, MoreHorizontal } from 'lucide-react';
import { useDB, useSession } from '../../data/store';
import { useCurrentUser, useMyFarms, useFarmScope, notificationsFor } from '../../data/selectors';
import { navFor, navItem, MOBILE_TABS, ROLES } from '../../lib/nav';
import { useOnline, useInstall, isIOS } from '../../data/offline';
import { isNative, APK_URL } from '../../data/native';
import { Avatar, Badge, Modal, cx, toast } from '../ui';
import QuickLog, { useQuickLog } from '../QuickLog';
import Logo from './Logo';
import { LIVE } from '../../config';
import { leave } from '../../modules/live/useLive';
import { enterApp } from '../../lib/accounts';
import { ChangePasswordModal } from '../../modules/live/Passwords';

function SidebarNav({ role, collapsed, onNavigate }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
      {navFor(role).map((g) => (
        <div key={g.group}>
          {!collapsed && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-brand-200/40">{g.group}</p>}
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <NavLink
                key={it.key}
                to={it.path}
                end={it.path === '/app'}
                onClick={onNavigate}
                title={collapsed ? it.label : undefined}
                className={({ isActive }) => cx('nav-link', isActive && 'active', collapsed && 'justify-center px-0')}
              >
                <it.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Farm switcher: "All farms" or one farm. Managers only see the farms they run. */
function FarmSwitcher({ collapsed, onPick }) {
  const user = useCurrentUser();
  const farms = useMyFarms();
  const scope = useFarmScope();
  const setFarm = useSession((s) => s.setFarm);
  const [open, setOpen] = useState(false);
  const current = farms.find((f) => f.id === scope);
  if (collapsed) return null;
  const canAll = user.role === 'owner' || farms.length > 1;
  const opts = [...(canAll ? [{ id: 'all', name: user.role === 'owner' ? 'All farms' : 'My farms', location: `${farms.length} farms` }] : []), ...farms];
  return (
    <div className="relative mx-3 mb-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="grain flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-800 p-3.5 text-left text-white shadow-lg shadow-black/20 ring-1 ring-white/10">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ background: current?.color || '#d9a441', color: current ? '#fff' : '#0e1c14' }}>
          {current ? current.short[0] : <MapPin className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-200/70">Viewing</span>
          <span className="block truncate text-sm font-bold">{current?.name || (user.role === 'owner' ? 'All farms' : 'My farms')}</span>
        </span>
        <ChevronDown className={cx('h-4 w-4 text-brand-200 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 animate-scale-in overflow-hidden rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-black/5 dark:bg-navy-800">
          {opts.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFarm(f.id);
                setOpen(false);
                onPick?.();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream-100 dark:hover:bg-white/5"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color || '#d9a441' }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white">{f.name}</span>
                <span className="block truncate text-xs text-slate-500">{f.location}</span>
              </span>
              {scope === f.id && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Search flocks, customers, orders and products from anywhere (Ctrl/⌘ K). */
function GlobalSearch({ open, onClose }) {
  const db = useDB();
  const user = useCurrentUser();
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    const out = [];
    const pages = navFor(user.role).flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(n)).map((i) => ({ group: 'Pages', label: i.label, sub: 'Go to page', to: i.path }));
    out.push(...pages);
    out.push(...db.flocks.filter((f) => `${f.code} ${f.breed}`.toLowerCase().includes(n)).slice(0, 5).map((f) => ({ group: 'Flocks', label: `${f.code} · ${f.breed}`, sub: db.farms.find((x) => x.id === f.farmId)?.name, to: `/app/flocks/${f.id}` })));
    if (user.role !== 'worker') {
      out.push(...db.customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(n)).slice(0, 5).map((c) => ({ group: 'Customers', label: c.name, sub: c.phone, to: `/app/customers/${c.id}` })));
      out.push(...db.orders.filter((o) => `${o.ref} ${o.customerName}`.toLowerCase().includes(n)).slice(-5).reverse().map((o) => ({ group: 'Orders', label: o.ref, sub: o.customerName, to: `/app/orders/${o.id}` })));
      out.push(...db.products.filter((p) => p.name.toLowerCase().includes(n)).slice(0, 4).map((p) => ({ group: 'Products', label: p.name, sub: p.unit, to: '/app/products' })));
    }
    return out;
  }, [q, db, user.role]);
  const go = (to) => {
    navigate(to);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Search" size="md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input autoFocus className="input h-12 pl-10 text-base" placeholder="Flock code, customer, order ref, page…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && results[0] && go(results[0].to)} />
      </div>
      <div className="mt-4 space-y-1">
        {q.trim().length >= 2 && !results.length && <p className="py-8 text-center text-sm text-slate-500">No matches</p>}
        {results.map((r, i) => (
          <button key={i} type="button" onClick={() => go(r.to)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cream-100 dark:hover:bg-white/5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white">{r.label}</span>
              <span className="block truncate text-xs text-slate-500">{r.sub}</span>
            </span>
            <Badge tone="slate">{r.group}</Badge>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function InstallBanner() {
  const { prompt, installed } = useInstall();
  const [hide, setHide] = useState(() => {
    try {
      return localStorage.getItem('pp-install-hide') === '1';
    } catch {
      return false;
    }
  });
  const [iosHelp, setIosHelp] = useState(false);
  if (isNative() || installed || hide || (!prompt && !isIOS())) return null;
  const dismiss = () => {
    setHide(true);
    try {
      localStorage.setItem('pp-install-hide', '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <>
      <div className="no-print mb-5 flex items-center gap-3 rounded-2xl bg-brand-800 p-3 pl-4 text-white shadow-lift">
        <Download className="h-5 w-5 shrink-0 text-gold-400" />
        <p className="min-w-0 flex-1 text-sm"><b>Install PoultryPro</b> on this phone or computer — opens like an app, works offline. <a href={APK_URL} className="font-semibold text-gold-300 underline">Android APK</a></p>
        <button type="button" className="rounded-xl bg-gold-500 px-3 py-1.5 text-xs font-bold text-brand-950" onClick={async () => (prompt ? (prompt.prompt(), await prompt.userChoice, useInstall.setState({ prompt: null })) : setIosHelp(true))}>
          Install
        </button>
        <button type="button" onClick={dismiss} className="rounded-lg p-1 text-brand-200 hover:bg-white/10" aria-label="Dismiss"><X className="h-4 w-4" /></button>
      </div>
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="Add to Home Screen" size="sm">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Open this page in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button (square with an arrow).</li>
          <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        </ol>
      </Modal>
    </>
  );
}

export default function AppShell() {
  const user = useCurrentUser();
  const { dark, toggleDark, logout, sidebarCollapsed, toggleSidebar } = useSession();
  const notifications = useDB((s) => s.notifications);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const online = useOnline();
  const showLog = useQuickLog((s) => s.show);
  const loc = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!user) return null;
  const unread = notificationsFor(user, null, notifications).filter((n) => !n.read).length;
  const tabs = (MOBILE_TABS[user.role] || ['dashboard']).map((k) => navItem(k)).filter(Boolean);
  const signOut = () => {
    if (LIVE) return leave();
    logout();
    toast.info('Signed out');
    return navigate('/login');
  };
  const backToPlatform = async () => {
    await enterApp(useSession.getState().profile, { viewBusinessId: null });
    navigate('/platform');
  };
  const title = navFor(user.role).flatMap((g) => g.items).find((i) => (i.path === '/app' ? loc.pathname === '/app' : loc.pathname.startsWith(i.path)))?.label || 'PoultryPro';

  return (
    <div className="min-h-screen bg-cream-100 dark:bg-navy-950">
      <aside className={cx('no-print fixed inset-y-0 left-0 z-30 hidden flex-col bg-brand-900 transition-all dark:bg-navy-900 lg:flex', sidebarCollapsed ? 'w-20' : 'w-72')}>
        <Link to="/app" className={cx('flex h-20 items-center px-5', sidebarCollapsed && 'justify-center px-0')}>
          <Logo compact={sidebarCollapsed} dark />
        </Link>
        <FarmSwitcher collapsed={sidebarCollapsed} />
        <SidebarNav role={user.role} collapsed={sidebarCollapsed} />
        <button type="button" onClick={toggleSidebar} className="m-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-brand-200/60 hover:bg-white/5 hover:text-white">
          {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[86%] max-w-xs animate-slide-in flex-col bg-brand-900 dark:bg-navy-900">
            <div className="flex h-20 items-center justify-between px-5">
              <Logo dark />
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-brand-100 hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <FarmSwitcher onPick={() => setMobileOpen(false)} />
            <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cx('transition-all print-pl-0', sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72')}>
        <header className="no-print sticky top-0 z-20 border-b border-cream-200 bg-cream-100/85 backdrop-blur-xl dark:border-white/5 dark:bg-navy-950/85">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <p className="truncate font-display text-lg font-semibold text-brand-900 dark:text-white lg:hidden">{title}</p>
            <button type="button" onClick={() => setSearchOpen(true)} className="ml-auto hidden h-10 w-80 items-center gap-2 whitespace-nowrap rounded-xl border border-cream-300/70 bg-white px-3 text-sm text-slate-400 transition hover:border-brand-300 dark:border-white/10 dark:bg-navy-900 md:flex lg:ml-0">
              <Search className="h-4 w-4 shrink-0" /> <span className="truncate">Search flocks, customers, orders…</span>
              <kbd className="ml-auto rounded-md bg-cream-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              {!online && <Badge tone="amber" className="mr-1"><WifiOff className="h-3 w-3" /> Offline</Badge>}
              <button type="button" onClick={() => setSearchOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10 md:hidden" aria-label="Search"><Search className="h-5 w-5" /></button>
              <button type="button" onClick={() => showLog()} className="hidden h-10 items-center gap-2 rounded-xl bg-gold-500 px-4 text-sm font-bold text-brand-950 shadow-sm shadow-gold-600/30 transition hover:bg-gold-400 active:scale-[.98] lg:inline-flex">
                <Plus className="h-4 w-4" /> Quick log
              </button>
              <button type="button" onClick={toggleDark} className="rounded-xl p-2 text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Toggle dark mode">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
              <Link to="/app/notifications" className="relative rounded-xl p-2 text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <div className="relative">
                <button type="button" onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-cream-200 dark:hover:bg-white/10">
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-semibold leading-tight text-slate-800 dark:text-white">{user.name.split(' ')[0]}</span>
                    <span className="block text-[11px] leading-tight text-slate-500">{ROLES[user.role]?.label}</span>
                  </span>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-40 mt-2 w-64 animate-scale-in rounded-2xl bg-white p-2 shadow-lift ring-1 ring-black/5 dark:bg-navy-800">
                      <div className="px-3 py-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.position}</p>
                      </div>
                      {!LIVE && <Link to="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-cream-100 dark:text-slate-200 dark:hover:bg-white/5"><Store className="h-4 w-4" /> Open customer shop</Link>}
                      {user.readOnly && <button type="button" onClick={backToPlatform} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-cream-100 dark:text-slate-200 dark:hover:bg-white/5"><Eye className="h-4 w-4" /> Back to platform</button>}
                      {LIVE && !user.readOnly && <button type="button" onClick={() => { setMenuOpen(false); setPwOpen(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-cream-100 dark:text-slate-200 dark:hover:bg-white/5"><KeyRound className="h-4 w-4" /> Change password</button>}
                      <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-accent-700 hover:bg-accent-50 dark:text-accent-300 dark:hover:bg-accent-500/10"><LogOut className="h-4 w-4" /> Sign out</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] animate-fade-in px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          {user.readOnly && (
            <div className="no-print mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-gold-100 p-3 pl-4 text-sm text-gold-900 ring-1 ring-gold-300 dark:bg-gold-500/15 dark:text-gold-200">
              <Eye className="h-5 w-5 shrink-0" />
              <p className="min-w-0 flex-1"><b>Read-only support view.</b> You are looking at this farm business as the super admin — changes you make here are not saved.</p>
              <button type="button" onClick={backToPlatform} className="rounded-xl bg-brand-700 px-3 py-1.5 text-xs font-bold text-white">Back to platform</button>
            </div>
          )}
          <InstallBanner />
          <Outlet />
        </main>
      </div>

      {/* Phone bottom bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 pb-safe backdrop-blur-xl dark:border-white/5 dark:bg-navy-900/95 lg:hidden">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
          {tabs.slice(0, 2).map((t) => <Tab key={t.key} t={t} />)}
          <div className="flex justify-center">
            <button type="button" onClick={() => showLog()} className="-mt-8 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-gold-500 text-brand-950 shadow-xl shadow-gold-600/40 ring-4 ring-cream-100 active:scale-95 dark:ring-navy-950" aria-label="Quick log">
              <Plus className="h-7 w-7" strokeWidth={2.6} />
            </button>
          </div>
          {tabs.slice(2, 3).map((t) => <Tab key={t.key} t={t} />)}
          <button type="button" onClick={() => setMobileOpen(true)} className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-slate-500">
            <MoreHorizontal className="h-5 w-5" /> More
          </button>
        </div>
      </nav>

      <QuickLog />
      {LIVE && <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function Tab({ t }) {
  return (
    <NavLink to={t.path} end={t.path === '/app'} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 text-[10px] font-semibold transition', isActive ? 'text-brand-700 dark:text-gold-400' : 'text-slate-500')}>
      <t.icon className="h-5 w-5" />
      {t.label.split(' ')[0]}
    </NavLink>
  );
}
