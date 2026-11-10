import { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Banknote, Landmark, Smartphone, Loader2, CheckCircle2, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';
import { useDB } from '../../data/store';
import { PageHeader, Button, Card, CardHeader, StatCard, DataTable, Badge, Modal, Field, Input, Select, Segmented, toast, cx } from '../../components/ui';
import { TrendChart } from '../../components/charts';
import { walletSummary, withdraw, bankCash, destinationLabel } from '../../lib/wallet';
import { payout, methodLabel, BANKS } from '../../lib/payments';
import { money, moneyShort, fmtDateTime, lastDays, round2 } from '../../lib/format';
import { appName } from '../../lib/brand';

const TYPE = { payment: ['Customer payment', 'green'], refund: ['Refund', 'red'], 'cash-deposit': ['Cash banked', 'sky'], withdrawal: ['Withdrawal', 'gold'], payroll: ['Salaries', 'violet'], expense: ['Expense', 'slate'] };

function WithdrawModal({ open, onClose, balance }) {
  const db = useDB();
  const [v, setV] = useState({ type: 'momo', network: 'mtn', number: '0244000111', bank: BANKS[0], account: '', amount: '', pin: '' });
  const [stage, setStage] = useState('form');
  const [err, setErr] = useState('');
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const close = () => {
    setStage('form');
    setErr('');
    setV((s) => ({ ...s, amount: '', pin: '' }));
    onClose();
  };
  const go = async () => {
    setErr('');
    const amount = round2(+v.amount);
    const dest = v.type === 'momo' ? { type: 'momo', network: v.network, number: v.number } : { type: 'bank', bank: v.bank, number: v.account };
    if (!(amount > 0)) return setErr('Enter an amount');
    if (amount > balance) return setErr(`Only ${money(balance)} available`);
    if (String(v.pin) !== String(db.settings.withdrawalPin)) return setErr('Wrong wallet PIN (demo PIN: 1234)');
    if (!dest.number) return setErr('Enter the account / MoMo number');
    setStage('wait');
    const r = await payout({ method: dest.type === 'bank' ? 'bank' : dest.network, account: dest.number });
    if (!r.ok) {
      setStage('form');
      return setErr(r.error);
    }
    try {
      withdraw(amount, dest, v.pin, r.ref);
      setStage('done');
    } catch (e) {
      setStage('form');
      setErr(e.message);
    }
    return null;
  };
  return (
    <Modal open={open} onClose={stage === 'wait' ? () => {} : close} title="Withdraw from wallet" subtitle={`Available ${money(balance)}`} size="md">
      {stage === 'done' ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 animate-pop text-emerald-500" />
          <p className="mt-3 font-display text-2xl font-semibold">{money(v.amount)} sent</p>
          <p className="text-sm text-slate-500">to {v.type === 'momo' ? `${methodLabel(v.network)} ${v.number}` : `${v.bank} ${v.account}`}</p>
          <Button className="mt-6" onClick={close}>Done</Button>
        </div>
      ) : stage === 'wait' ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-600" /><p className="mt-3 font-semibold">Sending money…</p></div>
      ) : (
        <div className="space-y-4">
          <Segmented className="w-full [&>button]:flex-1" options={[{ value: 'momo', label: 'Mobile Money' }, { value: 'bank', label: 'Bank account' }]} value={v.type} onChange={(x) => set('type', x)} />
          {v.type === 'momo' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Network"><Select value={v.network} onChange={(e) => set('network', e.target.value)} options={[{ value: 'mtn', label: 'MTN MoMo' }, { value: 'telecel', label: 'Telecel Cash' }, { value: 'at', label: 'AT Money' }]} /></Field>
              <Field label="Number"><Input inputMode="tel" value={v.number} onChange={(e) => set('number', e.target.value)} /></Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank"><Select value={v.bank} onChange={(e) => set('bank', e.target.value)} options={BANKS} /></Field>
              <Field label="Account number"><Input inputMode="numeric" value={v.account} onChange={(e) => set('account', e.target.value)} /></Field>
            </div>
          )}
          <Field label="Amount (GH₵)"><Input inputMode="decimal" className="text-lg font-bold" value={v.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
          <div className="-mt-2 flex gap-2">{[0.25, 0.5, 1].map((k) => <button key={k} type="button" className="rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold dark:bg-white/10" onClick={() => set('amount', Math.floor(balance * k))}>{k === 1 ? 'All' : `${k * 100}%`}</button>)}</div>
          <Field label="Wallet PIN" hint="Demo PIN: 1234 — change it in Settings"><Input type="password" inputMode="numeric" maxLength={6} value={v.pin} onChange={(e) => set('pin', e.target.value)} /></Field>
          {err && <p className="rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">{err}</p>}
          <Button size="lg" className="w-full" icon={ArrowUpRight} onClick={go}>Withdraw</Button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Demo payout — real transfers come with Paystack in phase 2.</p>
        </div>
      )}
    </Modal>
  );
}

