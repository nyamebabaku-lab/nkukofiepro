// Live apps: loads the signed-in business from Supabase into the store, sends every local change
// back (queued while offline), and merges changes made on other phones in real time.
import { supabase } from './supabase';
import { useDB } from './store';
import { storeKey } from '../config';
import { productIndex } from '../lib/stock';

const ARRAYS = ['farms', 'pens', 'flocks', 'feedLogs', 'eggLogs', 'weightLogs', 'mortality', 'envLogs', 'flockMoves', 'vaccinations', 'treatments', 'hatchBatches',
  'items', 'stockMoves', 'suppliers', 'products', 'productMoves', 'customers', 'orders', 'payments', 'walletTx', 'expenses', 'users', 'tasks', 'taskRuns',
  'attendance', 'advances', 'payruns', 'assets', 'maintenance', 'notifications', 'smsLog', 'audit', 'vaccineTemplates', 'shopStock'];
// Lists the app trims locally to keep storage small; trimming must not delete them online.
const NO_DELETE = new Set(['audit', 'notifications', 'smsLog']);
const STOCK_INPUTS = ['products', 'orders', 'eggLogs', 'productMoves', 'flocks', 'mortality', 'flockMoves', 'farms'];

let ctx = null; // { bid, readOnly, role, channel, unsub, queue, timer, lastSync }
let applying = false;

const qKey = () => storeKey(`nkukofie-queue-${ctx?.bid}`);
const saveQueue = () => {
  try {
    localStorage.setItem(qKey(), JSON.stringify([...ctx.queue.values()]));
  } catch {
    /* storage full: the queue still lives in memory */
  }
};
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

function applyRemote(fn) {
  applying = true;
  try {
    fn();
  } finally {
    applying = false;
  }
}

