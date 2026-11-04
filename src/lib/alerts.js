// "Needs attention" list for the dashboard: built live from the data, not stored.
import { today, dayKey, num, fmtDate } from './format';
import { activeFlocks, flockIndex, ageDays } from './flock';
import { isLayingType } from './standards';
import { lowStock, itemUsage } from './stock';
import { vaccineState } from './vaccines';

export function farmAlerts(db, inScope) {
  const t = today();
  const out = [];
  const flocks = activeFlocks(db).filter((f) => inScope(f.farmId));
  const fi = flockIndex(db);
  const code = (id) => db.flocks.find((f) => f.id === id)?.code;

  db.vaccinations.filter((v) => inScope(v.farmId) && v.status === 'due' && v.dueDate <= dayKey(1) && flocks.some((f) => f.id === v.flockId)).forEach((v) => {
    const st = vaccineState(v, t);
    out.push({ level: st === 'overdue' ? 'critical' : 'warning', kind: 'vaccine', title: `${v.name} · ${code(v.flockId)}`, text: st === 'overdue' ? `Overdue since ${fmtDate(v.dueDate)}` : v.dueDate === t ? 'Due today' : 'Due tomorrow', link: '/app/health' });
  });
  lowStock(db, 'all').filter((l) => inScope(l.farm.id)).forEach(({ item, farm, balance }) => {
    const u = itemUsage(db, item, farm.id);
    out.push({ level: u.daysLeft != null && u.daysLeft <= 3 ? 'critical' : 'warning', kind: 'stock', title: `Low stock · ${item.name}`, text: `${farm.short}: ${num(Math.max(0, balance))} ${item.unit} left${u.daysLeft != null ? ` (≈${u.daysLeft} days)` : ''}`, link: '/app/inventory' });
  });
  db.items.filter((i) => i.expiry && i.expiry <= dayKey(30)).forEach((i) => out.push({ level: i.expiry < t ? 'critical' : 'info', kind: 'expiry', title: `${i.name} ${i.expiry < t ? 'expired' : 'expires soon'}`, text: fmtDate(i.expiry), link: '/app/inventory' }));
  db.treatments.filter((r) => inScope(r.farmId) && r.withdrawalUntil && r.withdrawalUntil >= t).forEach((r) => out.push({ level: 'warning', kind: 'withdrawal', title: `Withdrawal period · ${code(r.flockId)}`, text: `${r.drug} — don't sell eggs/meat until ${fmtDate(r.withdrawalUntil)}`, link: '/app/health' }));
  flocks.forEach((f) => {
    const s = fi.get(f.id);
    if (!s) return;
    if (isLayingType(f) && ageDays(f) >= 126 && s.eggsToday == null) out.push({ level: 'info', kind: 'missing', title: `No eggs recorded today · ${f.code}`, text: db.farms.find((x) => x.id === f.farmId)?.name, link: '/app/log', action: { kind: 'eggs', flockId: f.id } });
    if (!db.feedLogs.some((r) => r.flockId === f.id && r.date === t)) out.push({ level: 'info', kind: 'missing', title: `No feed recorded today · ${f.code}`, text: db.farms.find((x) => x.id === f.farmId)?.name, link: '/app/log', action: { kind: 'feed', flockId: f.id } });
    const todayDead = db.mortality.filter((m) => m.flockId === f.id && m.date === t).reduce((a, m) => a + m.dead, 0);
    if (s.live && todayDead >= 3 && (todayDead / s.live) * 100 >= db.settings.mortalityAlertPct) out.push({ level: 'critical', kind: 'mortality', title: `High mortality · ${f.code}`, text: `${todayDead} birds today`, link: `/app/flocks/${f.id}` });
    if (isLayingType(f) && s.stdLayPct > 20 && s.layPct7 < s.stdLayPct - 8) out.push({ level: 'warning', kind: 'laying', title: `Laying below target · ${f.code}`, text: `${s.layPct7}% vs ${Math.round(s.stdLayPct)}% breed standard (7-day)`, link: `/app/flocks/${f.id}` });
  });
  const lastEnv = {};
  db.envLogs.filter((e) => inScope(e.farmId) && e.date >= dayKey(-1)).forEach((e) => {
    if (!lastEnv[e.penId] || `${e.date}${e.time}` > `${lastEnv[e.penId].date}${lastEnv[e.penId].time}`) lastEnv[e.penId] = e;
  });
  Object.values(lastEnv).forEach((e) => {
    if (e.temp > db.settings.tempMax || e.temp < db.settings.tempMin) out.push({ level: 'critical', kind: 'env', title: `Temperature ${e.temp} °C · ${db.pens.find((p) => p.id === e.penId)?.name}`, text: `Safe range ${db.settings.tempMin}–${db.settings.tempMax} °C`, link: '/app/log' });
  });
  db.maintenance.filter((m) => inScope(m.farmId) && m.status === 'open').forEach((m) => out.push({ level: 'info', kind: 'maintenance', title: db.assets.find((a) => a.id === m.assetId)?.name || 'Repair', text: m.description, link: '/app/maintenance' }));
  db.assets.filter((a) => inScope(a.farmId) && a.nextService && a.nextService < t && !db.maintenance.some((m) => m.assetId === a.id && m.status === 'open')).forEach((a) => out.push({ level: 'warning', kind: 'maintenance', title: `Service overdue · ${a.name}`, text: `Was due ${fmtDate(a.nextService)}`, link: '/app/maintenance' }));
  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
