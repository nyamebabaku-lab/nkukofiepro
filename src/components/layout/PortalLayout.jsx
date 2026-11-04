import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBasket, User, LogOut, Moon, Sun, LayoutDashboard, Menu, X, Phone, MapPin, Bell } from 'lucide-react';
import { useCart, useDB, useSession } from '../../data/store';
import { useCurrentCustomer, useCurrentUser, notificationsFor } from '../../data/selectors';
import { Button, cx } from '../ui';
import Logo from './Logo';

export default function PortalLayout() {
  const customer = useCurrentCustomer();
  const staff = useCurrentUser();
  const lines = useCart((s) => s.lines);
  const { dark, toggleDark, logout } = useSession();
  const db = useDB();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const unread = customer ? notificationsFor(null, customer, db.notifications).filter((n) => !n.read).length : 0;
  const links = [
    { to: '/shop', label: 'Shop' },
    ...(customer ? [{ to: '/account/orders', label: 'My orders' }, { to: '/account', label: 'My account', end: true }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-cream-100 dark:bg-navy-950">
      <header className="sticky top-0 z-30 border-b border-cream-200 bg-cream-100/85 backdrop-blur-xl dark:border-white/5 dark:bg-navy-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/"><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('rounded-xl px-3 py-2 text-sm font-semibold transition', isActive ? 'bg-white text-brand-800 shadow-sm dark:bg-white/10 dark:text-white' : 'text-slate-600 hover:text-brand-800 dark:text-slate-300')}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={toggleDark} className="rounded-xl p-2 text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Toggle dark mode">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
            {customer && (
              <Link to="/account" className="relative rounded-xl p-2 text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent-600" />}
              </Link>
            )}
            <Link to="/cart" className="relative rounded-xl p-2 text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Cart">
              <ShoppingBasket className="h-5 w-5" />
              {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span>}
            </Link>
            {staff ? (
              <Link to="/app" className="ml-1 hidden sm:block"><Button size="sm" icon={LayoutDashboard}>Farm dashboard</Button></Link>
            ) : customer ? (
              <button type="button" onClick={() => { logout(); navigate('/'); }} className="ml-1 hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-cream-200 dark:text-slate-300 dark:hover:bg-white/10 sm:flex"><LogOut className="h-4 w-4" /> Sign out</button>
            ) : (
              <Link to="/login" state={{ customer: true }} className="ml-1 hidden sm:block"><Button size="sm" icon={User}>Sign in</Button></Link>
            )}
            <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-xl p-2 md:hidden" aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {open && (
          <div className="animate-fade-in border-t border-cream-200 px-4 py-3 dark:border-white/5 md:hidden">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className="block rounded-xl px-3 py-2.5 text-sm font-semibold">{l.label}</NavLink>)}
            {staff ? <NavLink to="/app" className="block rounded-xl px-3 py-2.5 text-sm font-semibold">Farm dashboard</NavLink> : customer ? <button type="button" className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold" onClick={() => { logout(); navigate('/'); }}>Sign out</button> : <NavLink to="/login" state={{ customer: true }} className="block rounded-xl px-3 py-2.5 text-sm font-semibold">Sign in / Register</NavLink>}
          </div>
        )}
      </header>
      <main className="flex-1 animate-fade-in"><Outlet /></main>
      <footer className="border-t border-cream-200 bg-brand-900 text-brand-100 dark:border-white/5 dark:bg-navy-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div><Logo dark /><p className="mt-3 text-sm text-brand-100/70">{db.settings.tagline}</p></div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white">Our farms</p>
            {db.farms.map((f) => <p key={f.id} className="flex items-center gap-2 text-brand-100/70"><MapPin className="h-4 w-4" /> {f.name} · {f.location}</p>)}
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white">Talk to us</p>
            <p className="flex items-center gap-2 text-brand-100/70"><Phone className="h-4 w-4" /> {db.settings.phone}</p>
            <p className="text-brand-100/70">Pick-ups {db.settings.pickupHours}, Mon–Sat</p>
            <p className="flex gap-4 pt-2 text-xs font-semibold"><Link to="/login" className="text-gold-400 hover:underline">Staff sign in →</Link><Link to="/credits" className="text-brand-100/60 hover:underline">Photo credits</Link></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
