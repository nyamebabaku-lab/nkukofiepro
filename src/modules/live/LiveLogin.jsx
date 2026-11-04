// Live sign-in / create-account screens. PoultryPro: customers, workers and managers join with a farm code.
// PoultryPro Admin: owners register a farm business; the very first visit sets up the super admin.
import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, CheckCircle2, ShieldCheck, Building2, UserPlus, LogIn, Loader2, KeyRound } from 'lucide-react';
import { Button, Field, Input, Segmented, toast, cx } from '../../components/ui';
import Logo from '../../components/layout/Logo';
import HeroPhoto from '../../components/HeroPhoto';
import { signIn, signUpMember, registerBusiness, businessByCode, superAdminExists, claimSuperAdmin, requestReset, MEMBER_ROLES } from '../../lib/accounts';
import { decide, useLive } from './useLive';

// Compared directly so each build drops the other app's forms entirely.
const ADMIN = import.meta.env.VITE_APP === 'admin';

function Password({ value, onChange, placeholder = 'At least 6 characters', auto = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={auto} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Show password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
    </div>
  );
}

function ForgotForm({ phone, onBack }) {
  const [v, setV] = useState(phone || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestReset(v);
      setSent(true);
    } catch (err) {
      toast.error('Not sent', err.message);
    }
    setBusy(false);
  };
  if (sent)
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><CheckCircle2 className="h-8 w-8" /></div>
        <p className="font-semibold text-slate-900 dark:text-white">Request sent</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">If {v} has an account, {ADMIN ? 'the PoultryPro platform admin' : 'your farm owner'} can now see your request. They will give you a <b>temporary password</b> — sign in with it and the app will ask you to choose a new one.</p>
        <Button variant="secondary" className="w-full" onClick={onBack}>Back to sign in</Button>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Enter the phone number you sign in with. {ADMIN ? 'The PoultryPro platform admin' : 'Your farm owner'} will be asked to reset your password.</p>
      <Field label="Phone number"><Input inputMode="tel" autoComplete="username" value={v} onChange={(e) => setV(e.target.value)} placeholder="024 123 4567" /></Field>
      <Button type="submit" size="lg" className="w-full" icon={busy ? Loader2 : KeyRound} disabled={busy}>Ask for a password reset</Button>
      <button type="button" onClick={onBack} className="w-full text-center text-sm text-slate-500 hover:underline">Back to sign in</button>
    </form>
  );
}

function SignInForm() {
  const [v, setV] = useState({ phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await decide(await signIn(v.phone, v.password));
    } catch (err) {
      toast.error('Could not sign in', err.message);
    }
    setBusy(false);
  };
  if (forgot) return <ForgotForm phone={v.phone} onBack={() => setForgot(false)} />;
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Phone number"><Input inputMode="tel" autoComplete="username" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="024 123 4567" /></Field>
      <Field label="Password"><Password value={v.password} onChange={(password) => setV({ ...v, password })} placeholder="Your password" /></Field>
      <Button type="submit" size="lg" className="w-full" icon={busy ? Loader2 : LogIn} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <button type="button" onClick={() => setForgot(true)} className="w-full text-center text-sm font-semibold text-brand-700 hover:underline dark:text-gold-400">Forgot password?</button>
    </form>
  );
}

