// AI vet: photos + a description in English or Twi + the flock's own records → likely causes and what to do now.
// Live apps call the ai-vet Edge Function (Claude); the demo shows a worked example so it can be tried offline.
import { useMemo, useState } from 'react';
import { Camera, Stethoscope, Loader2, X, AlertTriangle, ShieldCheck, Phone, ListChecks, Pill, HelpCircle, Sparkles } from 'lucide-react';
import { useDB } from '../../data/store';
import { useInScope, useCurrentUser } from '../../data/selectors';
import { Card, CardHeader, Button, Field, Select, Segmented, Badge, EmptyState, toast, cx } from '../../components/ui';
import { LIVE } from '../../config';
import { activeFlocks, flockIndex } from '../../lib/flock';
import { callFn } from '../../lib/edge';
import { fmtDateTime, today } from '../../lib/format';
import { addDays, format } from 'date-fns';

const URGENCY = { low: ['Low', 'green'], medium: ['Watch closely', 'gold'], high: ['Act today', 'orange'], emergency: ['Emergency', 'red'] };

/** Shrinks a photo to ≤1024 px JPEG and returns base64 without the data: prefix. */
function photoB64(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function flockContext(db, f) {
  if (!f) return {};
  const s = flockIndex(db).get(f.id) || {};
  const since = format(addDays(new Date(), -7), 'yyyy-MM-dd');
  const dead = db.mortality.filter((m) => m.flockId === f.id && m.date >= since);
  const vac = db.vaccinations.filter((v) => v.flockId === f.id);
  return {
    id: f.id, farmId: f.farmId, code: f.code, species: f.species, purpose: f.purpose, breed: f.breed, ageDays: s.age, live: s.live,
    deaths7: s.dead7, mortality7Pct: s.live ? Math.round(((s.dead7 || 0) / (s.live + (s.dead7 || 0))) * 1000) / 10 : null,
    causes: [...new Set(dead.map((m) => m.cause).filter(Boolean))].join(', '),
    layPct: s.layPct7 || null, stdLayPct: s.stdLayPct || null,
    vaccines: vac.filter((v) => v.status === 'done').map((v) => `${v.name} (${v.doneAt})`).slice(-8).join('; '),
    overdue: vac.filter((v) => v.status === 'due' && v.dueDate < today()).map((v) => v.name).join(', '),
    treatments: db.treatments.filter((t) => t.flockId === f.id && t.date >= format(addDays(new Date(), -21), 'yyyy-MM-dd')).map((t) => `${t.drug} (${t.date})`).join('; '),
  };
}

const DEMO_RESULT = {
  summary: 'The greenish, watery droppings, twisted necks and sudden deaths in a flock whose Newcastle booster is overdue point first to Newcastle disease. Coccidiosis or fowl cholera are less likely but possible. Only a lab test confirms it.',
  urgency: 'emergency',
  conditions: [
    { name: 'Newcastle disease', likelihood: 'likely', why: 'Green watery droppings, twisted necks and quick deaths; the LaSota booster is overdue.' },
    { name: 'Fowl cholera', likelihood: 'possible', why: 'Sudden deaths and green droppings can also come from cholera in older birds.' },
    { name: 'Coccidiosis', likelihood: 'less likely', why: 'Usually bloody droppings in young birds on wet litter, not nervous signs.' },
  ],
  do_now: ['Close the house: no visitors, no birds in or out, footbath at the door.', 'Remove dead birds now; burn or bury them deep with lime.', 'Call the district veterinary officer today and report suspected Newcastle disease.', 'Give vitamins and electrolytes in clean water to support the flock.', 'Do not sell eggs or birds from this house until the vet clears it.'],
  treatment: ['There is no cure for Newcastle disease; the vet may advise emergency LaSota vaccination of healthy houses.', 'An antibiotic (e.g. oxytetracycline) only helps secondary infections — use it only on the vet\'s advice and respect the withdrawal period for eggs and meat.'],
  biosecurity: ['Change boots and clothes between houses; visit this house last.', 'Disinfect drinkers and feeders daily.', 'Keep wild birds and other poultry away.'],
  call_vet_if: ['More than 1% of the flock dies in a day.', 'Birds in other houses show the same signs.'],
  questions: ['How many birds died each day this week?', 'Have egg numbers dropped suddenly?', 'Are there swollen heads or blue combs?'],
  serious: true,
};

export default function AiVet() {
  const db = useDB();
  const user = useCurrentUser();
  const inScope = useInScope();
  const flocks = activeFlocks(db).filter((f) => inScope(f.farmId));
  const [flockId, setFlockId] = useState(flocks[0]?.id || '');
  const [lang, setLang] = useState('en');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const cases = useMemo(() => (db.vetCases || []).filter((c) => !c.farmId || inScope(c.farmId)).sort((a, b) => b.at.localeCompare(a.at)), [db.vetCases, inScope]);

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 3 - photos.length);
    e.target.value = '';
    const out = [];
    for (const f of files) out.push(await photoB64(f).catch(() => null));
    setPhotos((p) => [...p, ...out.filter(Boolean)].slice(0, 3));
  };

  const ask = async () => {
    if (!photos.length && text.trim().length < 5) return toast.error('Add a photo or describe what you see');
    setBusy(true);
    const f = db.flocks.find((x) => x.id === flockId);
    const flock = flockContext(db, f);
    try {
      let rec;
      if (LIVE) {
        const r = await callFn('ai-vet', { lang, text, flock, images: photos.map((p) => p.split(',')[1]) });
        rec = r.case;
        if (r.quota) toast.info('AI vet', `${r.quota.limit - r.quota.used} questions left this month`);
      } else {
        await new Promise((res) => setTimeout(res, 1800));
        rec = { id: `vet_demo_${Date.now()}`, at: new Date().toISOString(), by: user.id, byName: user.name, flockId: f?.id, farmId: f?.farmId, flockCode: f?.code, lang, text, photos: photos.length, result: DEMO_RESULT, top: DEMO_RESULT.conditions[0].name, serious: true, urgency: DEMO_RESULT.urgency, demo: true };
      }
      useDB.setState((s) => ({ vetCases: [rec, ...(s.vetCases || []).filter((c) => c.id !== rec.id)] }));
      setOpen(rec);
      setText('');
      setPhotos([]);
    } catch (e) {
      toast.error('The AI vet could not answer', e.message);
    }
    setBusy(false);
    return null;
  };

  const r = open?.result;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader title="Ask the AI vet" subtitle="Photos of sick birds, droppings or dead birds + what you see" icon={Stethoscope} />
        <div className="space-y-4 p-5">
          <Field label="Which flock?"><Select value={flockId} onChange={(e) => setFlockId(e.target.value)} options={[...flocks.map((f) => ({ value: f.id, label: `${f.code} · ${f.breed}` })), { value: '', label: 'Not a specific flock' }]} /></Field>
          <div>
            <span className="label">Photos (up to 3)</span>
            <div className="flex flex-wrap gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-cream-300">
                  <img src={p} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove photo"><X className="h-3 w-3" /></button>
                </div>
              ))}
              {photos.length < 3 && (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-cream-300 text-xs font-semibold text-slate-500 hover:border-brand-400 dark:border-white/15">
                  <Camera className="h-6 w-6" /> Add photo
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={addPhotos} />
                </label>
              )}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="label mb-0">What do you see?</span><Segmented options={[{ value: 'en', label: 'English' }, { value: 'tw', label: 'Twi' }]} value={lang} onChange={setLang} /></div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input min-h-[110px]" placeholder={lang === 'tw' ? 'Sɛ nkokɔ no te sɛn? Wɔn tiafi te sɛn? Ɛnnɛ, dodoɔ bɛn na awuwu?' : 'e.g. 12 birds died since yesterday, green watery droppings, some can\'t stand, they stopped eating'} />
          </div>
          <Button size="lg" className="w-full" icon={busy ? Loader2 : Sparkles} disabled={busy} onClick={ask}>{busy ? 'Looking at it…' : 'Get advice'}</Button>
          <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> The AI gives guidance, not a diagnosis. For many deaths or a suspected notifiable disease, call your vet or the district veterinary officer.{!LIVE && ' Demo: shows a worked example.'}</p>
        </div>
      </Card>

      <div className="space-y-4">
        {r ? (
          <Card className="overflow-hidden">
            <div className={cx('flex items-center justify-between gap-3 px-5 py-3 text-white', { low: 'bg-emerald-700', medium: 'bg-gold-600', high: 'bg-orange-600', emergency: 'bg-red-700' }[r.urgency])}>
              <p className="font-semibold">{open.flockCode ? `${open.flockCode} · ` : ''}{fmtDateTime(open.at)}</p>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{URGENCY[r.urgency]?.[0]}</span>
            </div>
            <div className="space-y-4 p-5 text-sm">
              {r.serious && <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 font-semibold text-red-800 dark:bg-red-500/10 dark:text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Possible fast-spreading disease. Isolate the house and call the district veterinary officer.</p>}
              <p className="text-base">{r.summary}</p>
              <div className="space-y-2">{r.conditions.map((c) => <div key={c.name} className="rounded-xl bg-cream-100 p-3 dark:bg-white/5"><p className="font-semibold">{c.name} <Badge tone={c.likelihood === 'likely' ? 'red' : c.likelihood === 'possible' ? 'gold' : 'slate'}>{c.likelihood}</Badge></p><p className="text-slate-600 dark:text-slate-300">{c.why}</p></div>)}</div>
              {[[ListChecks, 'Do now', r.do_now], [Pill, 'Treatment (confirm with a vet)', r.treatment], [ShieldCheck, 'Biosecurity', r.biosecurity], [Phone, 'Call the vet if', r.call_vet_if], [HelpCircle, 'To narrow it down', r.questions]].map(([I, t, list]) => list?.length ? (
                <div key={t}><p className="mb-1 flex items-center gap-2 font-semibold text-brand-900 dark:text-white"><I className="h-4 w-4" /> {t}</p><ul className="list-disc space-y-1 pl-6 text-slate-700 dark:text-slate-300">{list.map((x) => <li key={x}>{x}</li>)}</ul></div>
              ) : null)}
            </div>
          </Card>
        ) : (
          <Card><EmptyState icon={Stethoscope} title="Ask about a sick bird" text="Take clear photos in good light — the bird, its droppings, or inside a dead bird — and say what changed." /></Card>
        )}
        {cases.length > 0 && (
          <Card>
            <CardHeader title="Earlier questions" subtitle="Shared with your farm team" />
            <div className="divide-y divide-cream-200 px-5 pb-3 dark:divide-white/5">
              {cases.slice(0, 15).map((c) => (
                <button key={c.id} type="button" onClick={() => setOpen(c)} className="flex w-full items-center gap-3 py-3 text-left text-sm">
                  <Badge tone={URGENCY[c.urgency]?.[1] || 'slate'}>{URGENCY[c.urgency]?.[0] || '—'}</Badge>
                  <span className="min-w-0 flex-1"><b>{c.top || 'Assessment'}</b>{c.flockCode ? ` · ${c.flockCode}` : ''}<span className="block truncate text-xs text-slate-500">{c.text || `${c.photos} photo${c.photos === 1 ? '' : 's'}`} · {c.byName || ''} · {fmtDateTime(c.at)}</span></span>
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
