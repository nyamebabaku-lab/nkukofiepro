// Wraps a live app: boots the account check, then shows sign-in, a status screen or the app routes.
import { useEffect } from 'react';
import { Toaster, toast } from '../../components/ui';
import { boot, useLive } from './useLive';
import LiveLogin from './LiveLogin';
import { MustChangePassword } from './Passwords';
import StatusScreen, { Splash } from './StatusScreen';

let booted = false;

export default function LiveRoot({ children }) {
  const phase = useLive((s) => s.phase);
  useEffect(() => {
    if (!booted) {
      booted = true;
      boot();
    }
    const denied = () => toast.error('Not allowed', 'Your account cannot change that. Ask the farm owner.');
    window.addEventListener('nkukofie-sync-denied', denied);
    return () => window.removeEventListener('nkukofie-sync-denied', denied);
  }, []);
  let body;
  if (phase === 'boot' || phase === 'loading') body = <Splash />;
  else if (phase === 'out') body = <LiveLogin />;
  else if (phase === 'in') body = children;
  else if (phase === 'changePassword') body = <MustChangePassword />;
  else body = <StatusScreen />;
  return (
    <>
      {body}
      {phase !== 'in' && <Toaster />}
    </>
  );
}
