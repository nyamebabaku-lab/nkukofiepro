// Super admin: death spikes by district (from the daily scan) and serious AI vet findings. Nothing is sent
// until the admin reviews it: "Send alert" notifies every farm in that district and shares it with partner links.
import { useCallback, useEffect, useState } from 'react';
import { Activity, Send, XCircle, Link2, Plus, Copy, RefreshCw, MapPin } from 'lucide-react';
import { Card, CardHeader, Button, Badge, EmptyState, Modal, Field, Input, Segmented, toast, confirmDialog } from '../../components/ui';
import { supabase } from '../../data/supabase';
import { SITE } from '../../config';
import { fmtDate, fmtDateTime, num } from '../../lib/format';

const msgFor = (s) => `Unusual bird deaths reported in ${s.district}${s.suspected ? ` (suspected: ${s.suspected})` : ''}. Tighten biosecurity now: no visitors, footbaths at every house, keep wild birds out, check vaccinations are up to date, and report sick birds to your vet or the district veterinary officer.`;

export default function DiseaseWatch() {
  const [signals, setSignals] = useState([]);
  const [partners, setPartners] = useState([]);
  const [filter, setFilter] = useState('new');
  const [sending, setSending] = useState(null);
  const [msg, setMsg] = useState('');
  const [newPartner, setNewPartner] = useState('');

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('outbreak_signals').select('*').order('detected_on', { ascending: false }).limit(200),
      supabase.from('outbreak_partners').select('*').order('created_at', { ascending: false }),
    ]);
    setSignals(s || []);
    setPartners(p || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const scan = async () => {
    const { data, error } = await supabase.rpc('run_outbreak_scan');
    if (error) return toast.error('Scan failed', error.message);
    toast.success('Scan finished', `${data} district${data === 1 ? '' : 's'} flagged`);
    return load();
  };
  const send = async () => {
    const { data, error } = await supabase.rpc('send_outbreak_alert', { signal: sending.id, msg });
    if (error) return toast.error('Not sent', error.message);
    toast.success('Alert sent', `${data} farm${data === 1 ? '' : 's'} in ${sending.district} notified`);
    setSending(null);
    return load();
  };
  const dismiss = async (s) => {
    if (!(await confirmDialog(`Dismiss ${s.district}?`, 'No one is notified.', { danger: false, confirmLabel: 'Dismiss' }))) return;
    await supabase.rpc('dismiss_outbreak', { signal: s.id });
    load();
  };
  const addPartner = async () => {
    if (!newPartner.trim()) return;
    const { error } = await supabase.from('outbreak_partners').insert({ name: newPartner.trim() });
    if (error) return toast.error('Not added', error.message);
    setNewPartner('');
    return load();
  };
  const togglePartner = async (p) => {
    await supabase.from('outbreak_partners').update({ active: !p.active }).eq('token', p.token);
    load();
  };
  const link = (p) => `${SITE}watch/?t=${p.token}`;
  const shown = signals.filter((s) => filter === 'all' || s.status === filter);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card>
        <CardHeader title="Disease watch" subtitle="Death spikes by district (scanned daily at 05:00) · you decide what is sent" icon={Activity} action={<Button size="sm" variant="secondary" icon={RefreshCw} onClick={scan}>Scan now</Button>} />
        <div className="px-5"><Segmented options={[{ value: 'new', label: `To review (${signals.filter((s) => s.status === 'new').length})` }, { value: 'sent', label: 'Sent' }, { value: 'dismissed', label: 'Dismissed' }, { value: 'all', label: 'All' }]} value={filter} onChange={setFilter} /></div>
        <div className="space-y-3 p-5">
          {!shown.length && <EmptyState icon={Activity} title="Nothing here" text="When deaths on farms in a district jump well above normal, it shows here for review." />}
          {shown.map((s) => (
            <div key={s.id} className="rounded-2xl border border-cream-200 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 font-bold"><MapPin className="h-4 w-4 text-accent-600" /> {s.district}{s.region ? `, ${s.region}` : ''}</p>
                  <p className="text-sm text-slate-500">{fmtDate(s.detected_on)} · {s.farms} farm{s.farms === 1 ? '' : 's'} · {num(s.birds_dead)} deaths in 3 days{s.rate_pct ? ` (${s.rate_pct}% of birds)` : ''}</p>
                  {s.suspected && <p className="mt-1 text-sm"><b>AI vet findings:</b> {s.suspected}</p>}
                </div>
                <Badge tone={s.status === 'new' ? 'red' : s.status === 'sent' ? 'green' : 'slate'}>{s.status === 'new' ? 'Review' : s.status}</Badge>
              </div>
              {s.status === 'sent' && <p className="mt-2 rounded-xl bg-cream-100 p-2 text-xs dark:bg-white/5">Sent {fmtDateTime(s.sent_at)}: {s.message}</p>}
              {s.status === 'new' && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon={Send} onClick={() => { setSending(s); setMsg(msgFor(s)); }}>Review & send</Button>
                  <Button size="sm" variant="ghost" icon={XCircle} onClick={() => dismiss(s)}>Dismiss</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Vets & authorities" subtitle="Read-only links showing alerts you have sent (no farm names)" icon={Link2} />
        <div className="space-y-3 p-5">
          <div className="flex gap-2"><Input value={newPartner} onChange={(e) => setNewPartner(e.target.value)} placeholder="e.g. VSD Greater Accra" /><Button icon={Plus} onClick={addPartner}>Add</Button></div>
          {partners.map((p) => (
            <div key={p.token} className="rounded-xl border border-cream-200 p-3 text-sm dark:border-white/10">
              <div className="flex items-center justify-between gap-2"><b>{p.name}</b><Button size="sm" variant="ghost" onClick={() => togglePartner(p)}>{p.active ? 'Turn off' : 'Turn on'}</Button></div>
              <button type="button" onClick={() => navigator.clipboard?.writeText(link(p)).then(() => toast.success('Link copied'))} className="mt-1 flex items-center gap-1 break-all text-left font-mono text-xs text-brand-700 dark:text-brand-300"><Copy className="h-3 w-3 shrink-0" />{link(p)}</button>
              {!p.active && <Badge tone="slate">Off</Badge>}
            </div>
          ))}
        </div>
      </Card>
      <Modal open={!!sending} onClose={() => setSending(null)} title={`Send alert · ${sending?.district}`} subtitle="Every farm in this district gets it in the app; partner links show it too" size="md" footer={<Button icon={Send} onClick={send}>Send alert</Button>}>
        <Field label="Message to farms"><textarea className="input min-h-[140px]" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
