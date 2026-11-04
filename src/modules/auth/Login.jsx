import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Crown, ClipboardList, HardHat, ShoppingBasket, ArrowRight, Eye, EyeOff, Egg, Bird, Wallet } from 'lucide-react';
import { useDB, useSession } from '../../data/store';
import { Button, Field, Input, Segmented, toast, cx } from '../../components/ui';
import Logo from '../../components/layout/Logo';
import { Photo } from '../../components/ProductArt';

const DEMOS = [
  { id: 'usr_owner', label: 'Owner', sub: 'Kwame · all farms, money & wallet', icon: Crown, tone: 'bg-gold-500 text-brand-950' },
  { id: 'usr_akosua', label: 'Farm manager', sub: 'Akosua · Dodowa & Kasoa', icon: ClipboardList, tone: 'bg-brand-700 text-white' },
  { id: 'usr_kojo', label: 'Farm worker', sub: 'Kojo · daily records & tasks', icon: HardHat, tone: 'bg-accent-600 text-white' },
  { id: 'cus_kofi', label: 'Customer', sub: 'Kofi · shop, orders & balance', icon: ShoppingBasket, tone: 'bg-teal-700 text-white', customer: true },
];

export default function Login() {
  const users = useDB((s) => s.users);
  const customers = useDB((s) => s.customers);
  const { login, loginCustomer } = useSession();
  const navigate = useNavigate();
  const loc = useLocation();
  const [mode, setMode] = useState(loc.state?.customer ? 'customer' : 'staff');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);

  const enter = (rec, isCustomer) => {
    if (isCustomer) {
      loginCustomer(rec.id);
      toast.success(`Akwaaba, ${rec.name.split(' ')[0]}!`);
      navigate(loc.state?.from && !loc.state.from.startsWith('/app') ? loc.state.from : '/account');
    } else {
      if (rec.status === 'inactive') return toast.error('Account disabled', 'Ask the farm owner to re-activate it.');
      login(rec.id);
      toast.success(`Welcome back, ${rec.name.split(' ')[0]}`);
      navigate(loc.state?.from?.startsWith('/app') ? loc.state.from : '/app');
    }
    return null;
  };

  const submit = (e) => {
    e.preventDefault();
    const key = id.trim().toLowerCase();
    const list = mode === 'customer' ? customers : users;
    const rec = list.find((u) => u.email?.toLowerCase() === key || u.phone?.replace(/\s/g, '') === key.replace(/\s/g, ''));
    if (!rec || rec.password !== pw) return toast.error('Wrong details', 'Check your email/phone and password. Demo password: demo123');
    return enter(rec, mode === 'customer');
  };

  return (
    <div className="grid min-h-screen bg-cream-100 dark:bg-navy-950 lg:grid-cols-[1.05fr_1fr]">
      <div className="grain hero-glow relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <Logo dark />
        <div className="relative z-10 mt-auto max-w-lg">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-300 ring-1 ring-white/10">Layers · Broilers · Hatchery · Turkeys · Guinea fowl · Ducks</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">Every bird, egg and cedi — <span className="text-gold-400">in one place.</span></h1>
          <p className="mt-5 text-lg text-brand-100/80">Run all your farms from your phone: daily records, vaccinations, feed stock, staff, customer bookings, MoMo payments and your wallet.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[[Egg, 'Eggs today', '6,412'], [Bird, 'Live birds', '13,860'], [Wallet, 'Wallet', 'GH₵ 116k']].map(([I, l, v]) => (
              <div key={l} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
                <I className="h-5 w-5 text-gold-400" />
                <p className="mt-3 text-xl font-extrabold">{v}</p>
                <p className="text-xs text-brand-200/70">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 top-24 grid w-80 rotate-6 grid-cols-2 gap-4 opacity-90">
          {[['eggs', 'crate'], ['hen', 'hen'], ['chicks', 'chick'], ['turkey', 'turkey']].map(([k, a], i) => (
            <Photo key={k} k={k} art={a} className={cx('aspect-square w-full shadow-2xl ring-4 ring-white/10', i % 2 && 'translate-y-8')} rounded="rounded-3xl" />
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-900 dark:text-white">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Staff go to the farm dashboard. Customers go to their orders and balance.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {DEMOS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => enter((d.customer ? customers : users).find((u) => u.id === d.id), d.customer)}
                className="group flex items-start gap-3 rounded-2xl border border-cream-200 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift dark:border-white/10 dark:bg-navy-900"
              >
                <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', d.tone)}><d.icon className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">{d.label}</span>
                  <span className="block text-[11px] leading-snug text-slate-500">{d.sub}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-cream-300 dark:bg-white/10" /> or sign in with your details <span className="h-px flex-1 bg-cream-300 dark:bg-white/10" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Segmented className="w-full [&>button]:flex-1" options={[{ value: 'staff', label: 'Farm staff' }, { value: 'customer', label: 'Customer' }]} value={mode} onChange={setMode} />
            <Field label="Email or phone"><Input value={id} onChange={(e) => setId(e.target.value)} placeholder={mode === 'staff' ? 'owner@poultrypro.app' : 'kofi@demo.com or 0244123456'} autoComplete="username" /></Field>
            <Field label="Password">
              <div className="relative">
                <Input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="demo123" autoComplete="current-password" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Show password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </Field>
            <Button type="submit" size="lg" className="w-full" icon={ArrowRight}>Sign in</Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            New customer? <Link to="/signup" className="font-semibold text-brand-700 hover:underline dark:text-gold-400">Create an account</Link> · <Link to="/" className="font-semibold text-brand-700 hover:underline dark:text-gold-400">Browse the shop</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
