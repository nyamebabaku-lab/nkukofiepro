// Simulated checkout. Phase 2 replaces `charge` with Paystack / Hubtel; everything else stays.

export const METHODS = [
  { id: 'mtn', label: 'MTN MoMo', short: 'MTN', color: 'bg-yellow-400 text-slate-900', kind: 'momo' },
  { id: 'telecel', label: 'Telecel Cash', short: 'Telecel', color: 'bg-red-600 text-white', kind: 'momo' },
  { id: 'at', label: 'AT Money', short: 'AT', color: 'bg-blue-700 text-white', kind: 'momo' },
  { id: 'card', label: 'Visa / Mastercard', short: 'Card', color: 'bg-slate-900 text-white', kind: 'card' },
  { id: 'cash', label: 'Cash', short: 'Cash', color: 'bg-emerald-600 text-white', kind: 'cash' },
];
export const ONLINE = ['mtn', 'telecel', 'at', 'card'];
export const methodLabel = (id) => METHODS.find((m) => m.id === id)?.label || id;
export const isOnline = (method) => ONLINE.includes(method);

/**
 * Pretends to send a payment prompt and waits for approval.
 * Demo rule: a phone number ending in 000 or a card ending in 0002 is declined.
 */
export function charge({ method, account }) {
  return new Promise((resolve) => {
    if (method === 'cash') return resolve({ ok: true });
    setTimeout(() => {
      const digits = String(account).replace(/\D/g, '');
      const declined = method === 'card' ? digits.endsWith('0002') : digits.endsWith('000');
      resolve(declined ? { ok: false, error: method === 'card' ? 'Card declined by issuer' : 'Payment prompt was declined or timed out' } : { ok: true });
    }, 2000);
  });
}

/** Same simulation for sending money out (withdrawals, payroll). */
export function payout({ method, account }) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const digits = String(account).replace(/\D/g, '');
      resolve(method !== 'bank' && digits.endsWith('000') ? { ok: false, error: 'Recipient wallet could not be reached' } : { ok: true, ref: `TRX${Math.floor(10000000 + Math.random() * 90000000)}` });
    }, 1800);
  });
}

export const newRef = (p = 'PAY') => `${p}${Math.floor(100000 + Math.random() * 900000)}`;

export const BANKS = ['GCB Bank', 'Ecobank Ghana', 'Absa Bank Ghana', 'Stanbic Bank', 'Fidelity Bank', 'CalBank', 'Zenith Bank', 'Agricultural Development Bank', 'Access Bank', 'Republic Bank'];
