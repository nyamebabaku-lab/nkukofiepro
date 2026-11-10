// Real SMS through the send-sms Edge Function (mNotify). The API key lives on the server only.
import { supabase, supabaseReady } from '../data/supabase';
import { smsSafe } from './brand';

/** Sends one SMS (or the same SMS to several numbers). Resolves { ok, error }. Never throws. */
export async function sendSms(to, message) {
  if (!supabaseReady) return { ok: false, error: 'SMS works in the live apps only' };
  try {
    // Plain letters keep each SMS in the cheap GSM encoding (ɔ/ɛ would double the cost).
    const { data, error } = await supabase.functions.invoke('send-sms', { body: { to, message: smsSafe(message) } });
    if (error) {
      let detail = error.message;
      try {
        detail = (await error.context?.json())?.error || detail;
      } catch {
        /* keep the generic message */
      }
      return { ok: false, error: detail };
    }
    return { ok: !!data?.ok, error: data?.error || null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Super admin: mNotify credit left. */
export async function smsBalance() {
  const { data, error } = await supabase.functions.invoke('send-sms', { body: { action: 'balance' } });
  if (error) throw new Error(error.message);
  return data;
}

/** Owner / super admin: messages sent through mNotify (newest first). */
export async function smsHistory(businessId) {
  let q = supabase.from('sms_log').select('*').order('at', { ascending: false }).limit(200);
  if (businessId) q = q.eq('business_id', businessId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
