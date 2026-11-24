// AI farm vet: photos + a description (English or Twi) + the flock's own records → a structured,
// practical assessment. Every case is saved to the farm's records (col "vetCases") so the team sees it
// and the disease watch (detect_outbreaks) can use serious findings.
// Quota: platform_settings.ai_free_monthly per farm (ai_premium_monthly for premium farms).
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
type Rec = Record<string, any>;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'urgency', 'conditions', 'do_now', 'treatment', 'biosecurity', 'call_vet_if', 'questions', 'serious'],
  properties: {
    summary: { type: 'string', description: 'Two or three plain sentences: what is most likely going on.' },
    urgency: { type: 'string', enum: ['low', 'medium', 'high', 'emergency'] },
    conditions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['name', 'likelihood', 'why'],
        properties: { name: { type: 'string' }, likelihood: { type: 'string', enum: ['likely', 'possible', 'less likely'] }, why: { type: 'string' } },
      },
    },
    do_now: { type: 'array', items: { type: 'string' }, description: 'Concrete steps for today, most important first.' },
    treatment: { type: 'array', items: { type: 'string' }, description: 'Treatment options common in Ghana, with the note to confirm with a vet and respect withdrawal periods.' },
    biosecurity: { type: 'array', items: { type: 'string' } },
    call_vet_if: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' }, description: 'What the farmer could check or tell you to narrow it down.' },
    serious: { type: 'boolean', description: 'True if a notifiable or fast-spreading disease (e.g. Newcastle disease, avian influenza, Gumboro outbreak, fowl cholera) is likely or possible.' },
  },
};

const SYSTEM = `You are an experienced poultry veterinarian advising farmers in Ghana through the Nkukɔ Fie Pro app.
You get photos (birds, droppings, carcasses, the house), the farmer's description, and the flock's own records.
Give practical, safe guidance a farm worker can act on today. Base it on the evidence; say what you cannot tell from a photo.
Use products, vaccines and practices common in Ghana. Never recommend banned antibiotics; always mention drug withdrawal periods for eggs and meat.
If avian influenza or Newcastle disease is possible, say so clearly, advise isolating the house, stopping bird movement and calling the district veterinary officer (Veterinary Services Directorate).
Do not give a definitive diagnosis: a vet or lab confirms. Keep each list item to one short sentence.`;

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
      ctx.feedChange && `Feed: ${ctx.feedChange}.`,
      ctx.vaccines && `Vaccinations given: ${ctx.vaccines}. Overdue: ${ctx.overdue || 'none'}.`,
      ctx.treatments && `Recent treatments: ${ctx.treatments}.`,
      ctx.house && `House: ${ctx.house}.`,
      biz.district || biz.region ? `Farm area: ${[biz.district, biz.region].filter(Boolean).join(', ')}, Ghana.` : 'Farm in Ghana.',
    ].filter(Boolean).join('\n');

    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...images.map((data) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data } })),
      {
        type: 'text',
        text: `Flock records:\n${facts}\n\nWhat the farmer says:\n${text || '(no description — judge from the photos)'}\n\n${lang === 'tw'
          ? 'The farmer wrote in Twi. Write every field of your answer in simple Twi (Asante Twi), using English only for drug and vaccine names.'
          : 'Answer in simple English.'}`,
      },
    ];

    const response = await client.beta.messages.create({
      model: ps.ai_model || 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    } as any);

    if (response.stop_reason === 'refusal') return json({ error: 'The AI vet could not answer this one. Please call your vet.' }, 422);
    const block = response.content.find((b: Rec) => b.type === 'text') as Rec | undefined;
    let result: Rec;
    try {
      result = JSON.parse(block?.text || '');
    } catch {
      return json({ error: 'The answer was incomplete — please try again.' }, 502);
    }

    await admin.from('ai_usage').upsert({ business_id: biz.id, month: month(), used: used + 1 }, { onConflict: 'business_id,month' });
    const id = `vet_${crypto.randomUUID().slice(0, 8)}`;
    const at = new Date().toISOString();
    const top = (result.conditions || [])[0]?.name || null;
    const record = { id, at, by: u.user.id, byName: me.full_name, flockId: ctx.id || null, farmId: ctx.farmId || null, flockCode: ctx.code || null, lang, text, photos: images.length, result, top, serious: !!result.serious, urgency: result.urgency };
    await admin.from('records').insert({ business_id: biz.id, col: 'vetCases', id, data: record });
    if (result.serious || result.urgency === 'emergency') {
      const nid = `ntf_${id}`;
      await admin.from('records').insert({ business_id: biz.id, col: 'notifications', id: nid, data: { id: nid, at, read: false, toRoles: ['owner', 'manager'], tone: 'red', title: `AI vet: ${top || 'serious problem'}${ctx.code ? ` · ${ctx.code}` : ''}`, text: result.summary, link: '/app/health?tab=vet' } });
    }
    return json({ ok: true, case: record, quota: { used: used + 1, limit } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The AI vet is busy — try again in a minute.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error (${e.status})` }, 502);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
