// Inventory (feed, drugs, equipment…) and shop product availability.
import { dayKey, sum } from './format';
import { flockIndex } from './flock';
import { goodEggs } from './flock';

export const ITEM_CATEGORIES = [
  { value: 'feed', label: 'Feed' },
  { value: 'vaccine', label: 'Vaccines' },
  { value: 'drug', label: 'Drugs & supplements' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'cleaning', label: 'Cleaning & biosecurity' },
  { value: 'other', label: 'Other' },
];

let cache = { refs: [], value: null };
/** Map `${itemId}|${farmId}` → balance. Feed logs and treatments with an itemId use stock up automatically. */
export function stockIndex(db) {
  const refs = [db.stockMoves, db.feedLogs, db.treatments, db.vaccinations];
  if (cache.value && refs.every((r, i) => r === cache.refs[i])) return cache.value;
  const m = new Map();
  const add = (itemId, farmId, q) => {
    if (!itemId) return;
    const k = `${itemId}|${farmId}`;
    m.set(k, (m.get(k) || 0) + q);
  };
  db.stockMoves.forEach((r) => add(r.itemId, r.farmId, r.qty));
  db.feedLogs.forEach((r) => add(r.itemId, r.farmId, -r.kg));
  db.treatments.forEach((r) => add(r.itemId, r.farmId, -(r.qty || 0)));
  db.vaccinations.forEach((r) => r.status === 'done' && r.itemId && add(r.itemId, r.farmId, -(r.qty || 1)));
  cache = { refs, value: m };
  return m;
}

export function itemBalance(db, itemId, farmId = 'all') {
  const idx = stockIndex(db);
  if (farmId !== 'all') return idx.get(`${itemId}|${farmId}`) || 0;
  return sum(db.farms, (f) => idx.get(`${itemId}|${f.id}`) || 0);
}

/** Average daily use over the last 14 days, and how many days the current stock lasts. */
export function itemUsage(db, item, farmId = 'all') {
  const from = dayKey(-13);
  const inFarm = (r) => farmId === 'all' || r.farmId === farmId;
  let used = 0;
  if (item.category === 'feed') used = sum(db.feedLogs.filter((r) => r.itemId === item.id && r.date >= from && inFarm(r)), (r) => r.kg);
  else used = sum(db.stockMoves.filter((r) => r.itemId === item.id && r.qty < 0 && r.date >= from && inFarm(r)), (r) => -r.qty) + sum(db.treatments.filter((r) => r.itemId === item.id && r.date >= from && inFarm(r)), (r) => r.qty || 0);
  const perDay = used / 14;
  const bal = itemBalance(db, item.id, farmId);
  return { perDay, balance: bal, daysLeft: perDay > 0 ? Math.floor(bal / perDay) : null, low: bal <= (item.reorder || 0) * (farmId === 'all' ? db.farms.length : 1) };
}

/** Items at or below their reorder level for a farm. */
export function lowStock(db, farmId = 'all') {
  const farms = farmId === 'all' ? db.farms : db.farms.filter((f) => f.id === farmId);
  const out = [];
  for (const it of db.items) {
    for (const f of farms) {
      if (!(it.farmIds || []).includes(f.id)) continue;
      const bal = itemBalance(db, it.id, f.id);
      if (bal <= (it.reorder || 0)) out.push({ item: it, farm: f, balance: bal });
    }
  }
  return out;
}

// ---------------- Shop products ----------------
export const PRODUCT_CATEGORIES = [
  { value: 'eggs', label: 'Eggs', emoji: '🥚' },
  { value: 'live', label: 'Live birds', emoji: '🐔' },
  { value: 'meat', label: 'Dressed meat', emoji: '🍗' },
  { value: 'chicks', label: 'Chicks & pullets', emoji: '🐣' },
  { value: 'drugs', label: 'Drugs & vaccines', emoji: '💊' },
  { value: 'feed', label: 'Feed', emoji: '🌾' },
  { value: 'equipment', label: 'Equipment', emoji: '🪣' },
  { value: 'other', label: 'Other', emoji: '📦' },
];
export const UNITS = ['crate', 'half crate', 'piece', 'head', 'kg', 'chick', 'bag', 'bottle', 'sachet', 'vial', 'sack', 'pack'];
export const EGG_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'cracked', label: 'Cracked' },
];
export const categoryLabel = (v) => PRODUCT_CATEGORIES.find((c) => c.value === v)?.label || v;

const OPEN = ['booked', 'ready'];

