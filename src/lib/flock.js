// Flock maths: live count, age, laying %, mortality, feed and FCR. Pure functions over the store data.
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { today, dayKey, sum, round2, lastDays } from './format';
import { isLayingType, isMeatType, stdLayPct, stdWeight, stdFeed } from './standards';

export const ageDays = (f, at = today()) => differenceInCalendarDays(parseISO(at), parseISO(f.hatchDate));
export const ageLabel = (days) => (days < 0 ? 'Not hatched' : days < 14 ? `${days} days` : `${Math.floor(days / 7)} wks${days % 7 ? ` ${days % 7}d` : ''}`);
export const eggTotal = (e) => (e.small || 0) + (e.medium || 0) + (e.large || 0) + (e.jumbo || 0) + (e.cracked || 0);
export const goodEggs = (e) => eggTotal(e) - (e.cracked || 0);

const byFlock = (list) => {
  const m = new Map();
  for (const r of list) {
    if (!m.has(r.flockId)) m.set(r.flockId, []);
    m.get(r.flockId).push(r);
  }
  return m;
};

let cache = { refs: [], value: null };
/**
 * Per-flock statistics, memoised on the record arrays so many components can call it cheaply.
 * Returns Map(flockId → stats).
 */
export function flockIndex(db) {
  const refs = [db.flocks, db.mortality, db.flockMoves, db.feedLogs, db.eggLogs, db.weightLogs, db.items];
  if (cache.value && refs.every((r, i) => r === cache.refs[i])) return cache.value;
  const mort = byFlock(db.mortality);
  const moves = byFlock(db.flockMoves);
  const feed = byFlock(db.feedLogs);
  const eggs = byFlock(db.eggLogs);
  const weights = byFlock(db.weightLogs);
  const itemCost = new Map(db.items.map((i) => [i.id, i.cost || 0]));
  const t = today();
  // 7 complete days (yesterday and the 6 before) so today's half-finished records don't drag averages down.
  const d7 = dayKey(-7);
  const yday = dayKey(-1);
  const out = new Map();

  for (const f of db.flocks) {
    const m = mort.get(f.id) || [];
    const mv = moves.get(f.id) || [];
    const fd = feed.get(f.id) || [];
    const eg = eggs.get(f.id) || [];
    const wt = (weights.get(f.id) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const dead = sum(m, (r) => r.dead);
    const culled = sum(m, (r) => r.culled);
    const sold = sum(mv.filter((x) => x.kind !== 'transfer'), (x) => x.qty);
    const transferred = sum(mv.filter((x) => x.kind === 'transfer'), (x) => x.qty);
    const live = Math.max(0, f.opening - dead - culled - sold - transferred);
    const age = ageDays(f);
    const feedKg = sum(fd, (r) => r.kg);
    const feedCost = sum(fd, (r) => r.kg * (itemCost.get(r.itemId) || 0));
    const feed7 = sum(fd.filter((r) => r.date >= d7 && r.date < t), (r) => r.kg);
    const eggsAll = sum(eg, goodEggs);
    const eggs7 = sum(eg.filter((r) => r.date >= d7 && r.date < t), goodEggs);
    const todayRec = eg.find((r) => r.date === t);
    const ydayRec = eg.find((r) => r.date === yday);
    const dead7 = sum(m.filter((r) => r.date >= d7 && r.date < t), (r) => r.dead);
    const lastW = wt[wt.length - 1] || null;
    const layPct7 = live ? (eggs7 / 7 / live) * 100 : 0;
    const std = isLayingType(f) ? stdLayPct(f, age / 7) : 0;
    let fcr = null;
    if (isMeatType(f) && lastW) {
      const gainedKg = (live * lastW.avgG) / 1000 - (f.opening * (f.species === 'chicken' ? 42 : 50)) / 1000;
      fcr = gainedKg > 0 ? round2(feedKg / gainedKg) : null;
    }
    out.set(f.id, {
      live, dead, culled, sold, transferred, age, feedKg, feedCost, feed7, eggsAll, eggs7,
      eggsToday: todayRec ? goodEggs(todayRec) : null,
      eggsYesterday: ydayRec ? goodEggs(ydayRec) : null,
      layPct7: round2(layPct7), stdLayPct: round2(std),
      dead7, mortalityPct: f.opening ? round2(((dead + culled) / f.opening) * 100) : 0,
      lastWeight: lastW, stdWeightNow: Math.round(stdWeight(f, age)), fcr,
      feedPerBird7: live ? Math.round((feed7 / 7 / live) * 1000) : 0,
      stdFeedNow: Math.round(stdFeed(f, age)),
      birdCost: f.opening * (f.costPerBird || 0),
    });
  }
  cache = { refs, value: out };
  return out;
}

export const statsFor = (db, flockId) => flockIndex(db).get(flockId);
export const activeFlocks = (db, farmId = 'all') => db.flocks.filter((f) => f.status === 'active' && (farmId === 'all' || f.farmId === farmId));

/** Daily series for a flock over `days`: eggs, lay %, standard, feed g/bird, deaths, avg weight. */
export function flockDaily(db, f, days = 30) {
  const keys = lastDays(days);
  const eg = new Map(db.eggLogs.filter((r) => r.flockId === f.id).map((r) => [r.date, r]));
  const fd = new Map();
  db.feedLogs.filter((r) => r.flockId === f.id).forEach((r) => fd.set(r.date, (fd.get(r.date) || 0) + r.kg));
  const mt = new Map();
  db.mortality.filter((r) => r.flockId === f.id).forEach((r) => mt.set(r.date, (mt.get(r.date) || 0) + r.dead + (r.culled || 0)));
  // Live birds at the start of each day, walking backwards from today's count.
  const live = statsFor(db, f.id)?.live || 0;
  const outAfter = new Map();
  db.flockMoves.filter((r) => r.flockId === f.id).forEach((r) => outAfter.set(r.date, (outAfter.get(r.date) || 0) + r.qty));
  let running = live;
  const liveAt = {};
  for (let i = keys.length - 1; i >= 0; i--) {
    running += (mt.get(keys[i]) || 0) + (outAfter.get(keys[i]) || 0);
    liveAt[keys[i]] = running;
  }
  return keys
    .filter((k) => k >= f.hatchDate)
    .map((k) => {
      const age = ageDays(f, k);
      const e = eg.get(k);
      const birds = liveAt[k] || 0;
      const eggs = e ? goodEggs(e) : null;
      return {
        date: k,
        day: k.slice(8) + '/' + k.slice(5, 7),
        age,
        eggs,
        layPct: eggs != null && birds ? round2((eggs / birds) * 100) : null,
        std: isLayingType(f) ? round2(stdLayPct(f, age / 7)) : null,
        feedG: fd.has(k) && birds ? Math.round((fd.get(k) / birds) * 1000) : null,
        feedKg: fd.get(k) ?? null,
        stdFeed: Math.round(stdFeed(f, age)),
        dead: mt.get(k) || 0,
        birds,
      };
    });
}

/** Growth curve: weighings vs breed target. */
export function growthSeries(db, f) {
  const w = db.weightLogs.filter((r) => r.flockId === f.id).sort((a, b) => a.date.localeCompare(b.date));
  return w.map((r) => {
    const age = ageDays(f, r.date);
    return { date: r.date, age, label: `Wk ${Math.floor(age / 7)}`, actual: r.avgG, std: Math.round(stdWeight(f, age)), uniformity: r.uniformity };
  });
}

export const flockName = (f) => (f ? `${f.code} · ${f.breed}` : '—');
