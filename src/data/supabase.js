// Supabase client for the live apps. The anon key is public by design; row-level security guards the data.
import { createClient } from '@supabase/supabase-js';
import { LIVE, storeKey } from '../config';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(LIVE && url && key);
export const supabase = supabaseReady
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: storeKey('poultrypro-auth') }, realtime: { params: { eventsPerSecond: 20 } } })
  : null;

/** 024 123 4567 / +233 24 123 4567 → 0241234567, or null if it isn't a Ghana mobile number. */
export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('233')) d = `0${d.slice(3)}`;
  if (d.length === 9) d = `0${d}`;
  return /^0\d{9}$/.test(d) ? d : null;
}

// Supabase logins are email-based; each phone number maps to a private address (no SMS needed).
export const phoneEmail = (phone) => `233${normPhone(phone).slice(1)}@phone.poultrypro.app`;

/** Friendlier wording for common Supabase errors. */
export function errorText(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Wrong phone number or password';
  if (/already registered|already been registered/i.test(m)) return 'That phone number already has an account — sign in instead';
  if (/Password should be at least/i.test(m)) return 'Password must be at least 6 characters';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No internet connection — try again when you are online';
  return m;
}
