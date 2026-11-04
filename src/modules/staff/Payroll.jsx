import { useMemo, useState } from 'react';
import { format, parseISO, addMonths } from 'date-fns';
import { Banknote, Send, HandCoins, Plus, FileText, Printer, Loader2 } from 'lucide-react';
import { useDB } from '../../data/store';
import { PageHeader, Button, Card, CardHeader, StatCard, DataTable, Badge, FormModal, Modal, Segmented, confirmDialog, toast, printElement } from '../../components/ui';
import Logo from '../../components/layout/Logo';
import { draftPayrun, payPayrun } from '../../lib/tasks';
import { walletSummary } from '../../lib/wallet';
import { methodLabel } from '../../lib/payments';
import { money, fmtDate, today, sum } from '../../lib/format';

const monthLabel = (m) => format(parseISO(`${m}-01`), 'MMMM yyyy');

export default function Payroll() {
  const db = useDB();
  const thisMonth = today().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [busy, setBusy] = useState(null);
  const [adv, setAdv] = useState(false);
  const [slip, setSlip] = useState(null);
  const draft = useMemo(() => draftPayrun(db, month), [db, month]);
  const paid = db.payruns.find((p) => p.month === month && p.status === 'paid');
  const w = walletSummary(db);
  const openAdv = db.advances.filter((a) => !a.settled);
  const months = [format(addMonths(new Date(), -2), 'yyyy-MM'), format(addMonths(new Date(), -1), 'yyyy-MM'), thisMonth];
  const run = paid || draft;

  const pay = async () => {
    if (!(await confirmDialog(`Pay salaries for ${monthLabel(month)}?`, `${money(draft.total)} will be sent from the wallet to ${draft.lines.length} staff MoMo numbers.`, { danger: false, confirmLabel: 'Pay now' }))) return;
    try {
      await payPayrun(draft, (l) => setBusy(l.name));
      toast.success('Salaries paid', `${money(draft.total)} sent`);
    } catch (e) {
      toast.error('Payroll not paid', e.message);
    }
    setBusy(null);
  };

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Monthly salaries paid to staff MoMo from your wallet" actions={<><Segmented options={months.map((m) => ({ value: m, label: format(parseISO(`${m}-01`), 'MMM') }))} value={month} onChange={setMonth} /><Button variant="secondary" icon={HandCoins} onClick={() => setAdv(true)}>Salary advance</Button></>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={paid ? 'Paid' : 'To pay'} value={money(run.total)} icon={Banknote} tone={paid ? 'green' : 'gold'} sub={monthLabel(month)} />
        <StatCard label="Staff on payroll" value={run.lines.length} icon={Send} tone="brand" />
        <StatCard label="SSNIT deducted" value={money(sum(run.lines, (l) => l.ssnit))} icon={FileText} tone="sky" sub={`${db.settings.ssnitPct}% employee share`} />
        <StatCard label="Wallet balance" value={money(w.balance)} icon={Banknote} tone={w.balance >= draft.total ? 'teal' : 'red'} sub={w.balance >= draft.total ? 'enough to pay' : 'not enough — bank cash first'} />
      </div>
      <Card className="mb-6">
        <CardHeader title={`${monthLabel(month)} pay run`} subtitle={paid ? `Paid ${fmtDate(paid.paidAt)}` : 'Draft — check it, then pay'} icon={Banknote} action={paid ? <Badge tone="green">Paid</Badge> : <Button icon={busy ? Loader2 : Send} disabled={!!busy || !draft.lines.length} onClick={pay}>{busy ? `Paying ${busy}…` : `Pay ${money(draft.total)}`}</Button>} />
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead><tr><th className="th">Staff</th><th className="th text-right">Salary</th><th className="th text-right">SSNIT</th><th className="th text-right">Advances</th><th className="th text-right">Net pay</th><th className="th">Paid to</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-cream-100 dark:divide-white/5">
              {run.lines.map((l) => (
                <tr key={l.userId}>
                  <td className="td font-semibold">{l.name}</td>
                  <td className="td text-right">{money(l.base)}</td>
                  <td className="td text-right text-slate-500">−{money(l.ssnit)}</td>
                  <td className="td text-right text-slate-500">{l.advances ? `−${money(l.advances)}` : '—'}</td>
                  <td className="td text-right font-bold">{money(l.net)}</td>
                  <td className="td text-xs text-slate-500">{methodLabel(l.method)} · {l.account}{l.status === 'failed' && <Badge tone="red" className="ml-2">Failed</Badge>}</td>
                  <td className="td"><Button size="sm" variant="ghost" icon={FileText} onClick={() => setSlip(l)}>Payslip</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <DataTable
          rows={db.payruns.slice().sort((a, b) => b.month.localeCompare(a.month))}
          search={false}
          columns={[
            { key: 'month', label: 'Month', render: (p) => <b>{monthLabel(p.month)}</b> },
            { key: 'staff', label: 'Staff', render: (p) => p.lines.length },
            { key: 'total', label: 'Total paid', render: (p) => money(p.total) },
            { key: 'paidAt', label: 'Paid on', render: (p) => fmtDate(p.paidAt) },
          ]}
        />
        <Card>
          <CardHeader title="Salary advances" subtitle={`${openAdv.length} to be deducted next pay run`} icon={HandCoins} action={<Button size="sm" variant="soft" icon={Plus} onClick={() => setAdv(true)}>Add</Button>} />
          <div className="space-y-2 p-4">
            {db.advances.slice().reverse().map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2.5 text-sm dark:bg-white/5">
                <div><p className="font-semibold">{db.users.find((u) => u.id === a.userId)?.name}</p><p className="text-xs text-slate-500">{fmtDate(a.date)} · {a.note}</p></div>
                <div className="text-right"><p className="font-bold">{money(a.amount)}</p><Badge tone={a.settled ? 'green' : 'amber'}>{a.settled ? 'Deducted' : 'Open'}</Badge></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <FormModal
        open={adv}
        onClose={() => setAdv(false)}
        title="Salary advance"
        subtitle="Paid in cash now, deducted from the next salary"
        initial={{ date: today() }}
        fields={[
          { name: 'userId', label: 'Staff member', type: 'select', required: true, options: db.users.filter((u) => u.salary > 0).map((u) => ({ value: u.id, label: u.name })) },
          { name: 'amount', label: 'Amount (GH₵)', type: 'number', required: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'note', label: 'Reason' },
        ]}
        onSubmit={(v) => {
          const s = useDB.getState();
          s.add('advances', { ...v, amount: +v.amount, settled: false, payrunId: null });
          s.add('expenses', { farmId: null, date: v.date, category: 'salaries', amount: +v.amount, description: `Salary advance · ${s.users.find((u) => u.id === v.userId)?.name}`, paidFrom: 'cash' });
          toast.success('Advance recorded');
          setAdv(false);
        }}
      />
      <Modal open={!!slip} onClose={() => setSlip(null)} title="Payslip" size="md" footer={<Button icon={Printer} onClick={() => printElement('slip', 'Payslip')}>Print</Button>}>
        {slip && (
          <div id="slip" className="text-sm">
            <div className="flex items-start justify-between border-b border-cream-200 pb-4"><Logo /><div className="text-right"><p className="font-display text-lg font-semibold">Payslip</p><p className="text-xs text-slate-500">{monthLabel(month)}</p></div></div>
            <p className="mt-4 font-bold">{slip.name}</p>
            <p className="text-xs text-slate-500">{db.users.find((u) => u.id === slip.userId)?.position}</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between"><span>Basic salary</span><span>{money(slip.base)}</span></div>
              <div className="flex justify-between text-slate-500"><span>SSNIT ({db.settings.ssnitPct}%)</span><span>−{money(slip.ssnit)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Advances recovered</span><span>−{money(slip.advances)}</span></div>
              <div className="flex justify-between border-t border-cream-200 pt-2 text-base font-bold"><span>Net pay</span><span>{money(slip.net)}</span></div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Paid to {methodLabel(slip.method)} {slip.account}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
