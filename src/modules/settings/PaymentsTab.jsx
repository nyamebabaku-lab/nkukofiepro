// Owner: where online payments are paid out (Paystack subaccount), the farm's area, and the marketplace switch.
import { useEffect, useState } from 'react';
import { Banknote, MapPin, Store, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, Button, Field, Input, Select, Segmented, Badge, toast } from '../../components/ui';
import { useSession } from '../../data/store';
import { supabase } from '../../data/supabase';
import { paystackBanks, setPayout } from '../../lib/paystack';
import { refresh } from '../live/useLive';
import { REGIONS } from '../../lib/ghana';
import { fmtDateTime } from '../../lib/format';

export default function PaymentsTab() {
  const biz = useSession((s) => s.profile?.business) || {};
  const [banks, setBanks] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [p, setP] = useState({ kind: 'momo', bankCode: '', account: '', accountName: '' });
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState({ region: biz.region || '', district: biz.district || '', location: biz.location || '' });

  useEffect(() => {
    paystackBanks().then(setBanks).catch((e) => setLoadErr(e.message));
  }, []);

  const list = banks ? (p.kind === 'momo' ? banks.momo : banks.banks) : [];
  const savePayout = async () => {
    const b = list.find((x) => x.code === p.bankCode);
    if (!b) return toast.error(p.kind === 'momo' ? 'Choose the MoMo network' : 'Choose the bank');
    setBusy(true);
    try {
      await setPayout({ ...p, bankName: b.name });
      await refresh();
      toast.success('Payout account saved', 'Online payments now go straight to this account.');
    } catch (e) {
      toast.error('Could not save', e.message);
    }
    setBusy(false);
    return null;
  };
  const saveArea = async () => {
    if (!area.region || !area.district.trim()) return toast.error('Choose the region and enter the district');
    const { error } = await supabase.rpc('set_business_area', { new_region: area.region, new_district: area.district.trim(), new_location: area.location });
    if (error) return toast.error('Could not save', error.message);
    await refresh();
    toast.success('Farm area saved');
    return null;
  };
  const setMarket = async (flag) => {
    const { error } = await supabase.rpc('set_business_market', { flag });
    if (error) return toast.error('Could not change', error.message);
    await refresh();
    toast.success(flag ? 'Your farm is on the marketplace' : 'Your farm is hidden from the marketplace');
    return null;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Where online payments go" subtitle="Customers pay by MoMo or card through Paystack; your share settles straight to this account" icon={Banknote} />
        <div className="space-y-4 p-5">
          {biz.payout ? (
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{biz.payout.bankName} · {biz.payout.account}</p>
                {biz.payout.accountName && <p>{biz.payout.accountName}</p>}
                <p className="text-xs opacity-75">Set {fmtDateTime(biz.payout.setAt)} · change it below</p>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Not set yet — customers can only pay cash or at pick-up until you add a payout account.</p>
          )}
          {loadErr ? (
            <p className="text-sm text-accent-700">{loadErr}</p>
          ) : !banks ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading networks and banks…</p>
          ) : (
            <>
              <Segmented options={[{ value: 'momo', label: 'Mobile Money' }, { value: 'bank', label: 'Bank account' }]} value={p.kind} onChange={(kind) => setP({ ...p, kind, bankCode: '' })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={p.kind === 'momo' ? 'Network' : 'Bank'}><Select placeholder="Choose…" value={p.bankCode} onChange={(e) => setP({ ...p, bankCode: e.target.value })} options={list.map((b) => ({ value: b.code, label: b.name }))} /></Field>
                <Field label={p.kind === 'momo' ? 'MoMo number' : 'Account number'}><Input inputMode="numeric" value={p.account} onChange={(e) => setP({ ...p, account: e.target.value })} placeholder={p.kind === 'momo' ? '024 123 4567' : ''} /></Field>
                <Field label="Name on the account" className="sm:col-span-2"><Input value={p.accountName} onChange={(e) => setP({ ...p, accountName: e.target.value })} /></Field>
              </div>
              <Button disabled={busy} icon={busy ? Loader2 : undefined} onClick={savePayout}>{biz.payout ? 'Change payout account' : 'Save payout account'}</Button>
            </>
          )}
          <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Paystack's processing fee and the platform fee are taken before settlement. Money usually arrives the next working day.</p>
        </div>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Farm area" subtitle="Buyers find you by region and district; disease alerts are sent by district" icon={MapPin} action={<Button size="sm" onClick={saveArea}>Save</Button>} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Region"><Select placeholder="Choose…" value={area.region} onChange={(e) => setArea({ ...area, region: e.target.value })} options={REGIONS} /></Field>
            <Field label="District"><Input value={area.district} onChange={(e) => setArea({ ...area, district: e.target.value })} placeholder="e.g. Shai-Osudoku" /></Field>
            <Field label="Town / landmark" className="sm:col-span-2"><Input value={area.location} onChange={(e) => setArea({ ...area, location: e.target.value })} placeholder="e.g. Dodowa, near the market" /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Marketplace" subtitle="Show your farm and listings to buyers across Ghana" icon={Store} action={<Badge tone={biz.market_enabled === false ? 'slate' : 'green'}>{biz.market_enabled === false ? 'Hidden' : 'Visible'}</Badge>} />
          <div className="flex items-center justify-between gap-4 p-5 text-sm">
            <p className="text-slate-600 dark:text-slate-300">Buyers see your farm name, area, phone and open listings. Bulk buyers' requests reach you in <b>Marketplace</b>.</p>
            <Button size="sm" variant={biz.market_enabled === false ? 'primary' : 'secondary'} onClick={() => setMarket(biz.market_enabled === false)}>{biz.market_enabled === false ? 'Show my farm' : 'Hide my farm'}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
