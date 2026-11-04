// One payment window for everything: MoMo, card or cash, with a simulated phone prompt.
import { useEffect, useState } from 'react';
import { Smartphone, CreditCard, Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { Modal, Button, Field, Input, cx } from './ui';
import PayLogo from './PayLogo';
import { METHODS, charge } from '../lib/payments';
import { money, round2 } from '../lib/format';

export default function PayModal({ open, onClose, title = 'Payment', subtitle, amount, min = 0.01, max, editable = true, methods = ['mtn', 'telecel', 'at', 'card', 'cash'], phone = '', onPaid, presets = [] }) {
  const [method, setMethod] = useState(methods[0]);
  const [account, setAccount] = useState(phone);
  const [card, setCard] = useState({ number: '', exp: '', cvv: '' });
  const [amt, setAmt] = useState(amount);
  const [stage, setStage] = useState('form');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setMethod(methods[0]);
      setAccount(phone);
      setAmt(amount);
      setStage('form');
      setError('');
      setCard({ number: '', exp: '', cvv: '' });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = METHODS.find((x) => x.id === method);
  const value = round2(+amt || 0);
  const invalid = value < min - 0.001 || (max != null && value > max + 0.001);

  const pay = async () => {
    setError('');
    if (invalid) return setError(max != null ? `Enter between ${money(min)} and ${money(max)}` : `Enter at least ${money(min)}`);
    if (m.kind === 'momo' && !/^0\d{9}$/.test(account.replace(/\s/g, ''))) return setError('Enter a 10-digit MoMo number');
    if (m.kind === 'card' && card.number.replace(/\s/g, '').length < 12) return setError('Enter the card number');
    setStage('wait');
    const acct = m.kind === 'card' ? card.number.replace(/\s/g, '') : account.replace(/\s/g, '');
    const r = await charge({ method, account: acct });
    if (!r.ok) {
      setStage('form');
      return setError(r.error);
    }
    setStage('done');
    onPaid?.({ method, account: m.kind === 'card' ? `**** ${acct.slice(-4)}` : acct, amount: value });
    return null;
  };

  return (
    <Modal open={open} onClose={stage === 'wait' ? () => {} : onClose} title={title} subtitle={subtitle} size="md">
      {stage === 'done' ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-4 flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15"><CheckCircle2 className="h-9 w-9" /></div>
          <p className="font-display text-2xl font-semibold text-brand-900 dark:text-white">{money(value)} {method === 'cash' ? 'recorded' : 'paid'}</p>
          <p className="mt-1 text-sm text-slate-500">{m.label}{method !== 'cash' ? ' · receipt sent by SMS' : ''}</p>
          <Button className="mt-6" onClick={onClose}>Done</Button>
        </div>
      ) : stage === 'wait' ? (
        <div className="flex flex-col items-center py-10 text-center">
          <div className="relative mb-5">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold-400/40" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gold-500 text-brand-950">{m.kind === 'card' ? <CreditCard className="h-7 w-7" /> : <Smartphone className="h-7 w-7" />}</span>
          </div>
          <p className="font-semibold text-slate-900 dark:text-white">{m.kind === 'card' ? 'Confirming with your bank…' : `Approve the prompt on ${account}`}</p>
          <p className="mt-1 text-sm text-slate-500">{m.kind === 'card' ? 'This takes a few seconds' : 'Enter your MoMo PIN on your phone to confirm'}</p>
          <Loader2 className="mt-5 h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {METHODS.filter((x) => methods.includes(x.id)).map((x) => (
              <button key={x.id} type="button" onClick={() => setMethod(x.id)} className={cx('flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-xs font-semibold transition', method === x.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-500/10' : 'border-cream-200 hover:border-brand-300 dark:border-white/10')}>
                <PayLogo method={x.id} />
                <span className="text-center leading-tight text-slate-700 dark:text-slate-200">{x.label.replace(' / Mastercard', '')}</span>
              </button>
            ))}
          </div>
          <Field label="Amount" hint={max != null ? `Up to ${money(max)}${min > 0.01 ? ` · at least ${money(min)}` : ''}` : undefined}>
            <Input inputMode="decimal" value={amt} disabled={!editable} onChange={(e) => setAmt(e.target.value)} className="text-lg font-bold" />
          </Field>
          {editable && presets.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button key={p.label} type="button" onClick={() => setAmt(p.value)} className="rounded-full bg-cream-200 px-3 py-1.5 text-xs font-semibold text-brand-800 dark:bg-white/10 dark:text-white">{p.label} · {money(p.value)}</button>
              ))}
            </div>
          )}
          {m.kind === 'momo' && <Field label="MoMo number"><Input inputMode="tel" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="024 123 4567" /></Field>}
          {m.kind === 'card' && (
            <div className="grid grid-cols-6 gap-3">
              <Field label="Card number" className="col-span-6"><Input inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="4242 4242 4242 4242" /></Field>
              <Field label="Expiry" className="col-span-3"><Input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} placeholder="MM/YY" /></Field>
              <Field label="CVV" className="col-span-3"><Input inputMode="numeric" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value })} placeholder="123" /></Field>
            </div>
          )}
          {m.kind === 'cash' && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">Cash is recorded now and counted in “cash on hand” until it is banked.</p>}
          {error && <p className="flex items-center gap-2 rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300"><XCircle className="h-4 w-4 shrink-0" /> {error}</p>}
          <Button size="lg" className="w-full" onClick={pay}>{method === 'cash' ? `Record ${money(value)} cash` : `Pay ${money(value)}`}</Button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Demo payments — no real money moves. A number ending in 000 or a card ending in 0002 is declined.</p>
        </div>
      )}
    </Modal>
  );
}