/** Loads one business. role: owner | manager | worker | customer; readOnly for the super admin's support view. */
export async function startSync(bid, { role, readOnly = false } = {}) {
  stopSync();
  ctx = { bid, role, readOnly, queue: new Map(), timer: null, lastSync: null };
  try {
    (JSON.parse(localStorage.getItem(qKey()) || '[]') || []).forEach((q) => ctx.queue.set(`${q.col}|${q.id}`, q));
  } catch {
    /* ignore */
  }
  const rows = [];
  try {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('records').select('col,id,data,updated_at').eq('business_id', bid).range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
  } catch (e) {
    // Offline start: keep the copy saved on this phone and catch up when the internet returns.
    if (navigator.onLine || !useDB.getState().farms) throw e;
    ctx.offlineStart = true;
  }
  const state = {};
  rows.forEach((r) => {
    if (r.col === 'settings') state.settings = { ...useDB.getState().settings, ...r.data };
    else (state[r.col] ||= []).push(r.data);
    if (!ctx.lastSync || r.updated_at > ctx.lastSync) ctx.lastSync = r.updated_at;
  });
  if (!state.vaccineTemplates?.length) delete state.vaccineTemplates;
  if (!ctx.offlineStart) applyRemote(() => useDB.getState().loadBusiness({ ...state, customerView: role === 'customer', businessId: bid }));

  ctx.unsub = useDB.subscribe(onLocalChange);
  ctx.channel = supabase
    .channel(`records-${bid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `business_id=eq.${bid}` }, onRemote)
    .subscribe();
  window.addEventListener('online', flush);
  ctx.timer = setInterval(flush, 20000);
  flush();
  if (role !== 'customer' && !readOnly) setTimeout(publishShopStock, 1500);
}

export function stopSync() {
  if (!ctx) return;
  ctx.unsub?.();
  if (ctx.channel) supabase.removeChannel(ctx.channel);
  clearInterval(ctx.timer);
  window.removeEventListener('online', flush);
  ctx = null;
}

export const syncInfo = () => (ctx ? { pending: ctx.queue.size, readOnly: ctx.readOnly, bid: ctx.bid } : null);

function queue(op, col, id, data) {
  ctx.queue.set(`${col}|${id}`, { op, col, id, data });
}

function onLocalChange(s, prev) {
  if (applying || !ctx || ctx.readOnly) return;
  let touched = false;
  for (const col of ARRAYS) {
    if (s[col] === prev[col] || !Array.isArray(s[col])) continue;
    const before = new Map((prev[col] || []).map((r) => [r.id, r]));
    const after = new Set();
    for (const r of s[col]) {
      after.add(r.id);
      if (before.get(r.id) !== r) {
        queue('upsert', col, r.id, r);
        touched = true;
      }
    }
    if (!NO_DELETE.has(col))
      for (const id of before.keys())
        if (!after.has(id)) {
          queue('delete', col, id);
          touched = true;
        }
    if (STOCK_INPUTS.includes(col) && ctx.role !== 'customer') scheduleShopStock();
  }
  if (s.settings !== prev.settings) {
    queue('upsert', 'settings', 'main', s.settings);
    touched = true;
  }
  if (touched) {
    saveQueue();
    clearTimeout(ctx.flushSoon);
    ctx.flushSoon = setTimeout(flush, 400);
  }
}

let flushing = false;
async function flush() {
  if (!ctx || flushing || !ctx.queue.size || !navigator.onLine) return;
  flushing = true;
  const bid = ctx.bid;
  try {
    const items = [...ctx.queue.values()];
    const ups = items.filter((q) => q.op === 'upsert');
    const send = async (batch) => supabase.from('records').upsert(batch.map((q) => ({ business_id: bid, col: q.col, id: String(q.id), data: q.data })), { onConflict: 'business_id,col,id' });
    for (let i = 0; i < ups.length; i += 200) {
      const batch = ups.slice(i, i + 200);
      const { error } = await send(batch);
      if (!error) batch.forEach((q) => ctx?.queue.delete(`${q.col}|${q.id}`));
      else if (isDenied(error)) {
        // One row the user may not write would fail the whole batch, so retry row by row.
        for (const q of batch) {
          const r = await send([q]);
          if (!r.error || isDenied(r.error)) ctx?.queue.delete(`${q.col}|${q.id}`);
          if (r.error && isDenied(r.error)) emit('nkukofie-sync-denied', q.col);
        }
      } else break;
    }
    for (const q of items.filter((x) => x.op === 'delete')) {
      const { error } = await supabase.from('records').delete().match({ business_id: bid, col: q.col, id: String(q.id) });
      if (!error || isDenied(error)) ctx?.queue.delete(`${q.col}|${q.id}`);
      else break;
    }
  } finally {
    flushing = false;
    if (ctx) saveQueue();
    emit('nkukofie-sync', syncInfo());
  }
}

const isDenied = (e) => e && (e.code === '42501' || /row-level security|permission denied/i.test(e.message || ''));

function onRemote(payload) {
  if (!ctx) return;
  const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
  if (!row?.col) return;
  if (ctx.queue.has(`${row.col}|${row.id}`)) return; // our own newer change is still on its way up
  if (row.updated_at && (!ctx.lastSync || row.updated_at > ctx.lastSync)) ctx.lastSync = row.updated_at;
  applyRemote(() => {
    useDB.setState((s) => {
      if (row.col === 'settings') return payload.eventType === 'DELETE' ? {} : { settings: { ...s.settings, ...row.data } };
      const list = s[row.col] || [];
      if (payload.eventType === 'DELETE') return { [row.col]: list.filter((r) => String(r.id) !== String(row.id)) };
      const i = list.findIndex((r) => String(r.id) === String(row.id));
      return { [row.col]: i === -1 ? [...list, row.data] : list.map((r, j) => (j === i ? row.data : r)) };
    });
  });
}

/** After being offline, fetch anything other phones changed in the meantime. */
export async function catchUp() {
  if (!ctx?.lastSync) return;
  const { data, error } = await supabase.from('records').select('col,id,data,updated_at').eq('business_id', ctx.bid).gt('updated_at', ctx.lastSync);
  if (error || !data?.length) return;
  data.forEach((row) => onRemote({ eventType: 'UPDATE', new: row }));
}
window.addEventListener('online', () => (ctx?.offlineStart ? startSync(ctx.bid, { role: ctx.role, readOnly: ctx.readOnly }) : catchUp()));

// ---------- What customers can see about stock (they can't read other people's orders) ----------
let stockTimer;
function scheduleShopStock() {
  clearTimeout(stockTimer);
  stockTimer = setTimeout(publishShopStock, 4000);
}

function publishShopStock() {
  if (!ctx || ctx.readOnly || ctx.role === 'customer') return;
  const db = useDB.getState();
  const idx = productIndex(db);
  const stock = {};
  idx.forEach((v, k) => (stock[k] = v.available));
  const bookings = {};
  db.orders.forEach((o) => {
    if (o.channel === 'portal' && o.status !== 'cancelled') bookings[`${o.farmId}|${o.pickupDate}`] = (bookings[`${o.farmId}|${o.pickupDate}`] || 0) + 1;
  });
  const prev = db.shopStock?.[0];
  if (prev && JSON.stringify(prev.stock) === JSON.stringify(stock) && JSON.stringify(prev.bookings) === JSON.stringify(bookings)) return;
  useDB.setState({ shopStock: [{ id: 'main', at: new Date().toISOString(), stock, bookings }] });
}
