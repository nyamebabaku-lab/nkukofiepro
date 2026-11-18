// Nkukɔ Fie Pro server reminders, run every 15 minutes by pg_cron (see migration 20261118000000_reminders.sql).
//  • Urgent task missed (not ticked `graceMin` after its time) → SMS to managers & owner.
//  • Vaccinations due today not done by `vaccineCheck` → SMS to managers & owner.
//  • Morning plan and evening report → SMS to the owner (and managers if chosen).
// Each message is sent once per day (public.reminder_log) and each business has a daily cap.
// Times are Ghana time (GMT = UTC).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const KEY = Deno.env.get('MNOTIFY_API_KEY') ?? '';
const SENDER = Deno.env.get('MNOTIFY_SENDER_ID') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Rec = Record<string, any>;
const DEFAULTS = { smsUrgent: true, graceMin: 60, vaccineCheck: '14:00', morning: '06:30', evening: '19:00', toManagers: false, maxSmsDay: 20 };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const safe = (s: string) => s.replace(/ɔ/g, 'o').replace(/Ɔ/g, 'O').replace(/ɛ/g, 'e').replace(/Ɛ/g, 'E').replace(/[^\x20-\x7E\n₵]/g, '').replace(/₵/g, 'C');
const normPhone = (p: string) => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('233')) d = `0${d.slice(3)}`; if (d.length === 9) d = `0${d}`; return /^0\d{9}$/.test(d) ? d : null; };
const mins = (hhmm: string) => { const [h, m] = String(hhmm || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : NaN; };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

function runsToday(t: Rec, date: string, flocks: Map<string, Rec>) {
  if (!t.active) return false;
  if (t.flockId) {
    const f = flocks.get(t.flockId);
    if (!f || (f.status !== 'active' && t.repeat !== 'once')) return false;
    if (t.fromDay != null || t.toDay != null) {
      const age = daysBetween(f.hatchDate, date);
      if ((t.fromDay != null && age < t.fromDay) || (t.toDay != null && age > t.toDay)) return false;
    }
  }
  if (t.repeat === 'once') return t.date === date;
  if (t.repeat === 'weekly') return (t.days || []).includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  return true;
}

async function send(businessId: string, to: string[], message: string) {
  const text = safe(message).slice(0, 459);
  const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(KEY)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ recipient: to, sender: SENDER, message: text, is_schedule: false, schedule_date: '' }),
  });
  let j: Rec = {}; try { j = await res.json(); } catch { /* ignore */ }
  const ok = res.ok && (j.status === 'success' || String(j.code) === '2000');
  await admin.from('sms_log').insert(to.map((p) => ({ business_id: businessId, sent_by: null, to_phone: p, message: text, status: ok ? 'sent' : 'failed', error: ok ? null : String(j.message ?? 'mNotify error') })));
  return ok;
}