function JoinForm() {
  const [v, setV] = useState({ fullName: '', phone: '', password: '', code: '', role: 'customer' });
  const [farm, setFarm] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  useEffect(() => {
    setFarm(null);
    const code = v.code.trim();
    if (code.length < 5) return undefined;
    const t = setTimeout(() => businessByCode(code).then((b) => setFarm(b || false)).catch(() => setFarm(null)), 500);
    return () => clearTimeout(t);
  }, [v.code]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await decide(await signUpMember(v));
    } catch (err) {
      toast.error('Account not created', err.message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Farm code" hint={farm ? undefined : 'Ask the farm for its code, e.g. DODOWA-482'}>
        <Input value={v.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="FARMNAME-123" autoCapitalize="characters" />
      </Field>
      {farm && <p className="-mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> {farm.name}{farm.location ? ` · ${farm.location}` : ''}</p>}
      {farm === false && <p className="-mt-2 text-sm font-medium text-accent-600">No active farm has that code.</p>}
      <div>
        <span className="label">I am a</span>
        <Segmented className="w-full [&>button]:flex-1" options={MEMBER_ROLES} value={v.role} onChange={(r) => set('role', r)} />
      </div>
      <Field label="Full name"><Input value={v.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" /></Field>
      <Field label="Phone number" hint="You'll sign in with this number"><Input inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="024 123 4567" /></Field>
      <Field label="Create a password"><Password value={v.password} onChange={(p) => set('password', p)} auto="new-password" /></Field>
      <Button type="submit" size="lg" className="w-full" icon={busy ? Loader2 : UserPlus} disabled={busy || !farm}>{busy ? 'Creating…' : 'Create account'}</Button>
      <p className="text-center text-xs text-slate-500">The farm owner approves new accounts before you can use the app.</p>
    </form>
  );
}

function BusinessForm() {
  const [v, setV] = useState({ bizName: '', bizLocation: '', bizPhone: '', fullName: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await decide(await registerBusiness(v));
    } catch (err) {
      toast.error('Not registered', err.message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Farm business name" className="sm:col-span-2"><Input value={v.bizName} onChange={(e) => set('bizName', e.target.value)} placeholder="e.g. Golden Egg Farms" /></Field>
        <Field label="Location"><Input value={v.bizLocation} onChange={(e) => set('bizLocation', e.target.value)} placeholder="Town, region" /></Field>
        <Field label="Business phone"><Input inputMode="tel" value={v.bizPhone} onChange={(e) => set('bizPhone', e.target.value)} placeholder="Optional" /></Field>
        <Field label="Your full name (owner)" className="sm:col-span-2"><Input value={v.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" /></Field>
        <Field label="Your phone number" hint="You'll sign in with this number"><Input inputMode="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="024 123 4567" /></Field>
        <Field label="Create a password"><Password value={v.password} onChange={(p) => set('password', p)} auto="new-password" /></Field>
      </div>
      <Button type="submit" size="lg" className="w-full" icon={busy ? Loader2 : Building2} disabled={busy}>{busy ? 'Registering…' : 'Register farm business'}</Button>
      <p className="text-center text-xs text-slate-500">The PoultryPro platform admin checks and approves new farm businesses.</p>
    </form>
  );
}

function SuperAdminSetup() {
  const [v, setV] = useState({ fullName: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await decide(await claimSuperAdmin(v));
      toast.success('Super admin created', 'You manage the whole platform');
    } catch (err) {
      toast.error('Not created', err.message);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-gold-50 p-4 text-sm text-gold-900 dark:bg-gold-500/10 dark:text-gold-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p><b>First-time setup.</b> Create the super admin account. It approves farm businesses and can suspend or delete any account. This screen disappears once it's done.</p>
      </div>
      <Field label="Full name"><Input value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} /></Field>
      <Field label="Phone number"><Input inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="024 123 4567" /></Field>
      <Field label="Password"><Password value={v.password} onChange={(password) => setV({ ...v, password })} auto="new-password" /></Field>
      <Button type="submit" size="lg" className="w-full" icon={busy ? Loader2 : ArrowRight} disabled={busy}>Create super admin</Button>
    </form>
  );
}

export default function LiveLogin() {
  const admin = ADMIN;
  const notice = useLive((s) => s.notice);
  const [tab, setTab] = useState('in');
  const [needsSuper, setNeedsSuper] = useState(false);
  useEffect(() => {
    if (admin) superAdminExists().then((x) => setNeedsSuper(!x)).catch(() => {});
  }, [admin]);
  const title = needsSuper ? 'Set up PoultryPro' : tab === 'in' ? 'Sign in' : admin ? 'Register your farm business' : 'Create your account';

  return (
    <div className="grid min-h-screen bg-cream-100 dark:bg-navy-950 lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <HeroPhoto focus="60% 30%" fade="up" />
        <div className="relative"><Logo dark /></div>
        <div className="relative mt-auto max-w-lg">
          <p className="mb-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-300 ring-1 ring-white/10">{admin ? 'For farm owners & platform admins' : 'For customers, farm workers & managers'}</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">{admin ? <>Run your farm business, <span className="text-gold-400">approve your team.</span></> : <>Your farm, <span className="text-gold-400">in your pocket.</span></>}</h1>
          <p className="mt-5 text-lg text-brand-100/80">{admin ? 'Flocks, eggs, feed, staff, sales and payments — and full control over who can use your farm app.' : 'Order fresh eggs and birds, or record your daily farm work — all with one account.'}</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {admin && <p className="mb-2 inline-flex rounded-full bg-brand-700 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">Admin</p>}
          <h2 className="font-display text-3xl font-semibold tracking-tight text-brand-900 dark:text-white">{title}</h2>
          {notice && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{notice}</p>}
          {ADMIN && needsSuper ? (
            <div className="mt-6"><SuperAdminSetup /></div>
          ) : (
            <>
              <Segmented className="mt-6 w-full [&>button]:flex-1" options={[{ value: 'in', label: 'Sign in' }, { value: 'up', label: admin ? 'Register business' : 'Create account' }]} value={tab} onChange={setTab} />
              <div className={cx('mt-6')}>{tab === 'in' ? <SignInForm /> : ADMIN ? <BusinessForm /> : <JoinForm />}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
