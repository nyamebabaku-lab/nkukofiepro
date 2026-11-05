// Password screens: change password, forced change after a reset, and showing a temporary password.
import { useState } from 'react';
import { KeyRound, Copy, Share2, Loader2, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { sendSms } from '../../lib/sms';
import { Button, Field, Input, Modal, toast } from '../../components/ui';
import Logo from '../../components/layout/Logo';
import { changeMyPassword } from '../../lib/accounts';
import { useLive, refresh, leave } from './useLive';

function PasswordFields({ v, setV }) {
  const [show, setShow] = useState(false);
  const type = show ? 'text' : 'password';
  return (
    <div className="space-y-4">
      <Field label="New password" hint="At least 6 characters">
        <div className="relative">
          <Input type={type} autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Show password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
      </Field>
      <Field label="Type it again"><Input type={type} autoComplete="new-password" value={v.again} onChange={(e) => setV({ ...v, again: e.target.value })} /></Field>
    </div>
  );
}

/** Account menu → Change password. */
export function ChangePasswordModal({ open, onClose }) {
  const [v, setV] = useState({ next: '', again: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await changeMyPassword(v.next, v.again);
      toast.success('Password changed', 'Use the new password next time you sign in');
      setV({ next: '', again: '' });
      onClose();
    } catch (e) {
      toast.error('Not changed', e.message);
    }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm" footer={<Button icon={busy ? Loader2 : KeyRound} disabled={busy} onClick={save}>Save new password</Button>}>
      <PasswordFields v={v} setV={setV} />
    </Modal>
  );
}

/** Shown after signing in with a temporary password: a new one must be chosen first. */
export function MustChangePassword() {
  const profile = useLive((s) => s.profile);
  const [v, setV] = useState({ next: '', again: '' });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await changeMyPassword(v.next, v.again);
      toast.success('Password saved', 'Welcome back!');
      await refresh();
    } catch (err) {
      toast.error('Not saved', err.message);
    }
    setBusy(false);
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-5 dark:bg-navy-950">
      <form onSubmit={save} className="card w-full max-w-md p-8">
        <Logo className="mb-8 justify-center" />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-700 dark:bg-gold-500/15 dark:text-gold-300"><KeyRound className="h-8 w-8" /></div>
        <h1 className="text-center font-display text-2xl font-semibold text-brand-900 dark:text-white">Choose a new password</h1>
        <p className="mb-6 mt-2 text-center text-sm text-slate-600 dark:text-slate-300">You signed in with a temporary password{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}. Pick your own password to continue.</p>
        <PasswordFields v={v} setV={setV} />
        <Button type="submit" size="lg" className="mt-6 w-full" icon={busy ? Loader2 : KeyRound} disabled={busy}>Save and continue</Button>
        <button type="button" onClick={() => leave()} className="mt-3 w-full text-center text-sm text-slate-500 hover:underline">Sign out</button>
      </form>
    </div>
  );
}

/** Owner / super admin: the temporary password to pass on. */
export function TempPasswordModal({ result, onClose }) {
  if (!result) return null;
  const text = `PoultryPro: your temporary password is ${result.code}. Sign in with your phone number (${result.phone}) and this password, then choose a new one.`;
  return (
    <Modal open onClose={onClose} title={`Temporary password for ${result.name}`} subtitle="Give it to them in person, by phone call or WhatsApp" size="sm" footer={<Button onClick={onClose}>Done</Button>}>
      <p className="rounded-2xl bg-brand-800 py-5 text-center font-display text-4xl font-semibold tracking-[.3em] text-white">{result.code}</p>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">They sign in with <b>{result.phone}</b> and this password, then the app asks them to choose a new password. They have been signed out on all their devices.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={Copy} onClick={() => navigator.clipboard?.writeText(result.code).then(() => toast.success('Copied'))}>Copy</Button>
        <Button size="sm" variant="secondary" icon={MessageSquare} onClick={async () => { const r = await sendSms(result.phone, text); return r.ok ? toast.success('SMS sent', result.phone) : toast.error('SMS not sent', r.error); }}>Send by SMS</Button>
        <a href={`https://wa.me/233${String(result.phone).replace(/^0/, '')}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary" icon={Share2}>Send on WhatsApp</Button></a>
      </div>
      <p className="mt-4 text-xs text-slate-400">This password is shown only now. If it is lost, reset the password again.</p>
    </Modal>
  );
}
