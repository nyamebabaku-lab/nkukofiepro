// Vaccinations, treatments, flocks and hatchery actions.
import { addDays, format, parseISO } from 'date-fns';
import { useDB, useSession } from '../data/store';
import { today, num, fmtDate } from './format';
import { scheduleFor } from './vaccines';

const me = () => useSession.getState().userId;
const ITEM_FOR = (name, kind) =>
  kind === 'deworm' ? 'itm_piperazine' : /coccid/i.test(name) ? 'itm_amprol' : /lasota|newcastle|komarov|hb1/i.test(name) ? 'itm_ndlasota' : /gumboro|ibd/i.test(name) ? 'itm_gumboro' : /pox/i.test(name) ? 'itm_fowlpox' : /eds|egg drop/i.test(name) ? 'itm_eds' : /duck plague/i.test(name) ? 'itm_dve' : null;

export function markVaccineDone(id, { batchNo = '', note = '', date = today(), itemId, qty } = {}) {
  const db = useDB.getState();
  const v = db.vaccinations.find((x) => x.id === id);
  if (!v) return;
  const f = db.flocks.find((x) => x.id === v.flockId);
  const item = itemId === undefined ? ITEM_FOR(v.name, v.kind) : itemId || null;
  const doses = item === 'itm_eds' ? 500 : item === 'itm_dve' ? 100 : 1000;
  db.update('vaccinations', id, { status: 'done', doneAt: date, by: me(), batchNo, note, itemId: item, qty: item ? qty || Math.max(1, Math.ceil((f?.opening || 1000) / doses)) : 0 });
  db.log('Vaccination given', `${f?.code} · ${v.name}`, { farmId: v.farmId });
}

export function skipVaccine(id, note) {
  const db = useDB.getState();
  db.update('vaccinations', id, { status: 'skipped', note, doneAt: today(), by: me() });
}

export function addTreatment(t) {
  const db = useDB.getState();
  const f = db.flocks.find((x) => x.id === t.flockId);
  const end = format(addDays(parseISO(t.date), Math.max(0, (+t.days || 1) - 1)), 'yyyy-MM-dd');
  const withdrawalUntil = +t.withdrawalDays > 0 ? format(addDays(parseISO(end), +t.withdrawalDays), 'yyyy-MM-dd') : null;
  const rec = db.add('treatments', { ...t, farmId: f.farmId, days: +t.days || 1, qty: +t.qty || 0, withdrawalDays: +t.withdrawalDays || 0, withdrawalUntil, by: me() });
  if (withdrawalUntil) db.notify({ toRoles: ['owner', 'manager'], farmId: f.farmId, tone: 'amber', title: `Withdrawal period · ${f.code}`, text: `Do not sell eggs or meat from ${f.code} until ${fmtDate(withdrawalUntil)} (${t.drug}).`, link: '/app/health?tab=treatments' });
  db.log('Treatment started', `${f.code} · ${t.drug}`, { farmId: f.farmId });
  return rec;
}

/** New flock: saves it, books the chick/bird cost and creates its vaccination schedule. */
export function addFlock(data) {
  const db = useDB.getState();
  const ageAtPlacement = +data.ageAtPlacement || 0;
  const hatchDate = format(addDays(parseISO(data.placedAt), -ageAtPlacement), 'yyyy-MM-dd');
  const f = db.add('flocks', { ...data, opening: +data.opening, costPerBird: +data.costPerBird || 0, ageAtPlacement, hatchDate, status: 'active', closedAt: null });
  const sched = scheduleFor(db.vaccineTemplates, f);
  db.addMany('vaccinations', sched);
  if (f.costPerBird > 0) db.add('expenses', { farmId: f.farmId, date: f.placedAt, category: 'birds', amount: f.opening * f.costPerBird, description: `${num(f.opening)} birds for flock ${f.code}`, paidFrom: 'bank', flockId: f.id });
  db.log('Flock placed', `${f.code} · ${num(f.opening)} ${f.breed}`, { farmId: f.farmId });
  return { flock: f, vaccines: sched.length };
}

export function closeFlock(id, { reason = 'Sold out', date = today() } = {}) {
  const db = useDB.getState();
  db.update('flocks', id, { status: 'closed', closedAt: date, closeReason: reason });
  useDB.setState((s) => ({ vaccinations: s.vaccinations.map((v) => (v.flockId === id && v.status === 'due' ? { ...v, status: 'skipped', note: 'Flock closed' } : v)) }));
  db.log('Flock closed', `${db.flocks.find((f) => f.id === id)?.code} · ${reason}`);
}

export function nextFlockCode(db, purpose, species) {
  const p = species === 'turkey' ? 'T' : species === 'guinea' ? 'G' : species === 'duck' ? 'D' : species === 'quail' ? 'Q' : purpose === 'broiler' ? 'B' : 'L';
  const yy = String(new Date().getFullYear()).slice(2);
  const n = db.flocks.filter((f) => f.code.startsWith(`${p}-${yy}`)).length + 1;
  return `${p}-${yy}${String(n).padStart(2, '0')}`;
}

// ---------------- Hatchery ----------------
export const INCUBATION_DAYS = { chicken: 21, guinea: 28, duck: 35, turkey: 28, quail: 17 };
export const hatchDue = (b) => format(addDays(parseISO(b.setDate), INCUBATION_DAYS[b.species] || 21), 'yyyy-MM-dd');
export const candleDue = (b) => format(addDays(parseISO(b.setDate), b.species === 'chicken' ? 8 : 10), 'yyyy-MM-dd');

export function recordHatch(batchId, { hatched, destination, productId, flock }) {
  const db = useDB.getState();
  const b = db.hatchBatches.find((x) => x.id === batchId);
  const patch = { hatched: +hatched, hatchDate: today(), status: 'closed', destination };
  if (destination === 'chick-stock' && productId) db.add('productMoves', { productId, farmId: b.farmId, date: today(), qty: +hatched, kind: 'in', note: `Hatch ${b.code}`, by: me() });
  if (destination === 'flock' && flock) {
    const { flock: f } = addFlock({ ...flock, opening: +hatched, placedAt: today(), ageAtPlacement: 0, source: `Own hatchery (${b.code})`, costPerBird: b.costPerEgg ? Math.round((b.eggsSet * b.costPerEgg * 100) / hatched) / 100 : 0 });
    patch.flockId = f.id;
  }
  db.update('hatchBatches', batchId, patch);
  db.log('Hatch recorded', `${b.code} · ${num(hatched)} hatched`, { farmId: b.farmId });
}
