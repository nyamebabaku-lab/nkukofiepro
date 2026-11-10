// Nkukɔ Fie Pro SMS via mNotify. The API key stays here on the server (Supabase secrets), never in the apps.
// The caller must be a signed-in, active account; customers may only text their own phone number.
// Every message is logged in public.sms_log and each farm business has a daily limit.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const KEY = Deno.env.get('MNOTIFY_API_KEY') ?? '';
const SENDER = Deno.env.get('MNOTIFY_SENDER_ID') ?? '';
const DAILY_LIMIT = Number(Deno.env.get('MNOTIFY_DAILY_LIMIT') ?? '300');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** 0241234567 / +233241234567 → 0241234567, or null. */
function normPhone(p: string): string | null {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('233')) d = `0${d.slice(3)}`;
  if (d.length === 9) d = `0${d}`;
  return /^0\d{9}$/.test(d) ? d : null;
}

async function mnotify(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.mnotify.com/api/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(KEY)}`, init);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text.slice(0, 200) };
  }
  return { ok: res.ok, json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return reply('ok');
  if (!KEY || !SENDER) return reply({ ok: false, error: 'SMS is not set up yet (missing mNotify API key or sender ID)' }, 503);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(jwt);
  if (!auth?.user) return reply({ ok: false, error: 'Sign in first' }, 401);
  const { data: me } = await admin.from('profiles').select('user_id, role, status, phone, business_id, businesses(status, phone)').eq('user_id', auth.user.id).maybeSingle();
  if (!me || me.status !== 'active') return reply({ ok: false, error: 'Account not active' }, 403);
  const biz = me.businesses as { status: string; phone: string } | null;
  if (me.role !== 'super_admin' && biz?.status !== 'active') return reply({ ok: false, error: 'Farm business not active' }, 403);

  let body: { action?: string; to?: string | string[]; message?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: 'Bad request' }, 400);
  }

  // Super admin: mNotify balance for the Platform page.
  if (body.action === 'balance') {
    if (me.role !== 'super_admin') return reply({ ok: false, error: 'Not allowed' }, 403);
    const r = await mnotify('balance/sms');
    return reply({ ok: r.ok, balance: r.json.balance ?? null, bonus: r.json.bonus ?? null, raw: r.json });
  }

  // Plain letters keep each SMS in the cheap GSM encoding (ɔ/ɛ would make mNotify charge double).
  const message = String(body.message ?? '').replace(/ɔ/g, 'o').replace(/Ɔ/g, 'O').replace(/ɛ/g, 'e').replace(/Ɛ/g, 'E').trim().slice(0, 459);
  const recipients = [...new Set((Array.isArray(body.to) ? body.to : [body.to ?? '']).map(normPhone).filter(Boolean) as string[])].slice(0, 50);
  if (!message || !recipients.length) return reply({ ok: false, error: 'Phone number and message are required' }, 400);
  // Customers can only send receipts/notices to themselves (stops anyone using the farm's SMS credit).
  if (me.role === 'customer' && recipients.some((r) => r !== normPhone(me.phone))) return reply({ ok: false, error: 'Not allowed' }, 403);

  if (me.business_id) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await admin.from('sms_log').select('id', { count: 'exact', head: true }).eq('business_id', me.business_id).gte('at', since).eq('status', 'sent');
    if ((count ?? 0) + recipients.length > DAILY_LIMIT) return reply({ ok: false, error: `Daily SMS limit of ${DAILY_LIMIT} reached` }, 429);
  }

  const r = await mnotify('sms/quick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ recipient: recipients, sender: SENDER, message, is_schedule: false, schedule_date: '' }),
  });
  const sent = r.ok && (r.json.status === 'success' || String(r.json.code) === '2000');
  const error = sent ? null : String(r.json.message ?? 'mNotify did not accept the message');
  await admin.from('sms_log').insert(recipients.map((to) => ({ business_id: me.business_id, sent_by: me.user_id, to_phone: to, message, status: sent ? 'sent' : 'failed', error })));
  return reply({ ok: sent, error, recipients: recipients.length }, sent ? 200 : 502);
});
