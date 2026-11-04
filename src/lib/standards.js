// Breed performance targets used for "actual vs standard" charts and for the demo data.
// Figures are typical published guides (Cobb 500 / ISA Brown style); farms can treat them as a guide only.

const lerp = (table, x) => {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (x <= keys[0]) return table[keys[0]];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i]) {
      const [a, b] = [keys[i - 1], keys[i]];
      return table[a] + ((table[b] - table[a]) * (x - a)) / (b - a);
    }
  }
  return table[keys[keys.length - 1]];
};

// Body weight (grams) by age in days.
const BROILER_WT = { 0: 42, 7: 185, 14: 465, 21: 943, 28: 1524, 35: 2191, 42: 2857, 49: 3450, 56: 3900 };
const LAYER_WT = { 0: 38, 28: 300, 56: 640, 84: 980, 112: 1260, 126: 1400, 140: 1550, 175: 1850, 245: 1950, 420: 2000, 560: 2050 };
const TURKEY_WT = { 0: 55, 28: 900, 56: 3600, 84: 7000, 112: 10000, 140: 12500, 168: 14000 };
const GUINEA_WT = { 0: 25, 28: 260, 56: 650, 84: 1000, 112: 1250, 140: 1400, 200: 1550 };
const DUCK_WT = { 0: 50, 21: 700, 42: 1900, 56: 2600, 70: 3000, 98: 3400, 140: 3600 };
const QUAIL_WT = { 0: 8, 14: 70, 28: 150, 42: 190, 70: 210 };

// Hen-day laying % by age in weeks.
const LAY_PCT = { 17: 0, 18: 8, 19: 35, 20: 65, 21: 84, 22: 91, 24: 94, 30: 95, 40: 92, 50: 88, 60: 83, 70: 77, 80: 70, 90: 62 };
const GUINEA_LAY = { 30: 0, 32: 20, 36: 45, 44: 50, 60: 40, 80: 25 };
const DUCK_LAY = { 20: 0, 24: 40, 28: 70, 40: 75, 60: 62, 80: 50 };
const QUAIL_LAY = { 5: 0, 7: 50, 9: 85, 30: 80, 52: 65 };

// Feed intake (g per bird per day) by age in days.
const BROILER_FEED = { 1: 18, 7: 35, 14: 75, 21: 115, 28: 150, 35: 180, 42: 200, 49: 210 };
const LAYER_FEED = { 1: 10, 28: 32, 56: 52, 84: 65, 112: 75, 126: 85, 154: 105, 175: 115, 600: 118 };
const TURKEY_FEED = { 1: 20, 28: 90, 56: 200, 84: 300, 112: 360, 168: 400 };
const GUINEA_FEED = { 1: 8, 28: 35, 56: 60, 84: 80, 140: 95, 300: 100 };
const DUCK_FEED = { 1: 25, 21: 110, 42: 180, 70: 190, 140: 180 };
const QUAIL_FEED = { 1: 5, 21: 18, 42: 25, 100: 27 };

export const SPECIES = [
  { value: 'chicken', label: 'Chicken', emoji: '🐔' },
  { value: 'turkey', label: 'Turkey', emoji: '🦃' },
  { value: 'guinea', label: 'Guinea fowl', emoji: '🐦' },
  { value: 'duck', label: 'Duck', emoji: '🦆' },
  { value: 'quail', label: 'Quail', emoji: '🐤' },
];
export const PURPOSES = [
  { value: 'layer', label: 'Layers (eggs)' },
  { value: 'broiler', label: 'Broilers (meat)' },
  { value: 'breeder', label: 'Breeders (hatching eggs)' },
  { value: 'cockerel', label: 'Cockerels' },
  { value: 'meat', label: 'Meat birds (other)' },
];
export const speciesLabel = (v) => SPECIES.find((s) => s.value === v)?.label || v;
export const purposeLabel = (v) => PURPOSES.find((s) => s.value === v)?.label.replace(/ \(.*/, '') || v;

/** Does this kind of flock lay eggs at its age? */
export const isLayingType = (f) => ['layer', 'breeder'].includes(f.purpose);
/** Is it a meat bird we track growth/FCR for? */
export const isMeatType = (f) => ['broiler', 'meat', 'cockerel'].includes(f.purpose);

/** Target body weight in grams. */
export function stdWeight(f, ageDays) {
  if (f.species === 'turkey') return lerp(TURKEY_WT, ageDays);
  if (f.species === 'guinea') return lerp(GUINEA_WT, ageDays);
  if (f.species === 'duck') return lerp(DUCK_WT, ageDays);
  if (f.species === 'quail') return lerp(QUAIL_WT, ageDays);
  if (f.purpose === 'broiler') return lerp(BROILER_WT, ageDays);
  if (f.purpose === 'cockerel') return lerp(LAYER_WT, ageDays) * 1.15;
  return lerp(LAYER_WT, ageDays);
}

/** Target hen-day laying % at an age in weeks (0 when not laying yet). */
export function stdLayPct(f, ageWeeks) {
  if (!isLayingType(f)) return 0;
  if (f.species === 'guinea') return lerp(GUINEA_LAY, ageWeeks);
  if (f.species === 'duck') return lerp(DUCK_LAY, ageWeeks);
  if (f.species === 'quail') return lerp(QUAIL_LAY, ageWeeks);
  return lerp(LAY_PCT, ageWeeks);
}

/** Target feed in grams per bird per day. */
export function stdFeed(f, ageDays) {
  if (f.species === 'turkey') return lerp(TURKEY_FEED, ageDays);
  if (f.species === 'guinea') return lerp(GUINEA_FEED, ageDays);
  if (f.species === 'duck') return lerp(DUCK_FEED, ageDays);
  if (f.species === 'quail') return lerp(QUAIL_FEED, ageDays);
  if (f.purpose === 'broiler') return lerp(BROILER_FEED, ageDays);
  return lerp(LAYER_FEED, ageDays);
}

/** Which feed a flock should be on at an age (matches inventory item ids in the seed). */
export function feedFor(f, ageDays) {
  if (f.species === 'turkey') return 'itm_turkey';
  if (f.species !== 'chicken') return 'itm_grower';
  if (f.purpose === 'broiler') return ageDays < 21 ? 'itm_bstarter' : 'itm_bfinisher';
  if (ageDays < 42) return 'itm_cstarter';
  if (ageDays < 120) return 'itm_grower';
  return 'itm_layer';
}
