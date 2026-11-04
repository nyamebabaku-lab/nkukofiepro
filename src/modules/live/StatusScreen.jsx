// Shown instead of the app while an account waits for approval, is blocked, or is in the wrong app.
import { Hourglass, Ban, Smartphone, RefreshCw, LogOut, WifiOff, Settings2, Loader2 } from 'lucide-react';
import { MODE } from '../../config';
import { Button } from '../../components/ui';
import Logo from '../../components/layout/Logo';
import { roleLabel } from '../../lib/accounts';
import { useLive, refresh, leave } from './useLive';

const TEXT = {
  pending: (p) => ({
    icon: Hourglass,
    title: 'Waiting for approval',
    text: p.role === 'owner'
      ? `Thanks for registering ${p.business?.name || 'your farm business'}. The PoultryPro team will check and approve it — this screen opens the app by itself as soon as it's approved.`
      : `Your ${roleLabel(p.role).toLowerCase()} account at ${p.business?.name || 'the farm'} is waiting for the owner to approve it. This screen updates by itself once they do.`,
  }),
  blocked: (p) => ({
    icon: Ban,
    title: p.status === 'suspended' ? 'Account suspended' : 'Account deactivated',
    text: `${p.note ? `Reason: ${p.note}. ` : ''}Please contact ${p.role === 'owner' ? 'the PoultryPro platform team' : `${p.business?.name || 'the farm'}`} if you think this is a mistake.`,
  }),
  businessBlocked: (p) => ({
    icon: Ban,
    title: `${p.business?.name || 'This farm business'} is ${p.business?.status || 'closed'}`,
    text: 'The farm business is not active on PoultryPro right now, so its app cannot be used. Please contact the farm.',
  }),
  wrongApp: (p) => ({
    icon: Smartphone,
    title: MODE === 'admin' ? 'Please use the PoultryPro app' : 'Please use PoultryPro Admin',
    text: MODE === 'admin'
      ? `This app is for farm owners and platform admins. As a ${roleLabel(p.role).toLowerCase()}, sign in with the PoultryPro app instead.`
      : 'Owners and admins manage the farm in the PoultryPro Admin app. Sign in there instead.',
  }),
  error: (p, notice) => ({ icon: WifiOff, title: 'Could not connect', text: notice || 'Check your internet connection and try again.' }),
  unconfigured: () => ({ icon: Settings2, title: 'Almost ready', text: 'This app has not been connected to its online database yet.' }),
};

export function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-900">
      <Logo dark />
      <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
    </div>
  );
}

export default function StatusScreen() {
  const { phase, profile, notice } = useLive();
  const t = (TEXT[phase] || TEXT.error)(profile || {}, notice);
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-5 dark:bg-navy-950">
      <div className="card w-full max-w-md p-8 text-center">
        <Logo className="mb-8 justify-center" />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-700 dark:bg-gold-500/15 dark:text-gold-300">
          <t.icon className={phase === 'pending' ? 'h-8 w-8 animate-pulse-soft' : 'h-8 w-8'} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-brand-900 dark:text-white">{t.title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.text}</p>
        {profile?.full_name && <p className="mt-4 text-xs text-slate-400">Signed in as {profile.full_name} · {profile.phone}</p>}
        <div className="mt-6 flex justify-center gap-2">
          {phase !== 'unconfigured' && <Button variant="secondary" icon={RefreshCw} onClick={() => refresh()}>Check again</Button>}
          {profile && <Button variant="ghost" icon={LogOut} onClick={() => leave()}>Sign out</Button>}
        </div>
      </div>
    </div>
  );
}
