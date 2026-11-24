// Super admin: platform fee & Paystack, AI vet quotas, premium farms, and marketplace buyers to verify.
import { useCallback, useEffect, useState } from 'react';
import { Percent, Sparkles, BadgeCheck, Crown, Save, Copy } from 'lucide-react';
import { Card, CardHeader, Button, Field, Input, Badge, DataTable, toast } from '../../components/ui';
import { supabase } from '../../data/supabase';
import { listBuyers, verifyBuyer, buyerLabel } from '../../lib/market';
import { fmtDateTime } from '../../lib/format';

const fnUrl = (name) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;

export default function MarketAdmin({ businesses, onChanged }) {
  const [s, setS] = useState(null);
  const [buyers, setBuyers] = useState([]);
  const [usage, setUsage] = useState([]);
  const month = new Date().toISOString().slice(0, 7);

  const load = useCallback(async () => {
    const [{ data: ps }, b, { data: u }] = await Promise.all([
      supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
      listBuyers().catch(() => []),
      supabase.from('ai_usage').select('*').eq('month', month),
    ]);
    setS(ps);
    setBuyers(b);
    setUsage(u || []);
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const { error } = await supabase.rpc('set_platform_money', { fee: +s.fee_pct || 0, live: !!s.payments_live, ai_on: !!s.ai_enabled, ai_free: +s.ai_free_monthly || 0, ai_premium: +s.ai_premium_monthly || 0, model: s.ai_model || null });
    if (error) return toast.error('Not saved', error.message);
    toast.success('Saved');
    return load();
  };
  const premium = async (b, flag) => {
    const { error } = await supabase.rpc('set_business_premium', { bid: b.id, flag });
    if (error) return toast.error('Not changed', error.message);
    toast.success(flag ? `${b.name} is premium` : `${b.name} is on the free plan`);
    return onChanged?.();
  };
  const verify = async (b, ok) => {
    try {
      await verifyBuyer(b.user_id, ok);
      toast.success(ok ? `${b.org_name || b.full_name} approved` : 'Approval removed');
      load();
    } catch (e) {
      toast.error('Not changed', e.message);
    }
  };
  if (!s) return <Card className="p-6 text-sm text-slate-500">Loading…</Card>;
  const set = (k, v) => setS({ ...s, [k]: v });
  const waiting = buyers.filter((b) => !b.verified && b.buyer_type !== 'household');
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast.success('Copied'));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Payments (Paystack)" subtitle="Money is split at payment: the farm's share to the farm, your fee to you" icon={Percent} action={<Button size="sm" icon={Save} onClick={save}>Save</Button>} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Platform fee on online payments (%)" hint="0 = free. Paystack's own fee is paid by the farm."><Input inputMode="decimal" value={s.fee_pct} onChange={(e) => set('fee_pct', e.target.value)} /></Field>
            <Field label="Mode"><label className="flex items-center gap-2 pt-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!!s.payments_live} onChange={(e) => set('payments_live', e.target.checked)} /> Live keys in use (real money)</label></Field>
            <div className="sm:col-span-2 rounded-xl bg-cream-100 p-3 text-xs dark:bg-white/5">
              <p className="font-semibold">Paystack webhook URL (Settings → API Keys & Webhooks):</p>
              <button type="button" onClick={() => copy(`${fnUrl('pay')}?hook=1`)} className="mt-1 flex items-center gap-1 break-all text-left font-mono text-brand-700 dark:text-brand-300"><Copy className="h-3 w-3 shrink-0" />{fnUrl('pay')}?hook=1</button>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="AI vet" subtitle={`${usage.reduce((a, u) => a + u.used, 0)} questions asked this month`} icon={Sparkles} action={<Button size="sm" icon={Save} onClick={save}>Save</Button>} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Switched on"><label className="flex items-center gap-2 pt-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!!s.ai_enabled} onChange={(e) => set('ai_enabled', e.target.checked)} /> Farms can use the AI vet</label></Field>
            <Field label="Free AI services (in order)" hint="gemini = Google AI Studio, groq = Groq. If one is busy, the next answers."><Input value={s.ai_model || ''} onChange={(e) => set('ai_model', e.target.value)} placeholder="gemini,groq" /></Field>
            <Field label="Free questions per farm per month"><Input inputMode="numeric" value={s.ai_free_monthly} onChange={(e) => set('ai_free_monthly', e.target.value)} /></Field>
            <Field label="Premium farms per month"><Input inputMode="numeric" value={s.ai_premium_monthly} onChange={(e) => set('ai_premium_monthly', e.target.value)} /></Field>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Buyers waiting for approval" subtitle="Traders get wholesale prices; bulk and government buyers can post requests to farms" icon={BadgeCheck} />
        <div className="p-4">
          <DataTable
            rows={[...waiting, ...buyers.filter((b) => !waiting.includes(b))]}
            searchText={(b) => `${b.full_name} ${b.org_name} ${b.phone} ${b.district}`}
            columns={[
              { key: 'who', label: 'Buyer', render: (b) => <div><p className="font-semibold">{b.org_name || b.full_name}</p><p className="text-xs text-slate-500">{b.full_name} · {b.phone}</p></div> },
              { key: 'type', label: 'Type', render: (b) => buyerLabel(b.buyer_type) },
              { key: 'area', label: 'Area', render: (b) => [b.district, b.region].filter(Boolean).join(', '), hideOnMobile: true },
              { key: 'at', label: 'Joined', render: (b) => fmtDateTime(b.created_at), hideOnMobile: true },
              { key: 'st', label: 'Status', render: (b) => (b.verified ? <Badge tone="green">Approved</Badge> : b.buyer_type === 'household' ? <Badge tone="slate">Household</Badge> : <Badge tone="gold">Waiting</Badge>) },
              { key: 'act', label: '', render: (b) => (b.buyer_type === 'household' ? null : b.verified ? <Button size="sm" variant="ghost" onClick={() => verify(b, false)}>Remove approval</Button> : <Button size="sm" onClick={() => verify(b, true)}>Approve</Button>) },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Premium farms" subtitle="More AI vet questions and premium features" icon={Crown} />
        <div className="p-4">
          <DataTable
            rows={businesses.filter((b) => b.status === 'active')}
            searchText={(b) => `${b.name} ${b.location}`}
            columns={[
              { key: 'name', label: 'Farm', render: (b) => <div><p className="font-semibold">{b.name}</p><p className="text-xs text-slate-500">{[b.district, b.region].filter(Boolean).join(', ') || b.location}</p></div> },
              { key: 'pay', label: 'Online payments', render: (b) => (b.paystack_subaccount ? <Badge tone="green">{b.payout?.bankName || 'Set'}</Badge> : <Badge tone="slate">Not set</Badge>) },
              { key: 'ai', label: 'AI this month', render: (b) => usage.find((u) => u.business_id === b.id)?.used || 0 },
              { key: 'plan', label: 'Plan', render: (b) => (b.premium ? <Badge tone="gold">Premium</Badge> : 'Free') },
              { key: 'act', label: '', render: (b) => <Button size="sm" variant={b.premium ? 'ghost' : 'secondary'} onClick={() => premium(b, !b.premium)}>{b.premium ? 'Make free' : 'Make premium'}</Button> },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
