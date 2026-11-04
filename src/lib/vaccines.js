// Vaccination & routine health schedules. A schedule is created automatically when a flock is placed.
import { addDays, format, parseISO } from 'date-fns';

const w = (weeks) => weeks * 7;

/** Default templates (the owner can edit these in Settings). `day` = bird age in days. */
export const DEFAULT_TEMPLATES = [
  {
    id: 'vtp_broiler',
    name: 'Broilers',
    species: 'chicken',
    purposes: ['broiler'],
    items: [
      { day: 1, name: "Marek's disease", method: 'Injection (hatchery)', kind: 'vaccine' },
      { day: 7, name: 'Newcastle (HB1)', method: 'Eye drop', kind: 'vaccine' },
      { day: 10, name: 'Gumboro (IBD)', method: 'Drinking water', kind: 'vaccine' },
      { day: 14, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: 18, name: 'Gumboro booster', method: 'Drinking water', kind: 'vaccine' },
      { day: 21, name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: 24, name: 'Coccidiosis prevention', method: 'Drinking water (Amprolium)', kind: 'medication' },
    ],
  },
  {
    id: 'vtp_layer',
    name: 'Layers & breeders',
    species: 'chicken',
    purposes: ['layer', 'breeder', 'cockerel'],
    items: [
      { day: 1, name: "Marek's disease", method: 'Injection (hatchery)', kind: 'vaccine' },
      { day: 7, name: 'Newcastle (HB1)', method: 'Eye drop', kind: 'vaccine' },
      { day: 10, name: 'Gumboro (IBD)', method: 'Drinking water', kind: 'vaccine' },
      { day: 14, name: 'Newcastle + IB', method: 'Drinking water', kind: 'vaccine' },
      { day: 18, name: 'Gumboro booster', method: 'Drinking water', kind: 'vaccine' },
      { day: 28, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(6), name: 'Fowl pox', method: 'Wing web', kind: 'vaccine' },
      { day: w(8), name: 'Deworming', method: 'Drinking water (Piperazine)', kind: 'deworm' },
      { day: w(10), name: 'Fowl typhoid', method: 'Injection', kind: 'vaccine' },
      { day: w(12), name: 'Newcastle + IB booster', method: 'Drinking water', kind: 'vaccine' },
      { day: w(16), name: 'Newcastle (Komarov)', method: 'Injection', kind: 'vaccine' },
      { day: w(17), name: 'Egg drop syndrome (EDS)', method: 'Injection', kind: 'vaccine' },
      { day: w(18), name: 'Deworming', method: 'Drinking water (Piperazine)', kind: 'deworm' },
      ...[26, 34, 42, 50, 58, 66, 74].map((wk) => ({ day: w(wk), name: 'Newcastle booster (Lasota)', method: 'Drinking water', kind: 'vaccine' })),
      ...[30, 42, 54, 66].map((wk) => ({ day: w(wk) + 3, name: 'Deworming', method: 'Drinking water (Piperazine)', kind: 'deworm' })),
    ],
  },
  {
    id: 'vtp_turkey',
    name: 'Turkeys',
    species: 'turkey',
    purposes: ['meat', 'breeder', 'broiler', 'layer'],
    items: [
      { day: 7, name: 'Newcastle (HB1)', method: 'Eye drop', kind: 'vaccine' },
      { day: 21, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(6), name: 'Fowl pox', method: 'Wing web', kind: 'vaccine' },
      { day: w(8), name: 'Fowl cholera', method: 'Injection', kind: 'vaccine' },
      { day: w(10), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(12), name: 'Newcastle booster', method: 'Drinking water', kind: 'vaccine' },
    ],
  },
  {
    id: 'vtp_guinea',
    name: 'Guinea fowl',
    species: 'guinea',
    purposes: ['meat', 'layer', 'breeder', 'broiler'],
    items: [
      { day: 7, name: 'Newcastle (HB1)', method: 'Eye drop', kind: 'vaccine' },
      { day: 21, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
      { day: w(6), name: 'Fowl pox', method: 'Wing web', kind: 'vaccine' },
      { day: w(9), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(14), name: 'Newcastle booster', method: 'Drinking water', kind: 'vaccine' },
    ],
  },
  {
    id: 'vtp_duck',
    name: 'Ducks',
    species: 'duck',
    purposes: ['meat', 'layer', 'breeder', 'broiler'],
    items: [
      { day: 14, name: 'Duck plague (DVE)', method: 'Injection', kind: 'vaccine' },
      { day: w(5), name: 'Duck cholera', method: 'Injection', kind: 'vaccine' },
      { day: w(8), name: 'Deworming', method: 'Drinking water', kind: 'deworm' },
      { day: w(12), name: 'Duck plague booster', method: 'Injection', kind: 'vaccine' },
    ],
  },
  {
    id: 'vtp_quail',
    name: 'Quail',
    species: 'quail',
    purposes: ['meat', 'layer', 'breeder', 'broiler'],
    items: [
      { day: 7, name: 'Newcastle (HB1)', method: 'Drinking water', kind: 'vaccine' },
      { day: 21, name: 'Newcastle (Lasota)', method: 'Drinking water', kind: 'vaccine' },
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
