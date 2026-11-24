// Calls a Supabase Edge Function as the signed-in person and turns its error body into a readable message.
import { supabase } from '../data/supabase';

export async function callFn(name, body) {
  if (!supabase) throw new Error('Not connected to the online service');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await error.context?.json?.();
      if (j?.error) msg = j.error;
    } catch {
      /* keep the generic message */
    }
    if (/Failed to send a request|fetch/i.test(msg)) msg = 'No internet connection — try again when you are online';
    throw new Error(msg);
  }
  return data;
}
