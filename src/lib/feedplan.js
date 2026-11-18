// Feed planner and sale readiness, from the care programme and breed feed standards.
import { addDays, format, parseISO } from 'date-fns';
import { stdFeed, stdWeight } from './standards';
import { programmeFor, stageAt } from './programmes';
import { flockIndex } from './flock';
import { itemBalance } from './stock';
import { today, round2 } from './format';

const STOP = new Set(['mash', 'feed', 'or', 'and', '+', '/', 'pellets', 'crumbs', 'only', '(developer)']);
const KIND = ['turkey', 'duck', 'quail', 'keet', 'broiler', 'layer', 'chick', 'pre-layer'];
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 -]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

/** Best inventory feed item for a programme feed name (by shared words), or null. */
export function matchFeedItem(db, feedName, farmId) {
  const want = words(feedName);
  let best = null, score = 0;
  db.items.filter((i) => i.category === 'feed' && (!farmId || !i.farmIds || i.farmIds.includes(farmId))).forEach((i) => {
    const have = words(i.name);
    // a feed for a specific bird (turkey, duck, broiler…) must match that bird word
    if (want.some((w) => KIND.includes(w)) && !want.some((w) => KIND.includes(w) && have.includes(w))) return;
    const sc = want.filter((w) => have.includes(w)).length;
    if (sc > score) { best = i; score = sc; }
  });
  return best;
}

/**
 * Day-by-day feed need for a flock from today for `days` days (or to the end of its programme).
 * Returns totals per feed type with the date range, plus today and the next 7 days.
 */
export function feedPlan(db, f, days = 90) {
  const p = programmeFor(f);
  const s = flockIndex(db).get(f.id);
  if (!p || !s) return null;
  const live = s.live;
  const start = parseISO(today());
  const horizon = Math.max(1, Math.min(days, (p.end ?? s.age + days) - s.age + 1));
  const byFeed = [];
  let todayKg = 0, weekKg = 0;
  for (let i = 0; i < horizon; i++) {
    const age = s.age + i;
    const st = stageAt(p, age);
    const name = st?.feed?.name || 'Feed';
    const kg = (stdFeed(f, age) * live) / 1000;
    if (i === 0) todayKg = kg;
    if (i < 7) weekKg += kg;
    const date = format(addDays(start, i), 'yyyy-MM-dd');
    const last = byFeed[byFeed.length - 1];
    if (last && last.feed === name) { last.kg += kg; last.to = date; last.days += 1; } else byFeed.push({ feed: name, protein: st?.feed?.protein, kg, from: date, to: date, days: 1, stage: st?.name });
  }
  const bagKg = db.settings.feedBagKg || 50;
  byFeed.forEach((b) => {
    b.kg = round2(b.kg);
    b.bags = Math.ceil(b.kg / bagKg);
    b.item = matchFeedItem(db, b.feed, f.farmId);
    b.inStock = b.item ? Math.max(0, itemBalance(db, b.item.id, f.farmId)) : null;
  });
  const stage = stageAt(p, s.age);
  const next = byFeed[1] || null;
  return { programme: p, stage, live, todayKg: round2(todayKg), todayBags: round2(todayKg / bagKg), weekKg: round2(weekKg), weekBags: Math.ceil(weekKg / bagKg), byFeed, nextChange: next ? { feed: next.feed, date: next.from } : null, gPerBird: Math.round(stdFeed(f, s.age)) };
}

/** Farm-wide feed need for the next `days` days, grouped by feed type, against stock. */
export function farmFeedNeeds(db, flocks, days = 7) {
  const out = new Map();
  flocks.forEach((f) => {
    const plan = feedPlan(db, f, days);
    if (!plan) return;
    plan.byFeed.forEach((b) => {
      const k = `${f.farmId}|${b.feed}`;
      const cur = out.get(k) || { farmId: f.farmId, feed: b.feed, kg: 0, flocks: [], item: b.item, inStock: b.inStock };
      cur.kg = round2(cur.kg + b.kg);
      cur.flocks.push(f.code);
      out.set(k, cur);
    });
  });
  const bagKg = db.settings.feedBagKg || 50;
  return [...out.values()].map((r) => ({ ...r, bags: Math.ceil(r.kg / bagKg), short: r.inStock != null ? round2(Math.max(0, r.kg - r.inStock)) : null }));
}

/** Sale readiness for meat birds. */
export function saleReadiness(db, f) {
  const p = programmeFor(f);
  const s = flockIndex(db).get(f.id);
  if (!p?.sale || !s) return null;
  const w = s.lastWeight?.avgG || null;
  const target = p.sale.weightG;
  const fromDate = format(addDays(parseISO(f.hatchDate), p.sale.from), 'yyyy-MM-dd');
  const daysLeft = p.sale.from - s.age;
  const ready = s.age >= p.sale.from || (w && w >= target);
  const overdue = s.age > p.sale.to;
  // remaining feed cost to the sale date at the current feed prices
  const plan = daysLeft > 0 ? feedPlan(db, f, daysLeft) : null;
  const feedToSaleKg = plan ? plan.byFeed.reduce((a, b) => a + b.kg, 0) : 0;
  const feedToSaleCost = plan ? plan.byFeed.reduce((a, b) => a + b.kg * (b.item?.cost || 0), 0) : 0;
  return { label: p.sale.label, target, weight: w, stdNow: Math.round(stdWeight(f, s.age)), fromDate, daysLeft, ready, overdue, feedToSaleKg: round2(feedToSaleKg), feedToSaleCost: round2(feedToSaleCost), fcr: s.fcr };
}