export default function Wallet() {
  const db = useDB();
  const [wd, setWd] = useState(false);
  const [bank, setBank] = useState(false);
  const [cashAmt, setCashAmt] = useState('');
  const w = walletSummary(db);
  const tx = [...db.walletTx].sort((a, b) => b.at.localeCompare(a.at));
  const series = useMemo(() => {
    const days = lastDays(30);
    const sorted = [...db.walletTx].filter((t) => t.status === 'success').sort((a, b) => a.at.localeCompare(b.at));
    let bal = 0;
    let i = 0;
    return days.map((d) => {
      while (i < sorted.length && sorted[i].at.slice(0, 10) <= d) bal += sorted[i++].amount;
      return { day: `${d.slice(8)}/${d.slice(5, 7)}`, balance: Math.round(bal) };
    });
  }, [db.walletTx]);

  return (
    <div>
      <PageHeader title="Wallet" subtitle="Online payments land here. Withdraw to MoMo or your bank any time." />
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="grain hero-glow relative overflow-hidden rounded-3xl bg-brand-800 p-6 text-white shadow-lift">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-gold-300"><WalletIcon className="h-4 w-4" /> Available balance</p>
          <p className="mt-3 font-display text-5xl font-semibold tracking-tight">{money(w.balance)}</p>
          <p className="mt-1 text-sm text-brand-100/80">{db.settings.businessName} · {appName()} wallet</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button className="bg-gold-500 text-brand-950 hover:bg-gold-400" icon={ArrowUpRight} onClick={() => setWd(true)}>Withdraw</Button>
            <Button variant="secondary" className="bg-white/10 text-white ring-white/20 hover:bg-white/20" icon={Banknote} onClick={() => setBank(true)}>Bank cash ({moneyShort(w.cashOnHand)})</Button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10"><p className="text-xs text-brand-100/70">In this month</p><p className="mt-1 font-bold">{moneyShort(w.inMonth)}</p></div>
            <div className="rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10"><p className="text-xs text-brand-100/70">Out this month</p><p className="mt-1 font-bold">{moneyShort(w.outMonth)}</p></div>
            <div className="rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10"><p className="text-xs text-brand-100/70">Withdrawn</p><p className="mt-1 font-bold">{moneyShort(w.withdrawnMonth)}</p></div>
          </div>
        </div>
        <Card>
          <CardHeader title="Balance — last 30 days" />
          <div className="px-3 pb-4"><TrendChart data={series} series={[{ key: 'balance', name: 'Balance', area: true }]} fmt={(v) => money(v)} yFmt={(v) => moneyShort(v).replace('GH₵ ', '')} height={250} /></div>
        </Card>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Cash on hand" value={money(w.cashOnHand)} icon={Banknote} tone="green" sub="cash taken, not yet banked" />
        <StatCard label="MoMo received (30d)" value={moneyShort(db.payments.filter((p) => ['mtn', 'telecel', 'at'].includes(p.method) && p.status === 'success' && p.at >= new Date(Date.now() - 30 * 864e5).toISOString()).reduce((a, p) => a + p.amount, 0))} icon={Smartphone} tone="gold" />
        <StatCard label="Card received (30d)" value={moneyShort(db.payments.filter((p) => p.method === 'card' && p.status === 'success' && p.at >= new Date(Date.now() - 30 * 864e5).toISOString()).reduce((a, p) => a + p.amount, 0))} icon={ArrowDownLeft} tone="sky" />
        <StatCard label="Withdrawals" value={db.walletTx.filter((t) => t.type === 'withdrawal').length} icon={Landmark} tone="brand" sub="all time" />
      </div>
      <DataTable
        rows={tx}
        pageSize={15}
        searchText={(t) => `${t.note} ${t.ref}`}
        columns={[
          { key: 'at', label: 'Date', render: (t) => fmtDateTime(t.at) },
          { key: 'type', label: 'Type', render: (t) => <Badge tone={TYPE[t.type]?.[1]}>{TYPE[t.type]?.[0] || t.type}</Badge> },
          { key: 'note', label: 'Details', render: (t) => <span>{t.destination ? destinationLabel(t.destination) : t.note}{t.method ? <span className="text-slate-400"> · {methodLabel(t.method)}</span> : ''}</span>, className: 'whitespace-normal' },
          { key: 'ref', label: 'Ref', hideOnMobile: true },
          { key: 'amount', label: 'Amount', render: (t) => <b className={cx(t.amount < 0 ? 'text-accent-600' : 'text-emerald-700 dark:text-emerald-400')}>{t.amount > 0 ? '+' : ''}{money(t.amount)}</b> },
        ]}
      />
      <WithdrawModal open={wd} onClose={() => setWd(false)} balance={w.balance} />
      <Modal open={bank} onClose={() => setBank(false)} title="Bank cash into the wallet" subtitle={`Cash on hand: ${money(w.cashOnHand)}`} size="sm" footer={<Button onClick={() => { try { bankCash(+cashAmt); toast.success('Cash banked', money(+cashAmt)); setBank(false); setCashAmt(''); } catch (e) { toast.error(e.message); } }}>Save</Button>}>
        <Field label="Amount banked (GH₵)" hint="Use this after depositing the farm's cash"><Input inputMode="decimal" value={cashAmt} onChange={(e) => setCashAmt(e.target.value)} /></Field>
        <button type="button" className="mt-2 text-xs font-semibold text-brand-700 dark:text-gold-400" onClick={() => setCashAmt(String(Math.floor(w.cashOnHand)))}>Use all cash on hand</button>
      </Modal>
    </div>
  );
}
