// AI farm vet on FREE AI services: photos + a description (English or Twi) + the flock's own records →
// a structured, practical assessment. Providers are tried in order (platform_settings.ai_model, e.g.
// "gemini,groq"); if one is busy or out of today's free allowance, the next one answers.
//   • gemini — Google AI Studio free key (GEMINI_API_KEY), best with photos and Twi
//   • groq   — Groq free key (GROQ_API_KEY), Llama 4 Scout vision model
// Every case is saved to the farm's records (col "vetCases") so the team sees it and the disease
// watch (detect_outbreaks) can use serious findings. Monthly quota per farm protects the free allowances.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const GEMINI_MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-flash-latest,gemini-flash-lite-latest').split(',');
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
type Rec = Record<string, any>;

const SHAPE = `Reply with ONLY a JSON object, no other text, in exactly this shape:
{"summary": "2-3 plain sentences: what is most likely going on",
 "urgency": "low" | "medium" | "high" | "emergency",
 "conditions": [{"name": "...", "likelihood": "likely" | "possible" | "less likely", "why": "one sentence"}],
 "do_now": ["concrete steps for today, most important first"],
 "treatment": ["options common in Ghana, to confirm with a vet, with withdrawal periods for eggs and meat"],
 "biosecurity": ["..."],
 "call_vet_if": ["..."],
 "questions": ["what the farmer could check or tell you to narrow it down"],
 "serious": true if a notifiable or fast-spreading disease (Newcastle disease, avian influenza, Gumboro outbreak, fowl cholera) is likely or possible, else false}
Give 1-4 conditions and keep every list item to one short sentence.`;

const SYSTEM = `You are an experienced poultry veterinarian advising farmers in Ghana through the Nkukɔ Fie Pro app.
You get photos (birds, droppings, carcasses, the house), the farmer's description, and the flock's own records.
Give practical, safe guidance a farm worker can act on today. Base it on the evidence; say what you cannot tell from a photo.
Use products, vaccines and practices common in Ghana. Never recommend banned antibiotics; always mention drug withdrawal periods for eggs and meat.
If avian influenza or Newcastle disease is possible, say so clearly, advise isolating the house, stopping bird movement and calling the district veterinary officer (Veterinary Services Directorate).
Do not give a definitive diagnosis: a vet or lab confirms.
${SHAPE}`;

class Busy extends Error {}

function parseResult(text: string): Rec {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  const r = JSON.parse(m ? m[0] : text);
  if (!r.summary || !Array.isArray(r.conditions)) throw new Error('incomplete answer');
  const list = (x: unknown) => (Array.isArray(x) ? x.map(String).filter(Boolean).slice(0, 8) : []);
  return {
    summary: String(r.summary),
    urgency: ['low', 'medium', 'high', 'emergency'].includes(r.urgency) ? r.urgency : 'medium',
    conditions: r.conditions.slice(0, 4).map((c: Rec) => ({ name: String(c.name || 'Unknown'), likelihood: ['likely', 'possible', 'less likely'].includes(c.likelihood) ? c.likelihood : 'possible', why: String(c.why || '') })),
    do_now: list(r.do_now), treatment: list(r.treatment), biosecurity: list(r.biosecurity), call_vet_if: list(r.call_vet_if), questions: list(r.questions),
    serious: r.serious === true || r.serious === 'true',
  };
}

async function askGemini(prompt: string, images: string[]) {
  if (!GEMINI_KEY) throw new Busy('no key');
  let last: unknown;
  for (const model of GEMINI_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } })), { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 3000 },
      }),
    });
    if (res.status === 429 || res.status >= 500) { last = new Busy(`gemini ${model} ${res.status}`); continue; }
    const j = await res.json();
    if (!res.ok) { last = new Error(j.error?.message || `gemini ${res.status}`); continue; }
    const text = j.candidates?.[0]?.content?.parts?.map((p: Rec) => p.text || '').join('') || '';
    try { return { result: parseResult(text), by: model }; } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Busy('gemini unavailable');
}

