// Paystack payments for Nkukɔ Fie Pro. Money is split at payment time: the farm's share settles straight
// to the farm's own MoMo/bank (its Paystack subaccount); the platform fee (platform_settings.fee_pct) to the
// platform account. The platform never holds farmers' money.
//   POST {action:'banks'}                                → MoMo networks + banks Paystack can settle to
//   POST {action:'payout', kind, bankCode, bankName, account, accountName}   (farm owner) → creates/updates the subaccount
//   POST {action:'init', businessId, amount, purpose, purposeId, phone}      → checkout link
//   POST {action:'verify', reference}                    → status after the customer returns
//   POST ?hook=1 (Paystack webhook, signed)              → same bookkeeping as verify
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const SITE = Deno.env.get('APP_SITE') ?? 'https://nyamebabaku-lab.github.io/nkukofiepro/';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
type Rec = Record<string, any>;

async function ps(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.paystack.co${path}`, { ...init, headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.status === false) throw new Error(j.message || `Paystack error ${res.status}`);
  return j.data;
}

const pesewas = (ghs: number) => Math.round(ghs * 100);

async function hmac512(key: string, body: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Records a verified Paystack transaction once (verify and webhook can both arrive). */
async function settle(tx: Rec) {
  const ref = tx.reference;
  const status = tx.status === 'success' ? 'success' : tx.status === 'abandoned' ? 'abandoned' : tx.status === 'failed' ? 'failed' : 'pending';
  const { data: row } = await admin.from('paystack_tx').select('*').eq('reference', ref).maybeSingle();
  if (!row) return { status, amount: tx.amount / 100 };
  if (row.status !== 'success') {
    await admin.from('paystack_tx').update({ status, channel: tx.channel, paid_at: tx.paid_at || null, raw: { gateway: tx.gateway_response, channel: tx.channel, fees: tx.fees } }).eq('reference', ref);
    if (status === 'success' && row.purpose === 'market_order' && row.purpose_id) {
      const { data: o } = await admin.from('market_orders').select('deposit_paid, status').eq('id', row.purpose_id).maybeSingle();
      if (o) await admin.from('market_orders').update({ deposit_paid: (+o.deposit_paid || 0) + tx.amount / 100, paystack_ref: ref, status: o.status === 'new' ? 'confirmed' : o.status, updated_at: new Date().toISOString() }).eq('id', row.purpose_id);
    }
  }
  return { status, amount: tx.amount / 100, channel: tx.channel, purpose: row.purpose, purposeId: row.purpose_id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!SECRET) return json({ error: 'Online payments are not set up yet' }, 503);
  const url = new URL(req.url);

  // ---- Paystack webhook (no user session; trusted by signature)
  if (url.searchParams.get('hook')) {
    const raw = await req.text();
    if ((await hmac512(SECRET, raw)) !== req.headers.get('x-paystack-signature')) return json({ error: 'bad signature' }, 401);
    const ev = JSON.parse(raw);
    if (ev.event === 'charge.success') await settle(ev.data);
    return json({ ok: true });
  }

  try {
    const body: Rec = await req.json();
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: 'Please sign in again' }, 401);
    const uid = u.user.id;

    if (body.action === 'banks') {
      const [momo, banks] = await Promise.all([ps('/bank?currency=GHS&type=mobile_money'), ps('/bank?currency=GHS&type=ghipss')]);
      const pick = (l: Rec[], kind: string) => (l || []).filter((b) => b.active !== false).map((b) => ({ code: b.code, name: b.name, kind }));
      return json({ momo: pick(momo, 'momo'), banks: pick(banks, 'bank') });
    }

    if (body.action === 'payout') {
      const { data: me } = await admin.from('profiles').select('role, status, business_id, phone').eq('user_id', uid).maybeSingle();
      if (me?.role !== 'owner' || me.status !== 'active') return json({ error: 'Only the farm owner can set where money is paid' }, 403);
      const { data: biz } = await admin.from('businesses').select('id, name, paystack_subaccount').eq('id', me.business_id).maybeSingle();
      const account = String(body.account || '').replace(/\s/g, '');
      if (!body.bankCode || account.length < 9) return json({ error: 'Choose the network or bank and enter the number' }, 400);
      const payload = { business_name: biz!.name, settlement_bank: body.bankCode, account_number: account, percentage_charge: 0, primary_contact_phone: me.phone, description: `Nkukɔ Fie Pro farm ${biz!.id}` };
      const sub = biz!.paystack_subaccount
        ? await ps(`/subaccount/${biz!.paystack_subaccount}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await ps('/subaccount', { method: 'POST', body: JSON.stringify(payload) });
      const payout = { kind: body.kind, bankCode: body.bankCode, bankName: body.bankName, account: `${account.slice(0, 3)}••••${account.slice(-3)}`, accountName: sub.account_name || body.accountName || null, setAt: new Date().toISOString() };
      await admin.from('businesses').update({ paystack_subaccount: sub.subaccount_code, payout }).eq('id', biz!.id);
      return json({ ok: true, payout });
    }

    if (body.action === 'init') {
      const amount = Math.round((+body.amount || 0) * 100) / 100;
      if (!(amount >= 1)) return json({ error: 'Amount must be at least GH₵1' }, 400);
      const [{ data: biz }, { data: set }, { data: prof }] = await Promise.all([
        admin.from('businesses').select('id, name, status, paystack_subaccount').eq('id', body.businessId).maybeSingle(),
        admin.from('platform_settings').select('fee_pct').eq('id', 1).maybeSingle(),
        admin.from('profiles').select('phone, full_name').eq('user_id', uid).maybeSingle(),
      ]);
      if (!biz || biz.status !== 'active') return json({ error: 'This farm is not accepting payments' }, 400);
      if (!biz.paystack_subaccount) return json({ error: 'This farm has not set up online payments yet — pay at pick-up' }, 400);
      const fee = Math.round(amount * (+set?.fee_pct || 0)) / 100;
      const reference = `NF${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const email = u.user.email || `${(prof?.phone || 'buyer').replace(/\D/g, '')}@phone.nkukofie.app`;
      const data = await ps('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email, amount: pesewas(amount), currency: 'GHS', reference,
          subaccount: biz.paystack_subaccount, transaction_charge: pesewas(fee), bearer: 'subaccount',
          channels: ['mobile_money', 'card'],
          callback_url: `${SITE}paid/?ref=${reference}`,
          metadata: { businessId: biz.id, purpose: body.purpose, purposeId: body.purposeId || null, userId: uid, phone: body.phone || prof?.phone, custom_fields: [{ display_name: 'Farm', variable_name: 'farm', value: biz.name }] },
        }),
      });
      await admin.from('paystack_tx').insert({ reference, business_id: biz.id, user_id: uid, purpose: body.purpose || 'other', purpose_id: body.purposeId || null, amount, platform_fee: fee });
      return json({ url: data.authorization_url, reference, fee });
    }

    if (body.action === 'verify') {
      const { data: row } = await admin.from('paystack_tx').select('user_id, business_id').eq('reference', body.reference).maybeSingle();
      if (!row) return json({ error: 'Payment not found' }, 404);
      const tx = await ps(`/transaction/verify/${encodeURIComponent(body.reference)}`);
      return json(await settle(tx));
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