let pcache = { refs: [], value: null };
/**
 * Units available to sell per product per farm: Map(`${productId}|${farmId}` → { available, reserved }).
 *  - eggs: graded eggs collected minus eggs already sold or reserved (all egg products of a size share one pool)
 *  - birds: live birds in matching active flocks minus heads reserved on open orders
 *  - manual: stock added by hand (productMoves) minus everything sold or reserved
 */
export function productIndex(db) {
  const refs = [db.products, db.orders, db.eggLogs, db.productMoves, db.flocks, db.mortality, db.flockMoves];
  if (pcache.value && refs.every((r, i) => r === pcache.refs[i])) return pcache.value;
  const prod = new Map(db.products.map((p) => [p.id, p]));
  const fi = flockIndex(db);
  const eggPool = new Map(); // `${farmId}|${size}` → eggs
  const addEgg = (farmId, size, n) => eggPool.set(`${farmId}|${size}`, (eggPool.get(`${farmId}|${size}`) || 0) + n);
  for (const e of db.eggLogs) {
    ['small', 'medium', 'large', 'jumbo', 'cracked'].forEach((s) => e[s] && addEgg(e.farmId, s, e[s]));
  }
  const reserved = new Map();
  const committed = new Map(); // manual products: sold or reserved
  for (const o of db.orders) {
    if (o.status === 'cancelled') continue;
    for (const l of o.lines) {
      const p = prod.get(l.productId);
      if (!p) continue;
      const k = `${p.id}|${o.farmId}`;
      if (OPEN.includes(o.status)) reserved.set(k, (reserved.get(k) || 0) + l.qty);
      if (p.stockMode === 'eggs') addEgg(o.farmId, p.eggSize, -l.qty * (p.eggsPer || 30));
      if (p.stockMode === 'manual') committed.set(k, (committed.get(k) || 0) + l.qty);
    }
  }
  const manualIn = new Map();
  db.productMoves.forEach((r) => manualIn.set(`${r.productId}|${r.farmId}`, (manualIn.get(`${r.productId}|${r.farmId}`) || 0) + r.qty));

  const out = new Map();
  for (const p of db.products) {
    for (const f of db.farms) {
      const k = `${p.id}|${f.id}`;
      let available = 0;
      if (p.stockMode === 'eggs') available = Math.floor(Math.max(0, eggPool.get(`${f.id}|${p.eggSize}`) || 0) / (p.eggsPer || 30));
      else if (p.stockMode === 'birds') {
        const live = sum(db.flocks.filter((x) => x.status === 'active' && x.farmId === f.id && x.species === p.species && (!p.purpose || x.purpose === p.purpose)), (x) => fi.get(x.id)?.live || 0);
        available = Math.max(0, live - (reserved.get(k) || 0));
      } else available = Math.max(0, (manualIn.get(k) || 0) - (committed.get(k) || 0));
      out.set(k, { available, reserved: reserved.get(k) || 0 });
    }
  }
  pcache = { refs, value: out };
  return out;
}

export function productStock(db, productId, farmId = 'all') {
  const idx = productIndex(db);
  if (farmId !== 'all') return idx.get(`${productId}|${farmId}`) || { available: 0, reserved: 0 };
  return db.farms.reduce((a, f) => {
    const r = idx.get(`${productId}|${f.id}`) || { available: 0, reserved: 0 };
    return { available: a.available + r.available, reserved: a.reserved + r.reserved };
  }, { available: 0, reserved: 0 });
}

/** Eggs in the store room right now (good eggs by size) for a farm. */
export function eggStore(db, farmId = 'all') {
  const sizes = { small: 0, medium: 0, large: 0, jumbo: 0, cracked: 0 };
  const inFarm = (id) => farmId === 'all' || id === farmId;
  db.eggLogs.forEach((e) => inFarm(e.farmId) && Object.keys(sizes).forEach((s) => (sizes[s] += e[s] || 0)));
  const prod = new Map(db.products.map((p) => [p.id, p]));
  db.orders.forEach((o) => {
    if (o.status === 'cancelled' || !inFarm(o.farmId)) return;
    o.lines.forEach((l) => {
      const p = prod.get(l.productId);
      if (p?.stockMode === 'eggs') sizes[p.eggSize] -= l.qty * (p.eggsPer || 30);
    });
  });
  Object.keys(sizes).forEach((s) => (sizes[s] = Math.max(0, sizes[s])));
  return sizes;
}

export const todaysEggs = (db, farmId = 'all') => sum(db.eggLogs.filter((e) => e.date === dayKey(0) && (farmId === 'all' || e.farmId === farmId)), goodEggs);