async function askGroq(prompt: string, images: string[]) {
  if (!GROQ_KEY) throw new Busy('no key');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: [{ type: 'text', text: prompt }, ...images.map((d) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${d}` } }))] },
      ],
    }),
  });
  if (res.status === 429 || res.status >= 500) throw new Busy(`groq ${res.status}`);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `groq ${res.status}`);
  return { result: parseResult(j.choices?.[0]?.message?.content || ''), by: GROQ_MODEL };
}

const PROVIDERS: Record<string, (p: string, i: string[]) => Promise<{ result: Rec; by: string }>> = { gemini: askGemini, groq: askGroq };
const month = () => new Date().toISOString().slice(0, 7);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: 'Please sign in again' }, 401);
    const { data: me } = await admin.from('profiles').select('role, status, business_id, full_name').eq('user_id', u.user.id).maybeSingle();
    if (!me || me.status !== 'active' || !['owner', 'manager', 'worker'].includes(me.role)) return json({ error: 'Only farm staff can use the AI vet' }, 403);

    const [{ data: ps }, { data: biz }, { data: use }] = await Promise.all([
      admin.from('platform_settings').select('ai_enabled, ai_free_monthly, ai_premium_monthly, ai_model').eq('id', 1).maybeSingle(),
      admin.from('businesses').select('id, name, premium, status, region, district').eq('id', me.business_id).maybeSingle(),
      admin.from('ai_usage').select('used').eq('business_id', me.business_id).eq('month', month()).maybeSingle(),
    ]);
    if (!ps?.ai_enabled) return json({ error: 'The AI vet is switched off for now' }, 403);
    if (!biz || biz.status !== 'active') return json({ error: 'Farm not active' }, 403);
    const limit = biz.premium ? ps.ai_premium_monthly : ps.ai_free_monthly;
    const used = use?.used ?? 0;
    if (used >= limit) return json({ error: `This month's ${limit} AI vet questions are used up${biz.premium ? '' : ' — premium farms get more'}.`, quota: { used, limit } }, 429);

    const body: Rec = await req.json();
    const lang = body.lang === 'tw' ? 'tw' : 'en';
    const images: string[] = (body.images || []).slice(0, 3).filter((s: string) => typeof s === 'string' && s.length < 2_500_000);
    const text = String(body.text || '').slice(0, 2000);
    if (!images.length && text.trim().length < 5) return json({ error: 'Add a photo or describe what you see' }, 400);
    const ctx: Rec = body.flock || {};

    const facts = [
      ctx.code && `Flock ${ctx.code}: ${ctx.species || 'chicken'} (${ctx.purpose || ''}), breed ${ctx.breed || 'unknown'}, age ${ctx.ageDays ?? '?'} days, ${ctx.live ?? '?'} birds alive.`,
      ctx.deaths7 != null && `Deaths in the last 7 days: ${ctx.deaths7} (${ctx.mortality7Pct ?? '?'}% of the flock). Causes recorded: ${ctx.causes || 'none'}.`,
      ctx.layPct != null && `Laying rate (7 days): ${ctx.layPct}% (breed standard ${ctx.stdLayPct ?? '?'}%).`,
      ctx.vaccines && `Vaccinations given: ${ctx.vaccines}. Overdue: ${ctx.overdue || 'none'}.`,
      ctx.treatments && `Recent treatments: ${ctx.treatments}.`,
      biz.district || biz.region ? `Farm area: ${[biz.district, biz.region].filter(Boolean).join(', ')}, Ghana.` : 'Farm in Ghana.',
    ].filter(Boolean).join('\n');
    const prompt = `Flock records:\n${facts}\n\nWhat the farmer says:\n${text || '(no description — judge from the photos)'}\n\n${images.length ? `${images.length} photo(s) attached.` : 'No photos.'}\n${lang === 'tw'
      ? 'The farmer wrote in Twi. Write the text of every field in simple Twi (Asante Twi), using English only for drug and vaccine names. Keep the JSON keys and the urgency/likelihood values in English.'
      : 'Write in simple English.'}`;

    const order = String(ps.ai_model || 'gemini,groq').split(',').map((s: string) => s.trim().toLowerCase()).filter((p: string) => PROVIDERS[p]);
    let answer: { result: Rec; by: string } | null = null;
    const tried: string[] = [];
    for (const p of order.length ? order : ['gemini', 'groq']) {
      try {
        answer = await PROVIDERS[p](prompt, images);
        break;
      } catch (e) {
        tried.push(`${p}: ${(e as Error).message}`);
      }
    }
    if (!answer) {
      console.error('ai-vet: all providers failed', tried);
      return json({ error: tried.every((t) => /no key/.test(t)) ? 'The AI vet is not set up yet.' : 'The free AI vet is busy right now — please try again in a few minutes.' }, 503);
    }
    const result = answer.result;

    await admin.from('ai_usage').upsert({ business_id: biz.id, month: month(), used: used + 1 }, { onConflict: 'business_id,month' });
    const id = `vet_${crypto.randomUUID().slice(0, 8)}`;
    const at = new Date().toISOString();
    const top = result.conditions[0]?.name || null;
    const record = { id, at, by: u.user.id, byName: me.full_name, flockId: ctx.id || null, farmId: ctx.farmId || null, flockCode: ctx.code || null, lang, text, photos: images.length, result, top, serious: !!result.serious, urgency: result.urgency, model: answer.by };
    await admin.from('records').insert({ business_id: biz.id, col: 'vetCases', id, data: record });
    if (result.serious || result.urgency === 'emergency') {
      const nid = `ntf_${id}`;
      await admin.from('records').insert({ business_id: biz.id, col: 'notifications', id: nid, data: { id: nid, at, read: false, toRoles: ['owner', 'manager'], tone: 'red', title: `AI vet: ${top || 'serious problem'}${ctx.code ? ` · ${ctx.code}` : ''}`, text: result.summary, link: '/app/health?tab=vet' } });
    }
    return json({ ok: true, case: record, quota: { used: used + 1, limit } });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
