// Vaccination & routine health schedules. A schedule is created automatically when a flock is placed.
import { addDays, format, parseISO } from 'date-fns';

const w = (weeks) => weeks * 7;

/** Default templates (the owner can edit these in Settings). `day` = bird age in days.
 * Standard Ghana practice (VSD / hatchery guidance). Always confirm with your vet: local disease
 * pressure and the vaccine maker's instructions come first. Give vitamins/anti-stress the day after
 * live vaccines, give water vaccines to slightly thirsty birds (withhold water 1–2 h) and never mix
 * vaccines with chlorinated water or disinfectants. */
export const DEFAULT_TEMPLATES = [
  {
    id: 'vtp_broiler',
    name: 'Broilers',
    species: 'chicken',
    purposes: ['broiler'],
    items: [
      { day: 0, name: "Marek's disease (+ ND/IB spray if hatchery offers)", method: 'Injection at the hatchery — confirm with supplier', kind: 'vaccine' },
      { day: 1, name: 'Glucose + vitamins & anti-stress (days 1–3)', method: 'Drinking water', kind: 'medication' },
      { day: 7, name: 'Newcastle + IB (HB1/H120)', method: 'Eye drop or drinking water', kind: 'vaccine' },
      { day: 12, name: 'Gumboro (IBD)', method: 'Drinking water', kind: 'vaccine' },
      { day: 14, name: 'Coccidiosis prevention (3 days)', method: 'Drinking water (Amprolium) — skip if feed has a coccidiostat', kind: 'medication' },
      { day: 18, name: 'Gumboro booster', method: 'Drinking water', kind: 'vaccine' },
      { day: 21, name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: 28, name: 'Coccidiosis prevention (3 days)', method: 'Drinking water (Amprolium) — stop 7+ days before sale', kind: 'medication' },
    ],
  },
  {
    id: 'vtp_layer',
    name: 'Layers & breeders',
    species: 'chicken',
    purposes: ['layer', 'breeder'],
    items: [
      { day: 0, name: "Marek's disease", method: 'Injection at the hatchery — confirm with supplier', kind: 'vaccine' },
      { day: 1, name: 'Glucose + vitamins & anti-stress (days 1–3)', method: 'Drinking water', kind: 'medication' },
      { day: 7, name: 'Newcastle + IB (HB1/H120)', method: 'Eye drop or drinking water', kind: 'vaccine' },
      { day: 12, name: 'Gumboro (IBD)', method: 'Drinking water', kind: 'vaccine' },
      { day: 14, name: 'Coccidiosis prevention (3 days)', method: 'Drinking water (Amprolium)', kind: 'medication' },
      { day: 18, name: 'Gumboro booster', method: 'Drinking water', kind: 'vaccine' },
      { day: 24, name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(5), name: 'Coccidiosis prevention (3 days)', method: 'Drinking water (Amprolium)', kind: 'medication' },
      { day: w(6), name: 'Fowl pox', method: 'Wing-web stab', kind: 'vaccine' },
      { day: w(8), name: 'Deworming', method: 'Drinking water (Piperazine / Levamisole)', kind: 'deworm' },
      { day: w(9), name: 'Fowl typhoid (9R)', method: 'Injection (under the skin)', kind: 'vaccine' },
      { day: w(10), name: 'Newcastle + IB booster', method: 'Drinking water', kind: 'vaccine' },
      { day: w(14), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(16), name: 'Newcastle inactivated (oil) + EDS-76', method: 'Injection (breast muscle) before lay', kind: 'vaccine' },
      { day: w(17), name: 'Fowl typhoid booster', method: 'Injection', kind: 'vaccine' },
      { day: w(18), name: 'Deworming before lay', method: 'Drinking water', kind: 'deworm' },
      ...[26, 34, 42, 50, 58, 66, 74].map((wk) => ({ day: w(wk), name: 'Newcastle booster (Lasota) — every 8 weeks in lay', method: 'Drinking water', kind: 'vaccine' })),
      ...[30, 42, 54, 66].map((wk) => ({ day: w(wk) + 3, name: 'Deworming — every 3 months in lay', method: 'Drinking water (Piperazine)', kind: 'deworm' })),
    ],
  },
  {
    id: 'vtp_cockerel',
    name: 'Cockerels & local birds',
    species: 'chicken',
    purposes: ['cockerel', 'meat'],
    items: [
      { day: 0, name: "Marek's disease", method: 'Injection at the hatchery — confirm with supplier', kind: 'vaccine' },
      { day: 1, name: 'Glucose + vitamins & anti-stress (days 1–3)', method: 'Drinking water', kind: 'medication' },
      { day: 7, name: 'Newcastle + IB (HB1/H120)', method: 'Eye drop or drinking water', kind: 'vaccine' },
      { day: 12, name: 'Gumboro (IBD)', method: 'Drinking water', kind: 'vaccine' },
      { day: 14, name: 'Coccidiosis prevention (3 days)', method: 'Drinking water (Amprolium)', kind: 'medication' },
      { day: 18, name: 'Gumboro booster', method: 'Drinking water', kind: 'vaccine' },
      { day: 24, name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(6), name: 'Fowl pox', method: 'Wing-web stab', kind: 'vaccine' },
      { day: w(8), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(9), name: 'Fowl typhoid (9R)', method: 'Injection', kind: 'vaccine' },
      { day: w(11), name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' },
    ],
  },
  {
    id: 'vtp_turkey',
    name: 'Turkeys',
    species: 'turkey',
    purposes: ['meat', 'breeder', 'broiler', 'layer', 'cockerel'],
    items: [
      { day: 1, name: 'Glucose + vitamins & anti-stress (days 1–3)', method: 'Drinking water', kind: 'medication' },
      { day: 7, name: 'Newcastle (HB1)', method: 'Eye drop', kind: 'vaccine' },
      { day: 14, name: 'Coccidiosis prevention (3 days)', method: 'Drinking water (Amprolium)', kind: 'medication' },
      { day: 21, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(6), name: 'Fowl pox', method: 'Wing-web stab', kind: 'vaccine' },
      { day: w(8), name: 'Fowl cholera (where common)', method: 'Injection', kind: 'vaccine' },
      { day: w(8) + 3, name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(12), name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(16), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
    ],
  },
  {
    id: 'vtp_guinea',
    name: 'Guinea fowl',
    species: 'guinea',
    purposes: ['meat', 'layer', 'breeder', 'broiler', 'cockerel'],
    items: [
      { day: 1, name: 'Glucose + vitamins & anti-stress (days 1–3)', method: 'Drinking water', kind: 'medication' },
      { day: 7, name: 'Newcastle (HB1)', method: 'Eye drop', kind: 'vaccine' },
      { day: 14, name: 'Gumboro (IBD)', method: 'Drinking water', kind: 'vaccine' },
      { day: 21, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(6), name: 'Fowl pox', method: 'Wing-web stab', kind: 'vaccine' },
      { day: w(9), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(14), name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' },
    ],
  },
  {
    id: 'vtp_duck',
    name: 'Ducks',
    species: 'duck',
    purposes: ['meat', 'layer', 'breeder', 'broiler', 'cockerel'],
    items: [
      { day: 1, name: 'Glucose + vitamins & anti-stress (days 1–3)', method: 'Drinking water', kind: 'medication' },
      { day: 14, name: 'Duck plague (DVE)', method: 'Injection', kind: 'vaccine' },
      { day: w(5), name: 'Duck cholera (where common)', method: 'Injection', kind: 'vaccine' },
      { day: w(8), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(12), name: 'Duck plague booster', method: 'Injection', kind: 'vaccine' },
    ],
  },
  {
    id: 'vtp_quail',
    name: 'Quail',
    species: 'quail',
    purposes: ['meat', 'layer', 'breeder', 'broiler', 'cockerel'],
    items: [
      { day: 1, name: 'Glucose + vitamins (days 1–3)', method: 'Drinking water', kind: 'medication' },
      { day: 7, name: 'Newcastle (HB1)', method: 'Drinking water', kind: 'vaccine' },
      { day: 21, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(8), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
    ],
  },
];

export const templateFor = (templates, flock) =>
  templates.find((t) => t.species === flock.species && t.purposes.includes(flock.purpose)) || templates.find((t) => t.species === flock.species);

/**
 * Builds the vaccination list for a flock. `hatchDate` = the birds' day-old date.
 * Items earlier than `fromAge` (birds bought older) are marked as done before arrival.
 */
export function scheduleFor(templates, flock) {
  const t = templateFor(templates, flock);
  if (!t) return [];
  const hatch = parseISO(flock.hatchDate);
  const fromAge = flock.ageAtPlacement || 0;
  return t.items.map((it) => ({
    flockId: flock.id,
    farmId: flock.farmId,
    name: it.name,
    method: it.method,
    kind: it.kind,
    ageDay: it.day,
    dueDate: format(addDays(hatch, it.day), 'yyyy-MM-dd'),
    status: it.day < fromAge ? 'done' : 'due',
    doneAt: it.day < fromAge ? format(addDays(hatch, it.day), 'yyyy-MM-dd') : null,
    by: it.day < fromAge ? 'Supplier' : null,
    note: it.day < fromAge ? 'Given before arrival' : '',
  }));
}

/** due → 'overdue' once its date has passed. */
export const vaccineState = (v, todayKey) => (v.status === 'due' && v.dueDate < todayKey ? 'overdue' : v.status);
