// Real payments through Paystack (live apps). The farm's share settles straight to the farm's MoMo/bank.
import { callFn } from './edge';

export const paystackBanks = () => callFn('pay', { action: 'banks' });
export const setPayout = (p) => callFn('pay', { action: 'payout', ...p });

/** Opens Paystack's secure page (MoMo prompt or card) in the browser and returns the reference. */
export async function startCheckout({ businessId, amount, purpose = 'order', purposeId, phone }) {
  const r = await callFn('pay', { action: 'init', businessId, amount, purpose, purposeId, phone });
  openCheckout(r.url);
  return r;
}
export const openCheckout = (url) => window.open(url, '_blank', 'noopener');

export const verifyPayment = (reference) => callFn('pay', { action: 'verify', reference });

/** Checks every few seconds until the payment succeeds, fails, or `stop()` is called. */
export function watchPayment(reference, onDone, { every = 4000, maxMs = 10 * 60 * 1000 } = {}) {
  let stopped = false;
  const started = Date.now();
  const tick = async () => {
    if (stopped) return;
    try {
      const r = await verifyPayment(reference);
      if (r.status === 'success' || r.status === 'failed') {
        stopped = true;
        onDone(r);
        return;
      }
    } catch {
      /* not finished yet, or offline for a moment */
    }
    if (Date.now() - started > maxMs) {
      stopped = true;
      onDone({ status: 'timeout' });
      return;
    }
    setTimeout(tick, every);
  };
  setTimeout(tick, every);
  return () => {
    stopped = true;
  };
}
