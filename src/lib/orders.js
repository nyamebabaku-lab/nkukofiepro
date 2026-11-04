// Orders: booking with a deposit, stock reservation, pick-up, debts and payments.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useDB, useSession } from '../data/store';
import { money, nowISO, today, sum, round2, fmtDate } from './format';
import { isOnline, methodLabel, newRef } from './payments';
import { productStock } from './stock';
import { flockIndex } from './flock';

export const ORDER_STATUS = {
  booked: { label: 'Booked', tone: 'sky' },
  ready: { label: 'Ready for pick-up', tone: 'amber' },
  picked: { label: 'Picked up', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};
export const PAY_STATE = {
  unpaid: { label: 'Unpaid', tone: 'red' },
  deposit: { label: 'Part paid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
};

/** Unit price for a quantity (wholesale price kicks in at the minimum quantity). */
export const unitPrice = (p, qty) => (p.wholesalePrice && p.wholesaleMin && qty >= p.wholesaleMin ? p.wholesalePrice : p.price);

let pcache = { refs: [], value: null };
/** Map orderId → amount paid (refunds are negative payments). */
export function paidIndex(db) {
  if (pcache.value && pcache.refs[0] === db.payments) return pcache.value;
  const m = new Map();
  db.payments.forEach((p) => p.status === 'success' && p.orderId && m.set(p.orderId, (m.get(p.orderId) || 0) + p.amount));
  pcache = { refs: [db.payments], value: m };
  return m;
}

export function orderMoney(db, o) {
  const paid = round2(paidIndex(db).get(o.id) || 0);
  const balance = o.status === 'cancelled' ? 0 : round2(Math.max(0, o.total - paid));
  const state = paid <= 0 ? 'unpaid' : paid + 0.001 >= o.total ? 'paid' : 'deposit';
  return { paid, balance, state, credit: o.status === 'cancelled' ? paid : Math.max(0, round2(paid - o.total)) };
}

export const isDebt = (db, o) => o.status === 'picked' && orderMoney(db, o).balance > 0;
export const debtAgeDays = (o) => differenceInCalendarDays(new Date(), parseISO(o.pickedAt || o.pickupDate));

/** Everything a customer owes, plus what is due at upcoming pick-ups. */
export function customerAccount(db, customerId) {
  const orders = db.orders.filter((o) => o.customerId === customerId);
  let debt = 0, dueAtPickup = 0, credit = 0, spent = 0;
  const debts = [];
  for (const o of orders) {
    const m = orderMoney(db, o);
    if (o.status === 'picked') {
      spent += o.total;
      if (m.balance > 0) {
        debt += m.balance;
        debts.push({ order: o, balance: m.balance, age: debtAgeDays(o) });
      }
    }
    if (o.status === 'booked' || o.status === 'ready') dueAtPickup += m.balance;
    credit += m.credit;
  }
  debts.sort((a, b) => b.age - a.age);
  return { orders, debt: round2(debt), dueAtPickup: round2(dueAtPickup), credit: round2(credit), spent: round2(spent), debts };
}

export const AGE_BUCKETS = [
  { key: '0-30', label: '0–30 days', test: (d) => d <= 30, tone: 'amber' },
  { key: '31-60', label: '31–60 days', test: (d) => d > 30 && d <= 60, tone: 'orange' },
  { key: '60+', label: 'Over 60 days', test: (d) => d > 60, tone: 'red' },
];
export function debtAgeing(db, farmId = 'all') {
  const rows = db.orders.filter((o) => (farmId === 'all' || o.farmId === farmId) && isDebt(db, o)).map((o) => ({ order: o, balance: orderMoney(db, o).balance, age: debtAgeDays(o) }));
  return { rows, total: sum(rows, (r) => r.balance), buckets: AGE_BUCKETS.map((b) => ({ ...b, amount: sum(rows.filter((r) => b.test(r.age)), (r) => r.balance), count: rows.filter((r) => b.test(r.age)).length })) };
}

// ---------------- Pick-up dates ----------------
export function pickupCheck(db, farmId, date) {
  const s = db.settings;
  if (!date) return { ok: false, reason: 'Choose a pick-up date' };
  if (date < today()) return { ok: false, reason: 'That date has passed' };
  const dow = parseISO(date).getDay();
  if (!(s.openDays || []).includes(dow)) return { ok: false, reason: 'The farm is closed on that day' };
  if ((s.blockedDates || []).includes(date)) return { ok: false, reason: 'The farm is closed on that date' };
  const booked = db.orders.filter((o) => o.farmId === farmId && o.pickupDate === date && o.status !== 'cancelled' && o.channel === 'portal').length;
  if (booked >= (s.pickupCapacity || 30)) return { ok: false, reason: 'That day is fully booked — please pick another' };
  return { ok: true, left: (s.pickupCapacity || 30) - booked };
}

// ---------------- Actions ----------------
const actor = () => {
  const s = useSession.getState();
  if (s.userId) return useDB.getState().users.find((u) => u.id === s.userId)?.name || 'Staff';
  if (s.customerId) return 'Customer';
  return 'System';
};

/** Price the cart and check stock. lines: [{ productId, qty }] */
export function priceLines(db, farmId, lines) {
  const out = [];
  const problems = [];
  for (const l of lines) {
    const p = db.products.find((x) => x.id === l.productId);
    if (!p || !l.qty) continue;
    const st = productStock(db, p.id, farmId);
    if (l.qty > st.available) problems.push(`${p.name}: only ${st.available} ${p.unit}${st.available === 1 ? '' : 's'} available`);
    const price = unitPrice(p, l.qty);
    out.push({ productId: p.id, name: p.name, unit: p.unit, qty: l.qty, price, amount: round2(price * l.qty), withdrawalWarn: withdrawalWarning(db, p, farmId) });
  }
  return { lines: out, subtotal: round2(sum(out, (l) => l.amount)), problems };
}

export function createOrder({ customerId, customerName, phone, farmId, lines, pickupDate, channel = 'portal', note = '', discount = 0, status = 'booked' }) {
  const db = useDB.getState();
  const priced = priceLines(db, farmId, lines);
  if (!priced.lines.length) throw new Error('The order is empty');
  if (priced.problems.length) throw new Error(priced.problems.join('; '));
  const total = round2(Math.max(0, priced.subtotal - (discount || 0)));
  const cust = db.customers.find((c) => c.id === customerId);
  const order = db.add('orders', {
    ref: newRef('PP-'),
    customerId: customerId || null,
    customerName: cust?.name || customerName || 'Walk-in customer',
    phone: cust?.phone || phone || '',
    farmId,
    // eslint-disable-next-line no-unused-vars
    lines: priced.lines.map(({ withdrawalWarn, ...l }) => l),
    subtotal: priced.subtotal,
    discount: discount || 0,
    total,
    pickupDate: pickupDate || today(),
    status,
    channel,
    note,
    pickedAt: status === 'picked' ? nowISO() : null,
    by: actor(),
  });
  const farm = db.farms.find((f) => f.id === farmId);
  if (channel === 'portal') {
    db.notify({ toRoles: ['owner', 'manager'], farmId, title: 'New booking', text: `${order.customerName} · ${money(total)} · pick-up ${fmtDate(order.pickupDate)}`, link: `/app/orders/${order.id}` });
    if (order.phone) db.sms(order.phone, `PoultryPro: Order ${order.ref} booked for pick-up at ${farm?.name} on ${fmtDate(order.pickupDate)}. Total ${money(total)}.`);
  }
  db.log('Order created', `${order.ref} · ${order.customerName} · ${money(total)}`, { farmId });
  if (status === 'picked') recordBirdSales(order);
  return order;
}

/** Saves a payment against an order (or a customer's account) and credits the wallet for online money. */
export function recordPayment({ orderId, customerId, amount, method, account = '', kind = 'payment', note = '', status = 'success' }) {
  const db = useDB.getState();
  const order = orderId ? db.orders.find((o) => o.id === orderId) : null;
  const pay = db.add('payments', {
    ref: newRef('PAY'), orderId: orderId || null, customerId: customerId || order?.customerId || null, farmId: order?.farmId || null,
    amount: round2(amount), method, account, kind, status, note, at: nowISO(), by: actor(),
  });
  if (status !== 'success') return pay;
  if (isOnline(method)) db.add('walletTx', { type: amount >= 0 ? 'payment' : 'refund', amount: round2(amount), ref: pay.ref, method, note: order ? `Order ${order.ref}` : 'Account payment', at: nowISO(), status: 'success' });
  const who = order?.customerName || db.customers.find((c) => c.id === pay.customerId)?.name || 'Customer';
  if (amount > 0) {
    db.notify({ toRoles: ['owner'], title: `Payment received · ${methodLabel(method)}`, text: `${who} paid ${money(amount)}${order ? ` for ${order.ref}` : ''}`, link: order ? `/app/orders/${order.id}` : '/app/finance' });
    if (pay.customerId) db.notify({ toCustomerId: pay.customerId, title: 'Payment received', text: `Thank you! We received ${money(amount)}${order ? ` for order ${order.ref}` : ''}.`, link: '/account' });
    const phone = order?.phone || db.customers.find((c) => c.id === pay.customerId)?.phone;
    if (phone) db.sms(phone, `PoultryPro: Payment of ${money(amount)} received (${methodLabel(method)}). Ref ${pay.ref}.`);
  }
  db.log(amount >= 0 ? 'Payment recorded' : 'Refund issued', `${who} · ${money(Math.abs(amount))} · ${methodLabel(method)}`);
  return pay;
}

/** Pays off a customer's debts oldest first. Returns the payments made. */
export function payDebts(customerId, amount, method, account) {
  const db = useDB.getState();
  const { debts } = customerAccount(db, customerId);
  let left = round2(amount);
  const pays = [];
  for (const d of debts) {
    if (left <= 0) break;
    const part = Math.min(left, d.balance);
    pays.push(recordPayment({ orderId: d.order.id, customerId, amount: part, method, account, kind: 'debt' }));
    left = round2(left - part);
  }
  if (left > 0) pays.push(recordPayment({ customerId, amount: left, method, account, kind: 'credit', note: 'Advance / credit on account' }));
  return pays;
}

/** Live-bird products leave the flock when picked up (oldest matching flock first). */
function recordBirdSales(order) {
  const db = useDB.getState();
  const fi = flockIndex(db);
  for (const l of order.lines) {
    const p = db.products.find((x) => x.id === l.productId);
    if (p?.stockMode !== 'birds') continue;
    let need = l.qty;
    const flocks = db.flocks.filter((f) => f.status === 'active' && f.farmId === order.farmId && f.species === p.species && (!p.purpose || f.purpose === p.purpose)).sort((a, b) => a.hatchDate.localeCompare(b.hatchDate));
    for (const f of flocks) {
      if (need <= 0) break;
      const take = Math.min(need, fi.get(f.id)?.live || 0);
      if (take > 0) db.add('flockMoves', { flockId: f.id, farmId: f.farmId, date: today(), qty: take, kind: 'sold', note: `Order ${order.ref}` });
      need -= take;
    }
  }
}

export function setOrderStatus(orderId, status, { refund = false, refundMethod } = {}) {
  const db = useDB.getState();
  const o = db.orders.find((x) => x.id === orderId);
  if (!o) return;
  db.update('orders', orderId, { status, pickedAt: status === 'picked' ? nowISO() : o.pickedAt, readyAt: status === 'ready' ? nowISO() : o.readyAt, cancelledAt: status === 'cancelled' ? nowISO() : o.cancelledAt });
  const farm = db.farms.find((f) => f.id === o.farmId);
  if (status === 'picked') recordBirdSales(o);
  if (status === 'cancelled' && refund) {
    const paid = paidIndex(useDB.getState()).get(o.id) || 0;
    if (paid > 0) recordPayment({ orderId: o.id, amount: -paid, method: refundMethod || 'cash', kind: 'refund', note: 'Refund on cancellation' });
  }
  const msg = {
    ready: `Your order ${o.ref} is ready for pick-up at ${farm?.name}.`,
    picked: `Order ${o.ref} picked up. Thank you for buying from us!`,
    cancelled: `Order ${o.ref} was cancelled.`,
  }[status];
  if (o.customerId && msg) db.notify({ toCustomerId: o.customerId, title: ORDER_STATUS[status].label, text: msg, link: '/account/orders' });
  if (o.phone && msg) db.sms(o.phone, `PoultryPro: ${msg}`);
  db.log(`Order ${ORDER_STATUS[status].label.toLowerCase()}`, `${o.ref} · ${o.customerName}`, { farmId: o.farmId });
}

/** A flock under drug treatment must not be sold for food until its withdrawal period ends. */
export function withdrawalWarning(db, product, farmId) {
  if (!['eggs', 'live', 'meat'].includes(product.category)) return null;
  const t = today();
  const hits = db.treatments.filter((r) => r.withdrawalUntil && r.withdrawalUntil >= t && (farmId === 'all' || r.farmId === farmId)).filter((r) => {
    const f = db.flocks.find((x) => x.id === r.flockId);
    if (!f) return false;
    if (product.category === 'eggs') return ['layer', 'breeder'].includes(f.purpose);
    if (product.stockMode === 'birds') return f.species === product.species && (!product.purpose || f.purpose === product.purpose);
    return product.category === 'meat' && f.purpose !== 'layer';
  });
  if (!hits.length) return null;
  const r = hits.sort((a, b) => b.withdrawalUntil.localeCompare(a.withdrawalUntil))[0];
  const f = db.flocks.find((x) => x.id === r.flockId);
  return `Flock ${f.code} is on ${r.drug} — withdrawal period until ${fmtDate(r.withdrawalUntil)}. Sell from other flocks.`;
}
