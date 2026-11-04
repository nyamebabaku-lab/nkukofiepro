// Owner wallet: online payments land here; withdrawals, payroll and expenses paid online leave from here.
// Cash taken at the farm is tracked as "cash on hand" until it is banked into the wallet.
import { useDB, useSession } from '../data/store';
import { money, nowISO, sum, round2 } from './format';
import { methodLabel, newRef } from './payments';

export function walletSummary(db) {
  const ok = db.walletTx.filter((t) => t.status === 'success');
  const balance = round2(sum(ok, (t) => t.amount));
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = ok.filter((t) => t.at.slice(0, 7) === month);
  const cashIn = sum(db.payments.filter((p) => p.status === 'success' && p.method === 'cash'), (p) => p.amount);
  const cashOut = sum(db.expenses.filter((e) => e.paidFrom === 'cash'), (e) => e.amount) + sum(ok.filter((t) => t.type === 'cash-deposit'), (t) => t.amount);
  return {
    balance,
    inMonth: round2(sum(thisMonth.filter((t) => t.amount > 0 && t.type !== 'cash-deposit'), (t) => t.amount)),
    outMonth: round2(-sum(thisMonth.filter((t) => t.amount < 0), (t) => t.amount)),
    withdrawnMonth: round2(-sum(thisMonth.filter((t) => t.type === 'withdrawal'), (t) => t.amount)),
    cashOnHand: round2(cashIn - cashOut),
  };
}

export const destinationLabel = (d) => (!d ? '—' : d.type === 'bank' ? `${d.bank} · ${d.number}` : `${methodLabel(d.network)} · ${d.number}`);

/** Validates and records a completed withdrawal (the payout itself is simulated in payments.js). */
export function withdraw(amount, destination, pin, payoutRef) {
  const db = useDB.getState();
  const s = db.settings;
  const w = walletSummary(db);
  if (String(pin) !== String(s.withdrawalPin)) throw new Error('Wrong wallet PIN');
  if (amount < (s.minWithdrawal || 1)) throw new Error(`Minimum withdrawal is ${money(s.minWithdrawal)}`);
  if (amount > w.balance) throw new Error(`Only ${money(w.balance)} is in the wallet`);
  const tx = db.add('walletTx', {
    type: 'withdrawal', amount: -round2(amount), ref: newRef('WD'), payoutRef, destination, note: `Withdrawal to ${destinationLabel(destination)}`, at: nowISO(), status: 'success', by: useSession.getState().userId,
  });
  db.log('Wallet withdrawal', `${money(amount)} to ${destinationLabel(destination)}`);
  db.notify({ toRoles: ['owner'], title: 'Withdrawal sent', text: `${money(amount)} to ${destinationLabel(destination)}`, link: '/app/wallet' });
  return tx;
}

/** Moves cash collected at the farm into the wallet (e.g. after banking it). */
export function bankCash(amount, note = 'Cash banked') {
  const db = useDB.getState();
  const w = walletSummary(db);
  if (amount <= 0) throw new Error('Enter an amount');
  if (amount > w.cashOnHand + 0.001) throw new Error(`Only ${money(w.cashOnHand)} cash on hand`);
  db.add('walletTx', { type: 'cash-deposit', amount: round2(amount), ref: newRef('CSH'), note, at: nowISO(), status: 'success' });
  db.log('Cash banked', money(amount));
}

/** Records an expense; if paid from the wallet it also leaves the wallet. */
export function addExpense(e) {
  const db = useDB.getState();
  if (e.paidFrom === 'wallet') {
    const w = walletSummary(db);
    if (e.amount > w.balance) throw new Error(`Wallet has only ${money(w.balance)}`);
  }
  const rec = db.add('expenses', { ...e, amount: round2(e.amount), by: useSession.getState().userId });
  if (e.paidFrom === 'wallet') db.add('walletTx', { type: e.category === 'salaries' ? 'payroll' : 'expense', amount: -round2(e.amount), ref: newRef('EXP'), note: e.description, at: nowISO(), status: 'success', expenseId: rec.id });
  db.log('Expense recorded', `${e.description} · ${money(e.amount)}`, { farmId: e.farmId });
  return rec;
}

export const EXPENSE_CATEGORIES = [
  { value: 'feed', label: 'Feed' },
  { value: 'birds', label: 'Birds / chicks' },
  { value: 'health', label: 'Drugs & vaccines' },
  { value: 'salaries', label: 'Salaries & wages' },
  { value: 'maintenance', label: 'Repairs & maintenance' },
  { value: 'utilities', label: 'Electricity & water' },
  { value: 'fuel', label: 'Fuel & transport' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];
export const expenseLabel = (v) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label || v;