async function processBusiness(b: Rec, now: Date, dry: boolean) {
  const date = now.toISOString().slice(0, 10);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const q = (cols: string[]) => admin.from('records').select('col,id,data').eq('business_id', b.id).in('col', cols);
  const qDay = (col: string, field = 'date') => admin.from('records').select('data').eq('business_id', b.id).eq('col', col).filter(`data->>${field}`, 'eq', date);
  const [{ data: base }, { data: runs }, { data: eggs }, { data: deaths }, { data: feed }, { data: vacc }, { data: people }, { data: log }] = await Promise.all([
    q(['tasks', 'flocks', 'settings']), qDay('taskRuns'), qDay('eggLogs'), qDay('mortality'), qDay('feedLogs'),
    admin.from('records').select('data').eq('business_id', b.id).eq('col', 'vaccinations').filter('data->>dueDate', 'lte', date).filter('data->>status', 'eq', 'due'),
    admin.from('profiles').select('role, phone, status').eq('business_id', b.id).eq('status', 'active').in('role', ['owner', 'manager']),
    admin.from('reminder_log').select('key').eq('business_id', b.id).eq('day', date),
  ]);
  const settings = (base || []).find((r: Rec) => r.col === 'settings')?.data || {};
  const R = { ...DEFAULTS, ...(settings.reminders || {}) };
  const flocks = new Map<string, Rec>((base || []).filter((r: Rec) => r.col === 'flocks').map((r: Rec) => [r.id, r.data]));
  const tasks = (base || []).filter((r: Rec) => r.col === 'tasks').map((r: Rec) => ({ id: r.id, ...r.data })).filter((t: Rec) => runsToday(t, date, flocks));
  const doneIds = new Set((runs || []).map((r: Rec) => r.data.taskId));
  const sentKeys = new Set((log || []).map((r: Rec) => r.key));
  const owners = [...new Set((people || []).filter((p: Rec) => p.role === 'owner').map((p: Rec) => normPhone(p.phone)).filter(Boolean))] as string[];
  const managers = [...new Set((people || []).filter((p: Rec) => p.role === 'manager').map((p: Rec) => normPhone(p.phone)).filter(Boolean))] as string[];
  const urgentTo = [...new Set([...managers, ...owners])];
  const summaryTo = R.toManagers ? urgentTo : owners;
  const name = settings.businessName || b.name || 'your farm';
  const out: { key: string[]; to: string[]; msg: string }[] = [];
  const code = (t: Rec) => flocks.get(t.flockId)?.code;

  // 1. urgent tasks missed
  if (R.smsUrgent) {
    const missed = tasks.filter((t: Rec) => t.important && !doneIds.has(t.id) && nowMin >= mins(t.time) + (+R.graceMin || 60) && !sentKeys.has(`task:${t.id}`));
    if (missed.length) out.push({ key: missed.map((t: Rec) => `task:${t.id}`), to: urgentTo, msg: `Nkuko Fie Pro (${name}): ${missed.length} urgent task${missed.length > 1 ? 's' : ''} not done: ${missed.slice(0, 4).map((t: Rec) => `${t.time} ${String(t.title).replace(/ · .*$/, '')}${code(t) ? ` (${code(t)})` : ''}`).join('; ')}${missed.length > 4 ? ` +${missed.length - 4} more` : ''}.` });
  }
  // 2. vaccinations not done
  const vToday = (vacc || []).map((r: Rec) => r.data).filter((v: Rec) => v.dueDate === date && flocks.get(v.flockId)?.status === 'active');
  if (vToday.length && nowMin >= mins(R.vaccineCheck) && !sentKeys.has('vaccines')) {
    out.push({ key: ['vaccines'], to: urgentTo, msg: `Nkuko Fie Pro (${name}): vaccination due today not yet done: ${vToday.slice(0, 4).map((v: Rec) => `${v.name} for ${flocks.get(v.flockId)?.code}`).join('; ')}. Please give it today.` });
  }
  // 3. morning plan (sent only within 3 hours of the set time)
  const mm = mins(R.morning);
  if (Number.isFinite(mm) && nowMin >= mm && nowMin < mm + 180 && !sentKeys.has('morning')) {
    const urgent = tasks.filter((t: Rec) => t.important).length;
    const overdueV = (vacc || []).map((r: Rec) => r.data).filter((v: Rec) => v.dueDate < date && flocks.get(v.flockId)?.status === 'active').length;
    const changes = tasks.filter((t: Rec) => t.repeat === 'once' && t.category === 'feeding').map((t: Rec) => `${code(t)}: ${String(t.title).replace(/ · .*$/, '').slice(0, 60)}`);
    out.push({ key: ['morning'], to: summaryTo, msg: `Good morning from Nkuko Fie Pro (${name}). Today: ${tasks.length} tasks (${urgent} urgent). Vaccines: ${vToday.length ? vToday.map((v: Rec) => `${v.name} ${flocks.get(v.flockId)?.code}`).join(', ') : 'none'}${overdueV ? `, ${overdueV} overdue` : ''}.${changes.length ? ` Feed change: ${changes.slice(0, 2).join('; ')}.` : ''}` });
  }
  // 4. evening report
  const em = mins(R.evening);
  if (Number.isFinite(em) && nowMin >= em && nowMin < em + 180 && !sentKeys.has('evening')) {
    const done = tasks.filter((t: Rec) => doneIds.has(t.id)).length;
    const good = (eggs || []).reduce((a: number, r: Rec) => { const e = r.data; return a + (e.small || 0) + (e.medium || 0) + (e.large || 0) + (e.jumbo || 0); }, 0);
    const dead = (deaths || []).reduce((a: number, r: Rec) => a + (r.data.dead || 0), 0);
    const kg = (feed || []).reduce((a: number, r: Rec) => a + (r.data.kg || 0), 0);
    out.push({ key: ['evening'], to: summaryTo, msg: `Nkuko Fie Pro (${name}) today: tasks ${done}/${tasks.length} done${tasks.length - done ? ` (${tasks.length - done} missed)` : ''}. Eggs ${fmt(good)} (${fmt(good / 30)} crates). Deaths ${dead}. Feed ${fmt(kg)} kg. Vaccines due today: ${vToday.length ? `${vToday.length} not done` : 'all done'}.` });
  }

  // daily cap
  const { count } = await admin.from('reminder_log').select('key', { count: 'exact', head: true }).eq('business_id', b.id).eq('day', date).eq('sms', true);
  let budget = (+R.maxSmsDay || 20) - (count ?? 0);
  const results = [];
  for (const m of out) {
    const to = m.to.filter(Boolean);
    let ok = false;
    if (to.length && budget >= to.length && KEY && SENDER && !dry) { ok = await send(b.id, to, m.msg); budget -= to.length; }
    if (!dry) await admin.from('reminder_log').upsert(m.key.map((k) => ({ business_id: b.id, day: date, key: k, sms: ok })), { onConflict: 'business_id,day,key', ignoreDuplicates: true });
    results.push({ keys: m.key, to: to.length, sent: ok, msg: m.msg });
  }
  return results;
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ ok: false, error: 'Not allowed' }, 401);
  let body: Rec = {};
  try { body = await req.json(); } catch { /* empty */ }
  const now = body.at ? new Date(body.at) : new Date();
  const dry = !!body.dry;
  // Test businesses (fake phone numbers) are skipped unless asked for explicitly.
  let qb = admin.from('businesses').select('id, name, status, is_test').eq('status', 'active');
  if (!body.includeTest) qb = qb.eq('is_test', false);
  if (body.businessId) qb = qb.eq('id', body.businessId);
  const { data: list } = await qb;
  const report: Rec = {};
  for (const b of list || []) {
    try { report[b.name] = await processBusiness(b, now, dry); } catch (e) { report[b.name] = { error: String(e) }; }
  }
  return json({ ok: true, at: now.toISOString(), dry, report });
});
