// Saving daily farm records, with the alerts that go with them.
import { useDB, useSession } from '../data/store';
import { today, num, round2 } from './format';
import { statsFor } from './flock';
import { itemBalance } from './stock';

const me = () => useSession.getState().userId;
const flockOf = (id) => useDB.getState().flocks.find((f) => f.id === id);

/** Eggs are added to the day's record, so morning and afternoon rounds add up. */
export function logEggs({ flockId, date = today(), small = 0, medium = 0, large = 0, jumbo = 0, cracked = 0, trays }) {
  const db = useDB.getState();
  const f = flockOf(flockId);
  const ex = db.eggLogs.find((e) => e.flockId === flockId && e.date === date);
  const add = { small: +small || 0, medium: +medium || 0, large: +large || 0, jumbo: +jumbo || 0, cracked: +cracked || 0 };
  if (ex) db.update('eggLogs', ex.id, (r) => ({ small: r.small + add.small, medium: r.medium + add.medium, large: r.large + add.large, jumbo: r.jumbo + add.jumbo, cracked: r.cracked + add.cracked, rounds: (r.rounds || 1) + 1 }));
  else db.add('eggLogs', { flockId, farmId: f.farmId, date, ...add, by: me(), rounds: 1 });
  const total = Object.values(add).reduce((a, b) => a + b, 0);
  if (trays) db.add('stockMoves', { itemId: 'itm_trays', farmId: f.farmId, date, qty: -Math.ceil(trays), kind: 'use', note: `Packing eggs · ${f.code}`, by: me() });
  // Alert on a sharp drop compared with the 7-day average.
  const s = statsFor(useDB.getState(), flockId);
  const day = useDB.getState().eggLogs.find((e) => e.flockId === flockId && e.date === date);
  const dayTotal = day ? day.small + day.medium + day.large + day.jumbo : 0;
  const avg = s ? s.eggs7 / 7 : 0;
  const drop = db.settings.lowLayDrop || 5;
  if (date === today() && avg > 0 && (day?.rounds || 1) >= 2 && dayTotal < avg * (1 - drop / 100 * 2)) {
    db.notify({ toRoles: ['owner', 'manager'], farmId: f.farmId, tone: 'amber', title: `Egg drop · ${f.code}`, text: `${num(dayTotal)} eggs today vs ${num(avg)} average. Check feed, water, light and health.`, link: `/app/flocks/${f.id}` });
  }
  db.log('Eggs recorded', `${f.code} · ${num(total)} eggs`, { farmId: f.farmId });
  return total;
}

export function logFeed({ flockId, date = today(), itemId, kg, water }) {
  const db = useDB.getState();
  const f = flockOf(flockId);
  const bal = itemBalance(db, itemId, f.farmId);
  db.add('feedLogs', { flockId, farmId: f.farmId, date, itemId, kg: round2(kg), water: water ? Number(water) : null, by: me() });
  const item = db.items.find((i) => i.id === itemId);
  const left = bal - kg;
  if (item && left <= (item.reorder || 0)) {
    db.notify({ toRoles: ['owner', 'manager'], farmId: f.farmId, tone: 'amber', title: 'Feed running low', text: `${item.name} at ${db.farms.find((x) => x.id === f.farmId)?.name}: ${num(Math.max(0, left))} kg left.`, link: '/app/inventory' });
  }
  db.log('Feed recorded', `${f.code} · ${kg} kg ${item?.name || ''}`, { farmId: f.farmId });
  return { left };
}

export function logMortality({ flockId, date = today(), dead = 0, culled = 0, cause = 'Unknown', note = '' }) {
  const db = useDB.getState();
  const f = flockOf(flockId);
  const live = statsFor(db, flockId)?.live || 0;
  db.add('mortality', { flockId, farmId: f.farmId, date, dead: +dead || 0, culled: +culled || 0, cause, note, by: me() });
  const pct = live ? ((+dead || 0) / live) * 100 : 0;
  if ((+dead || 0) >= 3 && pct >= (db.settings.mortalityAlertPct || 0.3)) {
    db.notify({ toRoles: ['owner', 'manager'], farmId: f.farmId, tone: 'red', title: `Mortality alert · ${f.code}`, text: `${dead} birds died (${pct.toFixed(2)}% of the flock). Cause: ${cause}.`, link: `/app/flocks/${f.id}` });
  }
  db.log('Mortality recorded', `${f.code} · ${dead} dead, ${culled} culled`, { farmId: f.farmId });
  return pct;
}

export function logWeight({ flockId, date = today(), sample, avgG, uniformity }) {
  const db = useDB.getState();
  const f = flockOf(flockId);
  db.add('weightLogs', { flockId, farmId: f.farmId, date, sample: +sample || 0, avgG: Math.round(avgG), uniformity: uniformity ? +uniformity : null, by: me() });
  db.log('Weighing recorded', `${f.code} · ${Math.round(avgG)} g average`, { farmId: f.farmId });
}

export function logEnv({ farmId, penId, date = today(), time, temp, humidity, ammonia = 'Low', note = '' }) {
  const db = useDB.getState();
  const s = db.settings;
  db.add('envLogs', { farmId, penId, date, time, temp: +temp, humidity: humidity === '' ? null : +humidity, ammonia, note, by: me() });
  const pen = db.pens.find((p) => p.id === penId);
  const issues = [];
  if (+temp > s.tempMax) issues.push(`temperature ${temp} °C is above ${s.tempMax} °C`);
  if (+temp < s.tempMin) issues.push(`temperature ${temp} °C is below ${s.tempMin} °C`);
  if (+humidity > s.humidityMax) issues.push(`humidity ${humidity}% is above ${s.humidityMax}%`);
  if (ammonia === 'High') issues.push('ammonia smell is strong');
  if (issues.length) db.notify({ toRoles: ['owner', 'manager'], farmId, tone: 'red', title: `House conditions · ${pen?.name}`, text: `${issues.join('; ')}. Check ventilation, fans and water.`, link: '/app/log?tab=env' });
  return issues;
}

/** Simple sample-weights → average + uniformity (% within ±10% of the mean). */
export function weighSummary(list) {
  const w = list.map(Number).filter((x) => x > 0);
  if (!w.length) return null;
  const avg = w.reduce((a, b) => a + b, 0) / w.length;
  const within = w.filter((x) => Math.abs(x - avg) <= avg * 0.1).length;
  return { sample: w.length, avgG: Math.round(avg), uniformity: Math.round((within / w.length) * 100) };
}

export const MORTALITY_CAUSES = ['Unknown', 'Heat stress', 'Weak / runt', 'Pecking injury', 'Prolapse', 'Leg problem', 'Suspected disease', 'Smothering / piling', 'Predator', 'Accident'];
