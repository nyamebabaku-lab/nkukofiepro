// Demo data: three farms with 60 days of realistic records, generated relative to today
// so the dashboard always looks "live". A seeded random generator keeps it repeatable.
import { addDays, format, parseISO } from 'date-fns';
import { stdFeed, stdLayPct, stdWeight, feedFor, isLayingType } from '../lib/standards';
import { DEFAULT_TEMPLATES, scheduleFor } from '../lib/vaccines';

const WINDOW = 60;

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLLECTIONS = ['farms', 'pens', 'flocks', 'feedLogs', 'eggLogs', 'weightLogs', 'mortality', 'envLogs', 'flockMoves', 'vaccinations', 'treatments', 'hatchBatches',
  'items', 'stockMoves', 'suppliers', 'products', 'productMoves', 'customers', 'orders', 'payments', 'walletTx', 'expenses',
  'users', 'tasks', 'taskRuns', 'attendance', 'advances', 'payruns', 'assets', 'maintenance', 'notifications', 'smsLog', 'audit', 'shopStock'];

/** Default settings for a new, real business (also the base the demo builds on). */
export const defaultSettings = () => ({
  businessName: 'My Poultry Farm',
  tagline: 'Fresh eggs, healthy birds, straight from the farm',
  phone: '',
  email: '',
  currency: 'GH₵',
  depositPct: 30,
  pickupCapacity: 25,
  openDays: [1, 2, 3, 4, 5, 6],
  blockedDates: [],
  pickupHours: '7:00 am – 5:00 pm',
  mortalityAlertPct: 0.3,
  tempMin: 18,
  tempMax: 32,
  humidityMax: 80,
  lowLayDrop: 5,
  withdrawalPin: '1234',
  minWithdrawal: 10,
  ssnitPct: 5.5,
  feedBagKg: 50,
  allowCashBooking: true,
  cashHoldHours: 24,
});

/** An empty business: no farms, flocks or people yet. */
export function buildEmpty() {
  return { ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])), settings: defaultSettings(), vaccineTemplates: DEFAULT_TEMPLATES };
}

export function buildSeed() {
  const R = rng(20261104);
  const between = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const poisson = (l) => {
    let k = 0;
    let p = 1;
    const L = Math.exp(-l);
    do {
      k++;
      p *= R();
    } while (p > L);
    return k - 1;
  };
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const D = (n) => format(addDays(now, n), 'yyyy-MM-dd');
  const T = (n, hh = 9, mm = 0) => {
    const d = addDays(now, n);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };
  let seq = 1000;
  const id = (p) => `${p}_s${(seq++).toString(36)}`;
  const r1 = (n) => Math.round(n * 10) / 10;
  const r2 = (n) => Math.round(n * 100) / 100;

  // ---------------- Settings ----------------
  const settings = {
    ...defaultSettings(),
    businessName: 'PoultryPro Farms',
    tagline: 'Fresh eggs, healthy birds, straight from the farm',
    phone: '0302 123 456',
    email: 'hello@poultrypro.app',
    currency: 'GH₵',
    depositPct: 30,
    pickupCapacity: 25,
    openDays: [1, 2, 3, 4, 5, 6],
    blockedDates: [D(10)],
    pickupHours: '7:00 am – 5:00 pm',
    mortalityAlertPct: 0.3,
    tempMin: 18,
    tempMax: 32,
    humidityMax: 80,
    lowLayDrop: 5,
    withdrawalPin: '1234',
    minWithdrawal: 10,
    ssnitPct: 5.5,
    feedBagKg: 50,
    allowCashBooking: true,
    cashHoldHours: 24,
  };

  // ---------------- Staff ----------------
  const users = [
    { id: 'usr_owner', name: 'Kwame Asante', role: 'owner', email: 'owner@poultrypro.app', phone: '0244000111', position: 'Owner / Managing Director', farmIds: ['frm_dodowa', 'frm_ejisu', 'frm_kasoa'], salary: 0, startDate: '2019-02-01' },
    { id: 'usr_akosua', name: 'Akosua Mensah', role: 'manager', email: 'akosua@poultrypro.app', phone: '0244210987', position: 'Farm Manager', farmIds: ['frm_dodowa', 'frm_kasoa'], salary: 3800, startDate: '2020-06-15' },
    { id: 'usr_yaw', name: 'Yaw Darko', role: 'manager', email: 'yaw@poultrypro.app', phone: '0201554433', position: 'Farm Manager', farmIds: ['frm_ejisu'], salary: 3500, startDate: '2022-01-10' },
    { id: 'usr_kojo', name: 'Kojo Antwi', role: 'worker', email: 'kojo@poultrypro.app', phone: '0547123321', position: 'Poultry Attendant', farmIds: ['frm_dodowa'], salary: 1800, startDate: '2021-03-01' },
    { id: 'usr_ama', name: 'Ama Serwaa', role: 'worker', email: 'ama@poultrypro.app', phone: '0559876543', position: 'Egg Collector & Packer', farmIds: ['frm_dodowa'], salary: 1600, startDate: '2022-09-05' },
    { id: 'usr_selorm', name: 'Selorm Agbeko', role: 'worker', email: 'selorm@poultrypro.app', phone: '0248765123', position: 'Hatchery Technician', farmIds: ['frm_dodowa'], salary: 2400, startDate: '2023-02-20' },
    { id: 'usr_ibrahim', name: 'Ibrahim Fuseini', role: 'worker', email: 'ibrahim@poultrypro.app', phone: '0209988776', position: 'Poultry Attendant', farmIds: ['frm_ejisu'], salary: 1700, startDate: '2023-05-02' },
    { id: 'usr_kwabena', name: 'Kwabena Owusu', role: 'worker', email: 'kwabena@poultrypro.app', phone: '0541112223', position: 'Driver & Sales', farmIds: ['frm_ejisu'], salary: 2000, startDate: '2021-11-11' },
    { id: 'usr_efua', name: 'Efua Nyarko', role: 'worker', email: 'efua@poultrypro.app', phone: '0275544332', position: 'Poultry Attendant', farmIds: ['frm_kasoa'], salary: 1700, startDate: '2024-01-08' },
  ].map((u) => ({ ...u, password: 'demo123', status: 'active', momo: { network: 'mtn', number: u.phone }, createdAt: T(-400) }));

  // ---------------- Farms & pens ----------------
  const farms = [
    { id: 'frm_dodowa', name: 'Dodowa Main Farm', short: 'Dodowa', location: 'Dodowa, Greater Accra', managerId: 'usr_akosua', clockCode: '482913', color: '#2f6146', phone: '0302 123 456', established: '2019', acres: 6 },
    { id: 'frm_ejisu', name: 'Ejisu Farm', short: 'Ejisu', location: 'Ejisu, Ashanti', managerId: 'usr_yaw', clockCode: '731045', color: '#c8643b', phone: '0322 456 789', established: '2021', acres: 4 },
    { id: 'frm_kasoa', name: 'Kasoa Farm', short: 'Kasoa', location: 'Kasoa, Central', managerId: 'usr_akosua', clockCode: '559207', color: '#d9a441', phone: '0302 987 654', established: '2023', acres: 3 },
  ].map((f) => ({ ...f, createdAt: T(-700) }));
  const pens = [
    { id: 'pen_da', farmId: 'frm_dodowa', name: 'House A', type: 'Layer house (deep litter)', capacity: 3000 },
    { id: 'pen_db', farmId: 'frm_dodowa', name: 'House B', type: 'Layer house (battery cage)', capacity: 3200 },
    { id: 'pen_dbr', farmId: 'frm_dodowa', name: 'Brooder 1', type: 'Brooder', capacity: 2000 },
    { id: 'pen_dh', farmId: 'frm_dodowa', name: 'Hatchery Room', type: 'Hatchery', capacity: 0 },
    { id: 'pen_e1', farmId: 'frm_ejisu', name: 'Broiler House 1', type: 'Broiler house', capacity: 2500 },
    { id: 'pen_e2', farmId: 'frm_ejisu', name: 'Broiler House 2', type: 'Broiler house', capacity: 2500 },
    { id: 'pen_et', farmId: 'frm_ejisu', name: 'Turkey Run', type: 'Free range run', capacity: 400 },
    { id: 'pen_k1', farmId: 'frm_kasoa', name: 'Layer House K1', type: 'Layer house (deep litter)', capacity: 2000 },
    { id: 'pen_kg', farmId: 'frm_kasoa', name: 'Guinea Pen', type: 'Semi-intensive pen', capacity: 500 },
    { id: 'pen_kd', farmId: 'frm_kasoa', name: 'Duck Pond', type: 'Pond & shelter', capacity: 300 },
  ];
  const workerFor = { frm_dodowa: ['usr_kojo', 'usr_ama'], frm_ejisu: ['usr_ibrahim', 'usr_kwabena'], frm_kasoa: ['usr_efua'] };

  // ---------------- Flocks ----------------
  // ageNow = bird age today (days). placedAge = age when it arrived on the farm.
  const flockDefs = [
    { id: 'flk_l2501', code: 'L-2501', farmId: 'frm_dodowa', penId: 'pen_da', species: 'chicken', purpose: 'layer', breed: 'ISA Brown', ageNow: 280, placedAge: 0, opening: 2800, costPerBird: 14, source: 'Akate Farms (day-old)', perf: 1.01, preLoss: 0.035 },
    { id: 'flk_l2502', code: 'L-2502', farmId: 'frm_dodowa', penId: 'pen_db', species: 'chicken', purpose: 'layer', breed: 'Lohmann Brown', ageNow: 196, placedAge: 112, opening: 3000, costPerBird: 95, source: 'Point-of-lay, Darko Farms', perf: 1.0, preLoss: 0 },
    { id: 'flk_p2601', code: 'P-2601', farmId: 'frm_dodowa', penId: 'pen_dbr', species: 'chicken', purpose: 'layer', breed: 'ISA Brown', ageNow: 35, placedAge: 0, opening: 1500, costPerBird: 16, source: 'Akate Farms (day-old)', perf: 1.0, preLoss: 0 },
    { id: 'flk_b2610', code: 'B-2610', farmId: 'frm_ejisu', penId: 'pen_e1', species: 'chicken', purpose: 'broiler', breed: 'Cobb 500', ageNow: 33, placedAge: 0, opening: 2400, costPerBird: 13.5, source: 'Own hatchery (Dodowa)', perf: 0.98, preLoss: 0 },
    { id: 'flk_b2611', code: 'B-2611', farmId: 'frm_ejisu', penId: 'pen_e2', species: 'chicken', purpose: 'broiler', breed: 'Ross 308', ageNow: 12, placedAge: 0, opening: 2400, costPerBird: 13.5, source: 'Own hatchery (Dodowa)', perf: 1.02, preLoss: 0 },
    { id: 'flk_t2602', code: 'T-2602', farmId: 'frm_ejisu', penId: 'pen_et', species: 'turkey', purpose: 'meat', breed: 'Broad Breasted Bronze', ageNow: 98, placedAge: 0, opening: 350, costPerBird: 45, source: 'Imported poults', perf: 0.97, preLoss: 0.04 },
    { id: 'flk_l2503', code: 'L-2503', farmId: 'frm_kasoa', penId: 'pen_k1', species: 'chicken', purpose: 'layer', breed: 'ISA Brown', ageNow: 420, placedAge: 0, opening: 1800, costPerBird: 14, source: 'Akate Farms (day-old)', perf: 0.96, preLoss: 0.06 },
    { id: 'flk_g2601', code: 'G-2601', farmId: 'frm_kasoa', penId: 'pen_kg', species: 'guinea', purpose: 'meat', breed: 'Pearl guinea fowl', ageNow: 112, placedAge: 0, opening: 450, costPerBird: 12, source: 'Own hatchery (Dodowa)', perf: 1.0, preLoss: 0.05 },
    { id: 'flk_d2601', code: 'D-2601', farmId: 'frm_kasoa', penId: 'pen_kd', species: 'duck', purpose: 'meat', breed: 'Muscovy', ageNow: 70, placedAge: 0, opening: 220, costPerBird: 25, source: 'Local breeder, Winneba', perf: 1.0, preLoss: 0.03 },
    { id: 'flk_b2605', code: 'B-2605', farmId: 'frm_ejisu', penId: 'pen_e1', species: 'chicken', purpose: 'broiler', breed: 'Cobb 500', ageNow: 84, placedAge: 0, opening: 2400, costPerBird: 13, source: 'Own hatchery (Dodowa)', perf: 1.0, preLoss: 0.03, closeAt: -42 },
  ];
  const flocks = flockDefs.map((d) => ({
    id: d.id, code: d.code, farmId: d.farmId, penId: d.penId, species: d.species, purpose: d.purpose, breed: d.breed,
    hatchDate: D(-d.ageNow), placedAt: D(-d.ageNow + d.placedAge), ageAtPlacement: d.placedAge, opening: d.opening,
    costPerBird: d.costPerBird, source: d.source, status: d.closeAt ? 'closed' : 'active', closedAt: d.closeAt ? D(d.closeAt) : null, notes: '', createdAt: T(-d.ageNow + d.placedAge),
  }));

  // ---------------- Daily records ----------------
  const feedLogs = [];
  const eggLogs = [];
  const weightLogs = [];
  const mortality = [];
  const flockMoves = [];
  const envLogs = [];
  const eggsByFarmDay = {}; // `${farm}|${day}` → { small, medium, large, jumbo, cracked }

  const CAUSES_LAYER = ['Unknown', 'Pecking injury', 'Prolapse', 'Weak bird', 'Heat stress'];
  const CAUSES_YOUNG = ['Weak / runt', 'Unknown', 'Leg problem', 'Pasting / dehydration', 'Smothering'];

  for (const d of flockDefs) {
    const f = flocks.find((x) => x.id === d.id);
    const start = Math.max(-WINDOW + 1, -d.ageNow + d.placedAge);
    const end = d.closeAt ?? 0;
    let live = d.opening;
    if (d.preLoss) {
      const pre = Math.round(d.opening * d.preLoss);
      mortality.push({ id: id('mt'), flockId: f.id, farmId: f.farmId, date: D(start - 1), dead: pre, culled: 0, cause: 'Losses before this record period', by: 'Import' });
      live -= pre;
    }
    const workers = workerFor[f.farmId];
    for (let day = start; day <= end; day++) {
      const age = d.ageNow + day;
      const date = D(day);
      const by = pick(workers);
      // Mortality
      let rate = f.species !== 'chicken' ? 0.0006 : f.purpose === 'broiler' ? (age < 8 ? 0.0025 : 0.0011) : age < 21 ? 0.0012 : 0.00028;
      let dead = poisson(live * rate);
      let cause = pick(age < 21 ? CAUSES_YOUNG : CAUSES_LAYER);
      let culled = 0;
      if (f.id === 'flk_b2610' && day === -9) [dead, cause] = [17, 'Heat stress'];
      if (f.id === 'flk_l2503' && day >= -21 && day <= -18) [dead, cause] = [dead + 4, 'Suspected coccidiosis'];
      if (f.id === 'flk_l2503' && day === -14) [culled, cause] = [120, 'Culled low producers (sold as spent hens)'];
      if (isLayingType(f) && age > 140 && day % 9 === 0 && !culled) culled = Math.floor(between(2, 7));
      if (dead || culled) {
        mortality.push({ id: id('mt'), flockId: f.id, farmId: f.farmId, date, dead, culled, cause: culled && !dead ? 'Culled (non-layers / sick)' : cause, by });
        live -= dead + culled;
      }
      // Feed (today's feed only logged at some farms yet)
      if (day < 0 || f.farmId !== 'frm_kasoa') {
        const kg = r1((live * stdFeed(f, age) * between(0.96, 1.04)) / 1000);
        feedLogs.push({ id: id('fd'), flockId: f.id, farmId: f.farmId, date, itemId: feedFor(f, age), kg, water: Math.round(kg * between(1.8, 2.2)), by });
      }
      // Eggs
      if (isLayingType(f) && age / 7 >= 18 && (day < 0 || f.farmId === 'frm_dodowa')) {
        let pct = (stdLayPct(f, age / 7) / 100) * d.perf * between(0.975, 1.02);
        if (f.id === 'flk_l2503' && day >= -21 && day <= -15) pct *= 0.86;
        let total = Math.round(live * pct * (day === 0 ? 0.62 : 1));
        const wk = age / 7;
        const mix = wk < 22 ? [0.38, 0.44, 0.16, 0.02] : wk < 30 ? [0.12, 0.42, 0.38, 0.08] : wk < 50 ? [0.05, 0.3, 0.5, 0.15] : [0.03, 0.25, 0.52, 0.2];
        const cracked = Math.round(total * between(0.012, 0.026));
        total -= cracked;
        const small = Math.round(total * mix[0]);
        const medium = Math.round(total * mix[1]);
        const large = Math.round(total * mix[2]);
        const jumbo = Math.max(0, total - small - medium - large);
        eggLogs.push({ id: id('egg'), flockId: f.id, farmId: f.farmId, date, small, medium, large, jumbo, cracked, by: f.farmId === 'frm_dodowa' ? 'usr_ama' : by });
        const k = `${f.farmId}|${day}`;
        const acc = (eggsByFarmDay[k] ||= { small: 0, medium: 0, large: 0, jumbo: 0, cracked: 0 });
        acc.small += small;
        acc.medium += medium;
        acc.large += large;
        acc.jumbo += jumbo;
        acc.cracked += cracked;
      }
      // Weighing: weekly for growing / meat birds, monthly for layers
      const weighDay = f.purpose === 'layer' && age > 126 ? age % 28 === 0 : age % 7 === 0 && age > 0;
      if (weighDay) {
        const avgG = Math.round(stdWeight(f, age) * d.perf * between(0.97, 1.02));
        weightLogs.push({ id: id('wt'), flockId: f.id, farmId: f.farmId, date, sample: 50, avgG, uniformity: Math.round(between(78, 91)), by });
      }
    }
    if (d.closeAt) {
      flockMoves.push({ id: id('fmv'), flockId: f.id, farmId: f.farmId, date: D(d.closeAt), qty: live - 140, kind: 'sold', note: 'Bulk sale · Ashanti Agro Processors' });
      flockMoves.push({ id: id('fmv'), flockId: f.id, farmId: f.farmId, date: D(d.closeAt), qty: 140, kind: 'processed', note: 'Processed on farm → dressed chicken' });
    }
  }
  // Environment readings (last 14 days, 2 pm)
  for (const p of pens.filter((x) => x.type !== 'Hatchery')) {
    for (let day = -13; day <= 0; day++) {
      if (day === 0 && p.farmId === 'frm_kasoa') continue;
      const hot = p.farmId === 'frm_ejisu' ? 1.2 : 0;
      let temp = r1(between(27, 31.2) + hot);
      if (p.id === 'pen_e1' && day === -9) temp = 35.4;
      if (p.id === 'pen_dbr') temp = r1(between(29, 32));
      envLogs.push({ id: id('env'), farmId: p.farmId, penId: p.id, date: D(day), time: '14:00', temp, humidity: Math.round(between(62, 79)), ammonia: pick(['Low', 'Low', 'Low', 'Moderate']), note: p.id === 'pen_e1' && day === -9 ? 'Very hot afternoon — fans on, extra water added' : '', by: pick(workerFor[p.farmId]) });
    }
  }

  // ---------------- Inventory ----------------
  const ALL = ['frm_dodowa', 'frm_ejisu', 'frm_kasoa'];
  const items = [
    { id: 'itm_cstarter', name: 'Chick starter mash', category: 'feed', unit: 'kg', cost: 9.4, reorder: 500, farmIds: ['frm_dodowa'] },
    { id: 'itm_bstarter', name: 'Broiler starter', category: 'feed', unit: 'kg', cost: 9.8, reorder: 600, farmIds: ['frm_ejisu'] },
    { id: 'itm_bfinisher', name: 'Broiler finisher', category: 'feed', unit: 'kg', cost: 9.0, reorder: 1500, farmIds: ['frm_ejisu'] },
    { id: 'itm_grower', name: 'Grower mash', category: 'feed', unit: 'kg', cost: 7.6, reorder: 500, farmIds: ALL },
    { id: 'itm_layer', name: 'Layer mash', category: 'feed', unit: 'kg', cost: 7.8, reorder: 1500, farmIds: ['frm_dodowa', 'frm_kasoa'] },
    { id: 'itm_turkey', name: 'Turkey grower', category: 'feed', unit: 'kg', cost: 9.2, reorder: 300, farmIds: ['frm_ejisu'] },
    { id: 'itm_ndlasota', name: 'Newcastle Lasota (1000 doses)', category: 'vaccine', unit: 'vial', cost: 48, reorder: 4, farmIds: ALL, expiry: D(140) },
    { id: 'itm_gumboro', name: 'Gumboro IBD (1000 doses)', category: 'vaccine', unit: 'vial', cost: 55, reorder: 3, farmIds: ['frm_dodowa', 'frm_ejisu'], expiry: D(95) },
    { id: 'itm_fowlpox', name: 'Fowl pox (1000 doses)', category: 'vaccine', unit: 'vial', cost: 65, reorder: 2, farmIds: ['frm_dodowa', 'frm_kasoa'], expiry: D(25) },
    { id: 'itm_eds', name: 'Egg drop syndrome (500 doses)', category: 'vaccine', unit: 'vial', cost: 140, reorder: 1, farmIds: ['frm_dodowa'], expiry: D(200) },
    { id: 'itm_dve', name: 'Duck plague DVE (100 doses)', category: 'vaccine', unit: 'vial', cost: 70, reorder: 1, farmIds: ['frm_kasoa'], expiry: D(160) },
    { id: 'itm_oxytet', name: 'Oxytetracycline 20% (100 g)', category: 'drug', unit: 'sachet', cost: 28, reorder: 10, farmIds: ALL, expiry: D(320) },
    { id: 'itm_amprol', name: 'Amprolium anticoccidial (100 g)', category: 'drug', unit: 'sachet', cost: 32, reorder: 8, farmIds: ALL, expiry: D(260) },
    { id: 'itm_vitamin', name: 'Vitamins & electrolytes (100 g)', category: 'drug', unit: 'sachet', cost: 22, reorder: 15, farmIds: ALL, expiry: D(400) },
    { id: 'itm_piperazine', name: 'Piperazine dewormer (100 g)', category: 'drug', unit: 'sachet', cost: 30, reorder: 6, farmIds: ALL, expiry: D(18) },
    { id: 'itm_tylosin', name: 'Tylosin (100 g)', category: 'drug', unit: 'sachet', cost: 48, reorder: 4, farmIds: ['frm_dodowa', 'frm_ejisu'], expiry: D(300) },
    { id: 'itm_trays', name: 'Egg trays (30-egg)', category: 'packaging', unit: 'piece', cost: 0.9, reorder: 1500, farmIds: ['frm_dodowa', 'frm_kasoa'] },
    { id: 'itm_disinfect', name: 'Disinfectant (1 kg)', category: 'cleaning', unit: 'kg', cost: 210, reorder: 3, farmIds: ALL },
    { id: 'itm_shavings', name: 'Wood shavings', category: 'cleaning', unit: 'bag', cost: 15, reorder: 40, farmIds: ALL },
    { id: 'itm_drinker', name: 'Bell drinker', category: 'equipment', unit: 'piece', cost: 95, reorder: 5, farmIds: ALL },
    { id: 'itm_bulb', name: 'Brooder bulb (250 W)', category: 'equipment', unit: 'piece', cost: 25, reorder: 10, farmIds: ['frm_dodowa', 'frm_ejisu'] },
  ];
  const suppliers = [
    { id: 'sup_feed', name: 'GoldenGrain Feed Mills', phone: '0302 555 010', supplies: 'Feed', location: 'Tema' },
    { id: 'sup_vet', name: 'VetCare Agro Supplies', phone: '0244 777 321', supplies: 'Vaccines & drugs', location: 'Accra' },
    { id: 'sup_pack', name: 'Pack-It Ghana', phone: '0208 345 678', supplies: 'Egg trays & packaging', location: 'Kumasi' },
    { id: 'sup_equip', name: 'FarmTools Depot', phone: '0544 908 112', supplies: 'Equipment', location: 'Kumasi' },
  ].map((s) => ({ ...s, createdAt: T(-500) }));
  const stockMoves = [];
  const expenses = [];
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));
  const purchase = (itemId, farmId, day, qty, supplierId) => {
    const it = itemById[itemId];
    const cost = r2(qty * it.cost);
    stockMoves.push({ id: id('smv'), itemId, farmId, date: D(day), qty, kind: 'purchase', cost, supplierId, ref: `GRN-${seq}`, by: 'usr_akosua' });
    expenses.push({ id: id('exp'), farmId, date: D(day), category: it.category === 'feed' ? 'feed' : ['vaccine', 'drug'].includes(it.category) ? 'health' : it.category === 'packaging' ? 'packaging' : 'equipment', amount: cost, description: `${it.name} × ${qty} ${it.unit}`, paidFrom: 'bank', supplierId, createdAt: T(day, 10) });
  };
  // Feed deliveries sized to match the usage logged, leaving some days of cover (Ejisu finisher is deliberately low).
  const deliveries = [-60, -50, -40, -30, -20, -11, -4];
  const use = {};
  feedLogs.forEach((r) => {
    const k = `${r.itemId}|${r.farmId}`;
    (use[k] ||= {});
    const di = deliveries.filter((x) => x <= Math.round((parseISO(r.date) - parseISO(D(0))) / 864e5)).length - 1;
    use[k][Math.max(0, di)] = (use[k][Math.max(0, di)] || 0) + r.kg;
  });
  Object.entries(use).forEach(([k, byWin]) => {
    const [itemId, farmId] = k.split('|');
    const last7 = feedLogs.filter((r) => r.itemId === itemId && r.farmId === farmId && r.date >= D(-6));
    const perDay = last7.reduce((a, r) => a + r.kg, 0) / 7;
    const cover = itemId === 'itm_bfinisher' ? 2.5 : itemId === 'itm_cstarter' ? 6 : 14 + R() * 6;
    const keys = Object.keys(byWin).map(Number).sort((a, b) => a - b);
    keys.forEach((wi, i) => {
      let qty = byWin[wi] + (i === keys.length - 1 ? perDay * cover : 0);
      qty = Math.max(50, Math.ceil(qty / 50) * 50);
      purchase(itemId, farmId, deliveries[wi], qty, 'sup_feed');
    });
  });
  // Other supplies
  [
    ['itm_ndlasota', 'frm_dodowa', -45, 22], ['itm_grower', 'frm_dodowa', -10, 1500], ['itm_grower', 'frm_ejisu', -10, 300], ['itm_ndlasota', 'frm_ejisu', -40, 10], ['itm_ndlasota', 'frm_kasoa', -50, 6],
    ['itm_gumboro', 'frm_dodowa', -45, 6], ['itm_gumboro', 'frm_ejisu', -40, 8], ['itm_fowlpox', 'frm_dodowa', -30, 4], ['itm_fowlpox', 'frm_kasoa', -50, 2],
    ['itm_eds', 'frm_dodowa', -55, 3], ['itm_dve', 'frm_kasoa', -50, 3],
    ['itm_oxytet', 'frm_dodowa', -50, 20], ['itm_oxytet', 'frm_ejisu', -35, 16], ['itm_oxytet', 'frm_kasoa', -50, 12],
    ['itm_amprol', 'frm_dodowa', -50, 14], ['itm_amprol', 'frm_ejisu', -35, 14], ['itm_amprol', 'frm_kasoa', -50, 16],
    ['itm_vitamin', 'frm_dodowa', -50, 30], ['itm_vitamin', 'frm_ejisu', -35, 30], ['itm_vitamin', 'frm_kasoa', -50, 20],
    ['itm_piperazine', 'frm_dodowa', -50, 10], ['itm_piperazine', 'frm_ejisu', -35, 8], ['itm_piperazine', 'frm_kasoa', -50, 9],
    ['itm_tylosin', 'frm_dodowa', -50, 6], ['itm_tylosin', 'frm_ejisu', -35, 6],
    ['itm_trays', 'frm_dodowa', -58, 8000], ['itm_trays', 'frm_dodowa', -30, 7000], ['itm_trays', 'frm_kasoa', -58, 2500], ['itm_trays', 'frm_kasoa', -28, 2000],
    ['itm_disinfect', 'frm_dodowa', -40, 8], ['itm_disinfect', 'frm_ejisu', -40, 6], ['itm_disinfect', 'frm_kasoa', -40, 4],
    ['itm_shavings', 'frm_dodowa', -40, 120], ['itm_shavings', 'frm_ejisu', -36, 260], ['itm_shavings', 'frm_kasoa', -40, 60],
    ['itm_drinker', 'frm_dodowa', -55, 20], ['itm_drinker', 'frm_ejisu', -55, 24], ['itm_drinker', 'frm_kasoa', -55, 12],
    ['itm_bulb', 'frm_dodowa', -40, 30], ['itm_bulb', 'frm_ejisu', -40, 24],
  ].forEach(([it, fm, day, q]) => purchase(it, fm, day, q, it === 'itm_trays' ? 'sup_pack' : ['itm_drinker', 'itm_bulb'].includes(it) ? 'sup_equip' : 'sup_vet'));
  // Day-to-day usage of supplies
  [
    ['itm_trays', 'frm_dodowa', 13500], ['itm_trays', 'frm_kasoa', 3900], ['itm_disinfect', 'frm_dodowa', 5], ['itm_disinfect', 'frm_ejisu', 4], ['itm_disinfect', 'frm_kasoa', 2],
    ['itm_shavings', 'frm_dodowa', 95], ['itm_shavings', 'frm_ejisu', 230], ['itm_shavings', 'frm_kasoa', 38], ['itm_bulb', 'frm_dodowa', 14], ['itm_bulb', 'frm_ejisu', 16], ['itm_drinker', 'frm_ejisu', 4],
  ].forEach(([itemId, farmId, q]) => {
    const parts = 6;
    for (let i = 0; i < parts; i++) stockMoves.push({ id: id('smv'), itemId, farmId, date: D(-55 + i * 9), qty: -Math.round(q / parts), kind: 'use', note: 'Used on farm', by: pick(workerFor[farmId]) });
  });

  // ---------------- Health ----------------
  const vaccineItem = (name, kind) =>
    kind === 'deworm' ? 'itm_piperazine' : /coccid/i.test(name) ? 'itm_amprol' : /lasota|newcastle/i.test(name) ? 'itm_ndlasota' : /gumboro/i.test(name) ? 'itm_gumboro' : /pox/i.test(name) ? 'itm_fowlpox' : /eds|egg drop/i.test(name) ? 'itm_eds' : /duck plague/i.test(name) ? 'itm_dve' : null;
  const vaccinations = [];
  for (const f of flocks) {
    const def = flockDefs.find((x) => x.id === f.id);
    for (const v of scheduleFor(DEFAULT_TEMPLATES, f)) {
      if (f.status === 'closed' && v.dueDate > f.closedAt) continue;
      const rec = { id: id('vac'), ...v };
      const overdueOnPurpose = (f.id === 'flk_b2611' && v.ageDay === 10) || (f.id === 'flk_g2601' && v.ageDay === 98);
      if (v.status === 'due' && v.dueDate < D(0) && !overdueOnPurpose) {
        rec.status = 'done';
        rec.doneAt = v.dueDate;
        rec.by = pick(workerFor[f.farmId]);
        rec.batchNo = `BN${Math.floor(between(10000, 99999))}`;
        if (v.dueDate >= D(-WINDOW + 1) && def.ageNow - (parseISO(D(0)) - parseISO(v.dueDate)) / 864e5 >= def.placedAge) {
          rec.itemId = vaccineItem(v.name, v.kind);
          rec.qty = rec.itemId === 'itm_piperazine' ? Math.max(1, Math.round(f.opening / 1000)) : Math.max(1, Math.ceil(f.opening / (rec.itemId === 'itm_eds' ? 500 : rec.itemId === 'itm_dve' ? 100 : 1000)));
        }
      }
      vaccinations.push(rec);
    }
  }
  const treatments = [
    { id: id('trt'), flockId: 'flk_b2610', farmId: 'frm_ejisu', date: D(-6), days: 5, drug: 'Oxytetracycline 20%', itemId: 'itm_oxytet', qty: 6, reason: 'Respiratory signs (snicking) after heat stress', withdrawalDays: 6, withdrawalUntil: D(4), by: 'usr_yaw', vet: 'Dr. Nii Laryea' },
    { id: id('trt'), flockId: 'flk_b2610', farmId: 'frm_ejisu', date: D(-9), days: 3, drug: 'Vitamins & electrolytes', itemId: 'itm_vitamin', qty: 6, reason: 'Heat stress support', withdrawalDays: 0, withdrawalUntil: null, by: 'usr_ibrahim' },
    { id: id('trt'), flockId: 'flk_l2503', farmId: 'frm_kasoa', date: D(-21), days: 5, drug: 'Amprolium', itemId: 'itm_amprol', qty: 8, reason: 'Bloody droppings — suspected coccidiosis', withdrawalDays: 1, withdrawalUntil: D(-15), by: 'usr_akosua', vet: 'Dr. Ama Boateng' },
    { id: id('trt'), flockId: 'flk_t2602', farmId: 'frm_ejisu', date: D(-30), days: 3, drug: 'Tylosin', itemId: 'itm_tylosin', qty: 2, reason: 'Swollen sinuses in a few birds', withdrawalDays: 5, withdrawalUntil: D(-22), by: 'usr_yaw' },
  ];
  const hatchBatches = [
    { id: 'htc_07', code: 'HB-07', farmId: 'frm_dodowa', species: 'chicken', setDate: D(-30), eggsSet: 4800, source: 'Hatching eggs · Sunrise Breeders', incubator: 'Incubator 1', candleDate: D(-22), fertile: 4330, hatchDate: D(-9), hatched: 3952, status: 'closed', destination: 'chick-stock', costPerEgg: 2.2, by: 'usr_selorm' },
    { id: 'htc_08', code: 'HB-08', farmId: 'frm_dodowa', species: 'chicken', setDate: D(-15), eggsSet: 5000, source: 'Hatching eggs · Sunrise Breeders', incubator: 'Incubator 2', candleDate: D(-7), fertile: 4415, hatchDate: null, hatched: null, status: 'candled', costPerEgg: 2.2, by: 'usr_selorm' },
    { id: 'htc_09', code: 'HB-09', farmId: 'frm_dodowa', species: 'chicken', setDate: D(-3), eggsSet: 5000, source: 'Hatching eggs · Sunrise Breeders', incubator: 'Incubator 1', candleDate: null, fertile: null, hatchDate: null, hatched: null, status: 'incubating', costPerEgg: 2.2, by: 'usr_selorm' },
    { id: 'htc_10', code: 'HB-10', farmId: 'frm_dodowa', species: 'guinea', setDate: D(-20), eggsSet: 600, source: 'Own guinea breeders, Kasoa', incubator: 'Incubator 3', candleDate: D(-10), fertile: 492, hatchDate: null, hatched: null, status: 'candled', costPerEgg: 1.5, by: 'usr_selorm' },
    { id: 'htc_06', code: 'HB-06', farmId: 'frm_dodowa', species: 'chicken', setDate: D(-54), eggsSet: 5200, source: 'Hatching eggs · Sunrise Breeders', incubator: 'Incubator 2', candleDate: D(-46), fertile: 4610, hatchDate: D(-33), hatched: 4205, status: 'closed', destination: 'flock', flockId: 'flk_b2610', costPerEgg: 2.2, by: 'usr_selorm' },
  ].map((h) => ({ ...h, createdAt: T(Math.round((parseISO(h.setDate) - parseISO(D(0))) / 864e5)) }));

  // ---------------- Products ----------------
  const EGG = ['frm_dodowa', 'frm_kasoa'];
  const products = [
    { id: 'prd_egg_l', name: 'Large eggs — crate of 30', category: 'eggs', unit: 'crate', price: 82, wholesalePrice: 78, wholesaleMin: 10, stockMode: 'eggs', eggSize: 'large', eggsPer: 30, art: 'crate', farmIds: EGG, description: 'Fresh brown eggs, graded large (63–73 g).' },
    { id: 'prd_egg_m', name: 'Medium eggs — crate of 30', category: 'eggs', unit: 'crate', price: 74, wholesalePrice: 70, wholesaleMin: 10, stockMode: 'eggs', eggSize: 'medium', eggsPer: 30, art: 'crate', farmIds: EGG, description: 'Fresh brown eggs, graded medium (53–63 g).' },
    { id: 'prd_egg_s', name: 'Small eggs — crate of 30', category: 'eggs', unit: 'crate', price: 64, wholesalePrice: 60, wholesaleMin: 10, stockMode: 'eggs', eggSize: 'small', eggsPer: 30, art: 'crate', farmIds: EGG, description: 'Pullet eggs — great value for bakeries and chop bars.' },
    { id: 'prd_egg_j', name: 'Jumbo eggs — crate of 30', category: 'eggs', unit: 'crate', price: 92, wholesalePrice: 88, wholesaleMin: 10, stockMode: 'eggs', eggSize: 'jumbo', eggsPer: 30, art: 'crate', farmIds: EGG, description: 'Extra large eggs (73 g and above).' },
    { id: 'prd_egg_mh', name: 'Medium eggs — half crate (15)', category: 'eggs', unit: 'half crate', price: 39, stockMode: 'eggs', eggSize: 'medium', eggsPer: 15, art: 'halfcrate', farmIds: EGG, description: 'Half a crate for small households.' },
    { id: 'prd_egg_c', name: 'Cracked eggs — crate of 30', category: 'eggs', unit: 'crate', price: 42, wholesalePrice: 38, wholesaleMin: 5, stockMode: 'eggs', eggSize: 'cracked', eggsPer: 30, art: 'cracked', farmIds: EGG, description: 'Hairline cracks only — use within 2 days.' },
    { id: 'prd_broiler', name: 'Live broiler (2–2.8 kg)', category: 'live', unit: 'head', price: 115, wholesalePrice: 105, wholesaleMin: 50, stockMode: 'birds', species: 'chicken', purpose: 'broiler', art: 'broiler', farmIds: ['frm_ejisu'], description: 'Healthy, vaccinated Cobb/Ross broilers, 5–6 weeks.' },
    { id: 'prd_turkey', name: 'Live turkey', category: 'live', unit: 'head', price: 650, stockMode: 'birds', species: 'turkey', purpose: 'meat', art: 'turkey', farmIds: ['frm_ejisu'], description: 'Broad Breasted Bronze, 6–10 kg.' },
    { id: 'prd_guinea', name: 'Guinea fowl', category: 'live', unit: 'head', price: 140, stockMode: 'birds', species: 'guinea', purpose: 'meat', art: 'guinea', farmIds: ['frm_kasoa'], description: 'Free-range pearl guinea fowl.' },
    { id: 'prd_duck', name: 'Muscovy duck', category: 'live', unit: 'head', price: 180, stockMode: 'birds', species: 'duck', purpose: 'meat', art: 'duck', farmIds: ['frm_kasoa'], description: 'Pond-raised Muscovy ducks.' },
    { id: 'prd_spent', name: 'Spent layer (old hen)', category: 'live', unit: 'head', price: 75, wholesalePrice: 68, wholesaleMin: 20, stockMode: 'manual', art: 'hen', farmIds: ['frm_kasoa', 'frm_dodowa'], description: 'Tasty "old layers" for soup and stew.' },
    { id: 'prd_dressed', name: 'Dressed whole chicken', category: 'meat', unit: 'kg', price: 58, wholesalePrice: 54, wholesaleMin: 50, stockMode: 'manual', art: 'meat', farmIds: ['frm_ejisu'], description: 'Cleaned, chilled and packed on the farm.' },
    { id: 'prd_turkey_kg', name: 'Dressed turkey', category: 'meat', unit: 'kg', price: 78, stockMode: 'manual', art: 'meat', farmIds: ['frm_ejisu'], description: 'Whole dressed turkey, priced per kg.' },
    { id: 'prd_gizzard', name: 'Chicken gizzards', category: 'meat', unit: 'kg', price: 42, stockMode: 'manual', art: 'gizzard', farmIds: ['frm_ejisu'], description: 'Cleaned gizzards, 1 kg packs.' },
    { id: 'prd_doc_b', name: 'Day-old broiler chicks', category: 'chicks', unit: 'chick', price: 13.5, wholesalePrice: 12.5, wholesaleMin: 500, stockMode: 'manual', art: 'chick', farmIds: ['frm_dodowa'], description: "Hatched at our Dodowa hatchery, Marek's vaccinated." },
    { id: 'prd_doc_l', name: 'Day-old layer chicks (sexed)', category: 'chicks', unit: 'chick', price: 17, stockMode: 'manual', art: 'chick', farmIds: ['frm_dodowa'], description: 'Female ISA Brown chicks, pre-order 2 weeks ahead.' },
    { id: 'prd_pol', name: 'Point-of-lay pullets (16 wks)', category: 'chicks', unit: 'head', price: 115, stockMode: 'manual', art: 'hen', farmIds: ['frm_dodowa'], description: 'Fully vaccinated, ready to start laying.' },
    { id: 'prd_keets', name: 'Guinea keets', category: 'chicks', unit: 'chick', price: 14, stockMode: 'manual', art: 'chick', farmIds: ['frm_dodowa'], description: 'Day-old guinea fowl keets.' },
    { id: 'prd_oxytet', name: 'Oxytetracycline 20% (100 g)', category: 'drugs', unit: 'sachet', price: 32, stockMode: 'manual', art: 'sachet', farmIds: ALL, description: 'Broad-spectrum antibiotic. Observe withdrawal periods.' },
    { id: 'prd_vitamin', name: 'Vitamins & electrolytes (100 g)', category: 'drugs', unit: 'sachet', price: 25, stockMode: 'manual', art: 'sachet', farmIds: ALL, description: 'Anti-stress for heat, transport and vaccination.' },
    { id: 'prd_amprol', name: 'Amprolium anticoccidial (100 g)', category: 'drugs', unit: 'sachet', price: 36, stockMode: 'manual', art: 'sachet', farmIds: ALL, description: 'Treats and prevents coccidiosis.' },
    { id: 'prd_dewormer', name: 'Piperazine dewormer (100 g)', category: 'drugs', unit: 'sachet', price: 38, stockMode: 'manual', art: 'sachet', farmIds: ALL, description: 'Roundworm control in drinking water.' },
    { id: 'prd_lasota', name: 'Newcastle vaccine Lasota (1000 doses)', category: 'drugs', unit: 'vial', price: 60, stockMode: 'manual', art: 'vial', farmIds: ['frm_dodowa', 'frm_ejisu'], description: 'Keep refrigerated (2–8 °C).' },
    { id: 'prd_gumboro', name: 'Gumboro vaccine (1000 doses)', category: 'drugs', unit: 'vial', price: 68, stockMode: 'manual', art: 'vial', farmIds: ['frm_dodowa', 'frm_ejisu'], description: 'Keep refrigerated (2–8 °C).' },
    { id: 'prd_layer_bag', name: 'Layer mash — 50 kg bag', category: 'feed', unit: 'bag', price: 425, stockMode: 'manual', art: 'bag', farmIds: ['frm_dodowa', 'frm_kasoa'], description: 'Complete layer feed, 16% protein.' },
    { id: 'prd_starter_bag', name: 'Broiler starter — 50 kg bag', category: 'feed', unit: 'bag', price: 520, stockMode: 'manual', art: 'bag', farmIds: ['frm_ejisu'], description: 'Crumbles, 22% protein.' },
    { id: 'prd_manure', name: 'Poultry manure — 50 kg sack', category: 'other', unit: 'sack', price: 25, wholesalePrice: 20, wholesaleMin: 40, stockMode: 'manual', art: 'manure', farmIds: ALL, description: 'Dried litter manure for gardens and farms.' },
    { id: 'prd_drinker', name: 'Bell drinker', category: 'equipment', unit: 'piece', price: 115, stockMode: 'manual', art: 'drinker', farmIds: ['frm_dodowa', 'frm_ejisu'], description: 'Automatic bell drinker with hose.' },
    { id: 'prd_feeder', name: 'Tube feeder (10 kg)', category: 'equipment', unit: 'piece', price: 95, stockMode: 'manual', art: 'feeder', farmIds: ['frm_dodowa', 'frm_ejisu'], description: 'Hanging feeder for broilers and layers.' },
  ].map((p) => ({ ...p, onPortal: true, active: true, createdAt: T(-300) }));
  const productMoves = [];
  const pm = (productId, farmId, day, qty, note) => productMoves.push({ id: id('pmv'), productId, farmId, date: D(day), qty, kind: qty >= 0 ? 'in' : 'adjust', note, by: 'usr_akosua' });
  pm('prd_dressed', 'frm_ejisu', -42, 300, 'Processed from flock B-2605 (140 birds)');
  pm('prd_gizzard', 'frm_ejisu', -42, 22, 'Processed from flock B-2605');
  pm('prd_dressed', 'frm_ejisu', -8, 120, 'Processed (bought-in birds)');
  pm('prd_turkey_kg', 'frm_ejisu', -20, 60, 'Processed 7 turkeys');
  pm('prd_spent', 'frm_kasoa', -14, 120, 'Culled from L-2503');
  pm('prd_doc_b', 'frm_dodowa', -33, 2600, 'Hatch HB-06 (rest went to flock B-2610)');
  pm('prd_doc_b', 'frm_dodowa', -9, 3952, 'Hatch HB-07');
  pm('prd_pol', 'frm_dodowa', -25, 200, 'Reared pullets');
  pm('prd_doc_l', 'frm_dodowa', -9, 400, 'Sexed layer chicks (bought in for resale)');
  [['prd_oxytet', 40], ['prd_vitamin', 60], ['prd_amprol', 30], ['prd_dewormer', 30], ['prd_lasota', 15], ['prd_gumboro', 10], ['prd_drinker', 12], ['prd_feeder', 12]].forEach(([p, q]) =>
    products.find((x) => x.id === p).farmIds.forEach((fm) => pm(p, fm, -50, Math.round(q / products.find((x) => x.id === p).farmIds.length) + 4, 'Opening stock')),
  );
  pm('prd_layer_bag', 'frm_dodowa', -40, 60, 'Feed for resale');
  pm('prd_layer_bag', 'frm_kasoa', -40, 25, 'Feed for resale');
  pm('prd_starter_bag', 'frm_ejisu', -35, 40, 'Feed for resale');
  ALL.forEach((fm) => pm('prd_manure', fm, -45, fm === 'frm_ejisu' ? 300 : 150, 'Cleaned out of houses'));

  // ---------------- Customers ----------------
  const customers = [
    { id: 'cus_kofi', name: 'Kofi Boateng', type: 'retail', phone: '0244123456', email: 'kofi@demo.com', location: 'Adenta, Accra' },
    { id: 'cus_esi', name: 'Auntie Esi Egg Depot', type: 'trader', phone: '0243336677', email: 'esi.eggs@demo.com', location: 'Madina Market' },
    { id: 'cus_grace', name: 'Mama Grace Wholesale', type: 'trader', phone: '0558899001', email: 'grace@demo.com', location: 'Dodowa Market' },
    { id: 'cus_crust', name: 'Sweet Crust Bakery', type: 'business', phone: '0302 667 788', email: 'orders@sweetcrust.demo', location: 'Oyarifa' },
    { id: 'cus_coast', name: 'Coastline Hotel Kitchen', type: 'business', phone: '0302 765 432', email: 'kitchen@coastline.demo', location: 'Labadi' },
    { id: 'cus_queens', name: 'Kasoa Market Queens', type: 'trader', phone: '0249090123', email: 'queens@demo.com', location: 'Kasoa Market' },
    { id: 'cus_abu', name: 'Abu & Sons Provisions', type: 'trader', phone: '0204567812', email: 'abu@demo.com', location: 'Kasoa' },
    { id: 'cus_agro', name: 'Ashanti Agro Processors', type: 'business', phone: '0322 019 283', email: 'buy@ashantiagro.demo', location: 'Kumasi' },
    { id: 'cus_nkwanta', name: 'Nkwanta Outgrowers Co-op', type: 'business', phone: '0245566778', email: 'coop@nkwanta.demo', location: 'Ejisu' },
    { id: 'cus_dokono', name: 'Maame Dokono Chop Bar', type: 'business', phone: '0551122334', email: 'dokono@demo.com', location: 'Ejisu' },
    { id: 'cus_abena', name: 'Abena Owusu', type: 'retail', phone: '0247788990', email: 'abena@demo.com', location: 'East Legon' },
    { id: 'cus_ekow', name: 'Ekow Mensah', type: 'retail', phone: '0541239876', email: 'ekow@demo.com', location: 'Kasoa' },
    { id: 'cus_selasi', name: 'Selasi Kumah', type: 'retail', phone: '0209871234', email: 'selasi@demo.com', location: 'Dodowa' },
    { id: 'cus_fatima', name: 'Fatima Iddrisu', type: 'retail', phone: '0276655443', email: 'fatima@demo.com', location: 'Kumasi' },
  ].map((c, i) => ({ ...c, password: 'demo123', notes: '', createdAt: T(-200 + i * 5) }));
  const custById = Object.fromEntries(customers.map((c) => [c.id, c]));

  // ---------------- Orders & payments ----------------
  const prodById = Object.fromEntries(products.map((p) => [p.id, p]));
  const orders = [];
  const payments = [];
  let ref = 10240;
  const unit = (p, q) => (p.wholesalePrice && p.wholesaleMin && q >= p.wholesaleMin ? p.wholesalePrice : p.price);
  const addOrder = ({ customerId, farmId, day, lines, status = 'picked', channel = 'counter', pickupDay = day, pays = 'full', methods = ['mtn', 'cash'], note = '', partial = 0, hh = 10 }) => {
    const ls = lines.filter(([, q]) => q > 0).map(([pid, qty]) => {
      const p = prodById[pid];
      const price = unit(p, qty);
      return { productId: pid, name: p.name, unit: p.unit, qty, price, amount: r2(price * qty) };
    });
    if (!ls.length) return null;
    const total = r2(ls.reduce((a, l) => a + l.amount, 0));
    const c = custById[customerId];
    const o = {
      id: id('ord'), ref: `PP-${ref++}`, customerId, customerName: c?.name || 'Walk-in customer', phone: c?.phone || '', farmId, lines: ls, subtotal: total, discount: 0, total,
      pickupDate: D(pickupDay), status, channel, note, pickedAt: status === 'picked' ? T(pickupDay, hh + 1) : null, readyAt: status === 'ready' ? T(pickupDay - 1, 15) : null,
      cancelledAt: status === 'cancelled' ? T(day + 1, 9) : null, by: channel === 'portal' ? 'Customer' : 'Ama Serwaa', createdAt: T(day, hh),
    };
    orders.push(o);
    const pay = (amount, method, d, kind, h = hh) => payments.push({ id: id('pay'), ref: `PAY${100000 + seq}`, orderId: o.id, customerId, farmId, amount: r2(amount), method, account: method === 'card' ? '**** 4242' : c?.phone || '', kind, status: 'success', note: '', at: T(d, h, 20), by: method === 'cash' ? 'Ama Serwaa' : 'Customer' });
    const m1 = pick(methods);
    if (pays === 'full') pay(total, m1, pickupDay, 'full', hh + 1);
    else if (pays === 'deposit' || pays === 'deposit+balance') {
      const dep = Math.ceil(total * 0.3);
      pay(dep, pick(['mtn', 'telecel', 'card']), day, 'deposit');
      if (pays === 'deposit+balance') pay(total - dep, m1, pickupDay, 'balance', hh + 1);
    } else if (pays === 'partial') pay(partial, m1, pickupDay, 'payment', hh + 1);
    return o;
  };
  // Daily egg sales to traders and businesses (most of yesterday's eggs).
  const buyers = { frm_dodowa: ['cus_esi', 'cus_grace', 'cus_crust', 'cus_coast', 'cus_esi', 'cus_grace'], frm_kasoa: ['cus_queens', 'cus_abu', 'cus_queens'] };
  const carry = { frm_dodowa: { small: 0, medium: 0, large: 0, jumbo: 0, cracked: 0 }, frm_kasoa: { small: 0, medium: 0, large: 0, jumbo: 0, cracked: 0 } };
  for (let day = -WINDOW + 2; day <= -1; day++) {
    for (const fm of ['frm_dodowa', 'frm_kasoa']) {
      const got = eggsByFarmDay[`${fm}|${day - 1}`];
      if (!got) continue;
      const pool = carry[fm];
      Object.keys(pool).forEach((k) => (pool[k] += got[k]));
      const bs = buyers[fm];
      const split = fm === 'frm_dodowa' ? 2 : 1;
      for (let b = 0; b < split; b++) {
        const share = split === 2 ? (b === 0 ? 0.55 : 0.42) : 0.96;
        const crates = (s) => Math.floor((pool[s] * share) / 30);
        const ln = [['prd_egg_l', crates('large')], ['prd_egg_m', crates('medium')], ['prd_egg_s', crates('small')], ['prd_egg_j', crates('jumbo')], ['prd_egg_c', crates('cracked')]];
        const cust = bs[(day + 60 + b * 3) % bs.length];
        let pays = 'full';
        let partial = 0;
        const o0 = ln.reduce((a, [pid, q]) => a + unit(prodById[pid], q) * q, 0);
        if (cust === 'cus_coast' && day === -48) [pays, partial] = ['partial', Math.round(o0 * 0.4)];
        if (cust === 'cus_grace' && day === -38) [pays, partial] = ['partial', Math.round(o0 * 0.6)];
        if (cust === 'cus_esi' && day >= -4) [pays, partial] = ['partial', Math.round(o0 * 0.5)];
        const o = addOrder({ customerId: cust, farmId: fm, day, lines: ln, pays, partial, methods: ['mtn', 'mtn', 'telecel', 'cash', 'cash'], hh: 7 + b * 2 });
        if (o) o.lines.forEach((l) => (pool[prodById[l.productId].eggSize] -= l.qty * 30));
      }
    }
  }
  // Older debt (before the 60-day window) — hotel kitchen
  addOrder({ customerId: 'cus_coast', farmId: 'frm_dodowa', day: -74, lines: [['prd_egg_l', 30], ['prd_egg_m', 20]], pays: 'partial', partial: 1200, methods: ['card'] });
  // Bulk broilers from the closed flock
  addOrder({ customerId: 'cus_agro', farmId: 'frm_ejisu', day: -44, pickupDay: -42, lines: [['prd_broiler', 2187]], pays: 'partial', partial: 210000, methods: ['mtn'], note: 'Bulk sale of flock B-2605' });
  // Chicks to outgrowers
  addOrder({ customerId: 'cus_nkwanta', farmId: 'frm_dodowa', day: -34, pickupDay: -32, lines: [['prd_doc_b', 1500]], pays: 'deposit+balance', methods: ['mtn'], channel: 'portal' });
  addOrder({ customerId: 'cus_nkwanta', farmId: 'frm_dodowa', day: -11, pickupDay: -8, lines: [['prd_doc_b', 2500], ['prd_vitamin', 10]], pays: 'deposit+balance', methods: ['mtn'], channel: 'portal' });
  // Retail, portal and counter sales over the period
  const retail = ['cus_kofi', 'cus_abena', 'cus_ekow', 'cus_selasi', 'cus_fatima', 'cus_dokono', null, null];
  const menus = {
    frm_dodowa: [[['prd_egg_l', 2]], [['prd_egg_m', 1], ['prd_egg_mh', 1]], [['prd_doc_b', 100], ['prd_vitamin', 2]], [['prd_pol', 20]], [['prd_layer_bag', 2], ['prd_oxytet', 1]], [['prd_egg_j', 3]], [['prd_manure', 10]], [['prd_doc_b', 50]]],
    frm_ejisu: [[['prd_dressed', 6]], [['prd_dressed', 10], ['prd_gizzard', 2]], [['prd_turkey_kg', 8]], [['prd_starter_bag', 2], ['prd_drinker', 2]], [['prd_manure', 20]], [['prd_dressed', 4]]],
    frm_kasoa: [[['prd_spent', 4]], [['prd_egg_l', 2]], [['prd_spent', 10]], [['prd_dewormer', 2], ['prd_amprol', 1]], [['prd_manure', 15]], [['prd_layer_bag', 1]]],
  };
  for (let i = 0; i < 46; i++) {
    const fm = pick(ALL);
    const day = -Math.floor(between(1, 58));
    const cust = pick(retail);
    const portal = cust && R() < 0.55;
    addOrder({ customerId: cust, farmId: fm, day: portal ? day - 2 : day, pickupDay: day, lines: pick(menus[fm]), channel: portal ? 'portal' : 'counter', pays: portal ? 'deposit+balance' : 'full', methods: portal ? ['mtn', 'card', 'cash', 'telecel'] : ['cash', 'cash', 'mtn'], hh: Math.floor(between(8, 16)) });
  }
  // Live birds from the current stock
  addOrder({ customerId: 'cus_dokono', farmId: 'frm_ejisu', day: -16, lines: [['prd_turkey', 3]], pays: 'full', methods: ['cash'] });
  addOrder({ customerId: 'cus_fatima', farmId: 'frm_kasoa', day: -12, lines: [['prd_guinea', 6], ['prd_duck', 2]], pays: 'full', methods: ['mtn'], channel: 'portal' });
  flockMoves.push({ id: id('fmv'), flockId: 'flk_t2602', farmId: 'frm_ejisu', date: D(-16), qty: 3, kind: 'sold', note: 'Counter sale' });
  flockMoves.push({ id: id('fmv'), flockId: 'flk_t2602', farmId: 'frm_ejisu', date: D(-20), qty: 7, kind: 'processed', note: 'Processed → dressed turkey' });
  flockMoves.push({ id: id('fmv'), flockId: 'flk_g2601', farmId: 'frm_kasoa', date: D(-12), qty: 6, kind: 'sold', note: 'Portal order' });
  flockMoves.push({ id: id('fmv'), flockId: 'flk_d2601', farmId: 'frm_kasoa', date: D(-12), qty: 2, kind: 'sold', note: 'Portal order' });
  // Kofi's history and small debt
  addOrder({ customerId: 'cus_kofi', farmId: 'frm_dodowa', day: -14, pickupDay: -12, lines: [['prd_egg_l', 3], ['prd_layer_bag', 1]], channel: 'portal', pays: 'partial', partial: 500, methods: ['mtn'] });
  // Upcoming bookings (open orders)
  const upcoming = [
    { customerId: 'cus_kofi', farmId: 'frm_dodowa', day: -1, pickupDay: 2, lines: [['prd_egg_l', 2], ['prd_egg_mh', 1], ['prd_vitamin', 1]], pays: 'deposit' },
    { customerId: 'cus_abena', farmId: 'frm_ejisu', day: -2, pickupDay: 6, lines: [['prd_broiler', 12]], pays: 'deposit' },
    { customerId: 'cus_dokono', farmId: 'frm_ejisu', day: -1, pickupDay: 7, lines: [['prd_broiler', 60]], pays: 'deposit', note: 'For Saturday funeral catering' },
    { customerId: 'cus_ekow', farmId: 'frm_kasoa', day: -3, pickupDay: 0, lines: [['prd_guinea', 4], ['prd_spent', 6]], pays: 'deposit', status: 'ready' },
    { customerId: 'cus_selasi', farmId: 'frm_dodowa', day: -2, pickupDay: 0, lines: [['prd_doc_b', 300], ['prd_drinker', 2]], pays: 'deposit', status: 'ready' },
    { customerId: 'cus_fatima', farmId: 'frm_ejisu', day: -4, pickupDay: -1, lines: [['prd_turkey', 2]], pays: 'deposit', status: 'ready', note: 'Missed pick-up yesterday' },
    { customerId: 'cus_nkwanta', farmId: 'frm_dodowa', day: -1, pickupDay: 5, lines: [['prd_doc_b', 1000]], pays: 'deposit' },
    { customerId: 'cus_crust', farmId: 'frm_dodowa', day: 0, pickupDay: 1, lines: [['prd_egg_s', 15], ['prd_egg_m', 10]], pays: 'none' },
    { customerId: 'cus_coast', farmId: 'frm_ejisu', day: -1, pickupDay: 3, lines: [['prd_dressed', 40], ['prd_gizzard', 5]], pays: 'deposit' },
    { customerId: 'cus_abena', farmId: 'frm_kasoa', day: -5, pickupDay: -3, lines: [['prd_duck', 2]], pays: 'deposit', status: 'cancelled', note: 'Customer travelled' },
  ];
  upcoming.forEach((u) => addOrder({ status: 'booked', channel: 'portal', ...u, methods: ['mtn', 'card'] }));

  // ---------------- Staff work ----------------
  const tasks = [
    ['frm_dodowa', 'pen_da', 'Collect eggs — morning round', 'usr_ama', '09:00', 'eggs'],
    ['frm_dodowa', 'pen_da', 'Collect eggs — afternoon round', 'usr_ama', '15:00', 'eggs'],
    ['frm_dodowa', 'pen_db', 'Collect eggs & grade', 'usr_ama', '10:00', 'eggs'],
    ['frm_dodowa', null, 'Feed & water check (all houses)', 'usr_kojo', '06:30', 'feeding'],
    ['frm_dodowa', 'pen_dbr', 'Check brooder temperature', 'usr_kojo', '08:00', 'monitoring'],
    ['frm_dodowa', null, 'Clean drinkers', 'usr_kojo', '11:00', 'cleaning'],
    ['frm_dodowa', 'pen_dh', 'Check incubators & turn eggs', 'usr_selorm', '07:00', 'hatchery'],
    ['frm_dodowa', null, 'Remove & record dead birds', 'usr_kojo', '17:00', 'health'],
    ['frm_ejisu', null, 'Feed & water check', 'usr_ibrahim', '06:30', 'feeding'],
    ['frm_ejisu', 'pen_e1', 'Turn litter & check ventilation', 'usr_ibrahim', '10:00', 'cleaning'],
    ['frm_ejisu', null, 'Record temperature & humidity', 'usr_ibrahim', '14:00', 'monitoring'],
    ['frm_ejisu', null, 'Deliveries & customer pick-ups', 'usr_kwabena', '09:00', 'sales'],
    ['frm_kasoa', 'pen_k1', 'Collect eggs', 'usr_efua', '09:30', 'eggs'],
    ['frm_kasoa', null, 'Feed & water — all pens', 'usr_efua', '07:00', 'feeding'],
    ['frm_kasoa', 'pen_kd', 'Refresh duck pond water', 'usr_efua', '12:00', 'cleaning'],
  ].map(([farmId, penId, title, assigneeId, time, category]) => ({ id: id('tsk'), farmId, penId, title, assigneeId, time, category, repeat: 'daily', days: [], active: true, createdAt: T(-90) }));
  tasks.push(
    { id: id('tsk'), farmId: 'frm_dodowa', penId: null, title: 'Wash & refill footbaths', assigneeId: 'usr_kojo', time: '07:30', category: 'cleaning', repeat: 'weekly', days: [1], active: true, createdAt: T(-90) },
    { id: id('tsk'), farmId: 'frm_ejisu', penId: null, title: 'Generator test run', assigneeId: 'usr_kwabena', time: '16:00', category: 'maintenance', repeat: 'weekly', days: [5], active: true, createdAt: T(-90) },
    { id: id('tsk'), farmId: 'frm_kasoa', penId: null, title: 'Disinfect equipment', assigneeId: 'usr_efua', time: '15:00', category: 'cleaning', repeat: 'weekly', days: [3], active: true, createdAt: T(-90) },
  );
  const taskRuns = [];
  for (let day = -13; day <= 0; day++) {
    const dow = addDays(now, day).getDay();
    for (const t of tasks) {
      if (t.repeat === 'weekly' && !t.days.includes(dow)) continue;
      if (day === 0 && t.time > '11:00') continue;
      if (day < 0 && R() < 0.07) continue;
      const [h, m] = t.time.split(':').map(Number);
      taskRuns.push({ id: id('trn'), taskId: t.id, date: D(day), doneBy: t.assigneeId, doneAt: T(day, h, m + Math.floor(between(0, 40))), note: '' });
    }
  }
  const attendance = [];
  for (let day = -29; day <= 0; day++) {
    const dow = addDays(now, day).getDay();
    for (const u of users.filter((x) => x.role !== 'owner')) {
      if (dow === 0 && u.role === 'manager') continue;
      if (R() < 0.04) continue;
      const inH = 6 + Math.floor(between(0, 2));
      const inM = Math.floor(between(0, 59));
      attendance.push({ id: id('att'), userId: u.id, farmId: u.farmIds[0], date: D(day), in: `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`, out: day === 0 ? null : `${16 + Math.floor(between(0, 2))}:${String(Math.floor(between(0, 59))).padStart(2, '0')}`, method: 'code' });
    }
  }
  const month = (n) => format(addDays(new Date(now.getFullYear(), now.getMonth() + n, 1), 0), 'yyyy-MM');
  const advances = [
    { id: id('adv'), userId: 'usr_kojo', date: D(-6), amount: 300, note: 'School fees support', settled: false, payrunId: null },
    { id: id('adv'), userId: 'usr_efua', date: D(-12), amount: 200, note: 'Medical', settled: false, payrunId: null },
  ];
  const payruns = [];
  const walletTx = [];
  [-2, -1].forEach((mOff) => {
    const mk = month(mOff);
    const lines = users.filter((u) => u.salary > 0).map((u) => {
      const ssnit = r2((u.salary * settings.ssnitPct) / 100);
      return { userId: u.id, name: u.name, base: u.salary, allowance: 0, ssnit, advances: 0, net: r2(u.salary - ssnit), method: 'mtn', account: u.phone, status: 'paid' };
    });
    const total = r2(lines.reduce((a, l) => a + l.net, 0));
    const paidDate = format(new Date(now.getFullYear(), now.getMonth() + mOff + 1, 0), 'yyyy-MM-dd');
    const prId = id('prn');
    payruns.push({ id: prId, month: mk, lines, total, status: 'paid', paidAt: `${paidDate}T15:00:00.000Z`, by: 'usr_owner' });
    expenses.push({ id: id('exp'), farmId: null, date: paidDate, category: 'salaries', amount: total, description: `Salaries · ${format(parseISO(`${mk}-01`), 'MMMM yyyy')}`, paidFrom: 'wallet', payrunId: prId, createdAt: `${paidDate}T15:00:00.000Z` });
  });
  // Running costs
  for (let mOff = -2; mOff <= 0; mOff++) {
    const base = new Date(now.getFullYear(), now.getMonth() + mOff, 1);
    const dayOf = (d) => format(new Date(base.getFullYear(), base.getMonth(), d), 'yyyy-MM-dd');
    if (dayOf(5) > D(0)) continue;
    ALL.forEach((fm, i) => {
      expenses.push({ id: id('exp'), farmId: fm, date: dayOf(5 + i), category: 'utilities', amount: r2(between(900, 1900) * (fm === 'frm_dodowa' ? 1.6 : 1)), description: 'ECG prepaid electricity', paidFrom: 'wallet', createdAt: `${dayOf(5 + i)}T10:00:00.000Z` });
      expenses.push({ id: id('exp'), farmId: fm, date: dayOf(7 + i), category: 'utilities', amount: r2(between(250, 520)), description: 'Water (borehole pump & tanker)', paidFrom: 'cash', createdAt: `${dayOf(7 + i)}T10:00:00.000Z` });
      expenses.push({ id: id('exp'), farmId: fm, date: dayOf(12 + i), category: 'fuel', amount: r2(between(600, 1400)), description: 'Diesel — generator & van', paidFrom: 'cash', createdAt: `${dayOf(12 + i)}T10:00:00.000Z` });
    });
  }
  const assets = [
    { id: 'ast_gen1', farmId: 'frm_dodowa', name: 'Generator 20 kVA', category: 'Power', purchaseDate: '2021-04-10', cost: 38000, status: 'working', nextService: D(5), serial: 'GN-20-4471' },
    { id: 'ast_inc1', farmId: 'frm_dodowa', name: 'Incubator 1 (5,280 eggs)', category: 'Hatchery', purchaseDate: '2022-08-01', cost: 42000, status: 'working', nextService: D(40) },
    { id: 'ast_inc2', farmId: 'frm_dodowa', name: 'Incubator 2 (5,280 eggs)', category: 'Hatchery', purchaseDate: '2023-03-15', cost: 42000, status: 'working', nextService: D(55) },
    { id: 'ast_inc3', farmId: 'frm_dodowa', name: 'Incubator 3 (1,056 eggs)', category: 'Hatchery', purchaseDate: '2024-01-20', cost: 12500, status: 'needs repair', nextService: D(-2) },
    { id: 'ast_pump', farmId: 'frm_dodowa', name: 'Borehole pump', category: 'Water', purchaseDate: '2019-05-01', cost: 9500, status: 'working', nextService: D(70) },
    { id: 'ast_van', farmId: 'frm_ejisu', name: 'Delivery van', category: 'Vehicle', purchaseDate: '2021-10-01', cost: 145000, status: 'working', nextService: D(12), serial: 'AS 4471-21' },
    { id: 'ast_gen2', farmId: 'frm_ejisu', name: 'Generator 15 kVA', category: 'Power', purchaseDate: '2021-11-10', cost: 29000, status: 'working', nextService: D(-4) },
    { id: 'ast_plucker', farmId: 'frm_ejisu', name: 'Chicken plucker machine', category: 'Processing', purchaseDate: '2022-06-02', cost: 8800, status: 'working', nextService: D(30) },
    { id: 'ast_freezer', farmId: 'frm_ejisu', name: 'Chest freezers (×3)', category: 'Cold storage', purchaseDate: '2022-06-02', cost: 13500, status: 'working', nextService: D(60) },
    { id: 'ast_fans', farmId: 'frm_ejisu', name: 'Exhaust fans (×6)', category: 'Ventilation', purchaseDate: '2023-02-14', cost: 7200, status: 'working', nextService: D(20) },
    { id: 'ast_tank', farmId: 'frm_kasoa', name: 'Polytank 5,000 L', category: 'Water', purchaseDate: '2023-04-01', cost: 4200, status: 'working', nextService: D(90) },
  ].map((a) => ({ ...a, createdAt: T(-300) }));
  const maintenance = [
    { id: id('mnt'), assetId: 'ast_gen1', farmId: 'frm_dodowa', date: D(-35), description: 'Oil & filter change', cost: 850, status: 'done', by: 'usr_kojo', vendor: 'PowerFix Services' },
    { id: id('mnt'), assetId: 'ast_inc3', farmId: 'frm_dodowa', date: D(-2), description: 'Humidity sensor reading wrong — technician booked', cost: 0, status: 'open', by: 'usr_selorm', vendor: 'IncuTech Ghana' },
    { id: id('mnt'), assetId: 'ast_van', farmId: 'frm_ejisu', date: D(-18), description: 'Replaced front tyres', cost: 2400, status: 'done', by: 'usr_kwabena', vendor: 'Suame Tyre Centre' },
    { id: id('mnt'), assetId: 'ast_fans', farmId: 'frm_ejisu', date: D(-9), description: 'Fan 4 motor rewound after heat wave', cost: 450, status: 'done', by: 'usr_yaw', vendor: 'Local electrician' },
    { id: id('mnt'), assetId: 'ast_gen2', farmId: 'frm_ejisu', date: D(-1), description: 'Service overdue — schedule mechanic', cost: 0, status: 'open', by: 'usr_yaw' },
    { id: id('mnt'), assetId: null, farmId: 'frm_kasoa', date: D(-26), description: 'Fixed leaking roof sheets, Layer House K1', cost: 1300, status: 'done', by: 'usr_akosua', vendor: 'Kasoa Roofing' },
  ];
  maintenance.filter((m) => m.cost > 0).forEach((m) => expenses.push({ id: id('exp'), farmId: m.farmId, date: m.date, category: 'maintenance', amount: m.cost, description: m.description, paidFrom: m.cost > 1000 ? 'wallet' : 'cash', maintenanceId: m.id, createdAt: `${m.date}T12:00:00.000Z` }));
  // Chick / bird purchases for flocks placed inside the window
  flocks.filter((f) => f.placedAt >= D(-WINDOW + 1)).forEach((f) => expenses.push({ id: id('exp'), farmId: f.farmId, date: f.placedAt, category: 'birds', amount: r2(f.opening * f.costPerBird), description: `${f.opening.toLocaleString()} birds for flock ${f.code}`, paidFrom: 'bank', flockId: f.id, createdAt: `${f.placedAt}T09:00:00.000Z` }));

  // ---------------- Wallet ledger ----------------
  // Online money comes in; cash gets banked in every Monday; owner withdraws to the bank every Friday.
  const events = [];
  payments.filter((p) => ['mtn', 'telecel', 'at', 'card'].includes(p.method)).forEach((p) => events.push({ at: p.at, kind: 'pay', p }));
  expenses.filter((e) => e.paidFrom === 'wallet').forEach((e) => events.push({ at: e.createdAt, kind: 'exp', e }));
  for (let day = -WINDOW; day <= 0; day++) {
    const dow = addDays(now, day).getDay();
    if (dow === 1) events.push({ at: T(day, 16), kind: 'bank' });
    if (dow === 5) events.push({ at: T(day, 17), kind: 'wd' });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  let bal = 0;
  let cash = 0;
  const cashEvents = [
    ...payments.filter((p) => p.method === 'cash').map((p) => ({ at: p.at, amt: p.amount })),
    ...expenses.filter((e) => e.paidFrom === 'cash').map((e) => ({ at: e.createdAt, amt: -e.amount })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  let ci = 0;
  for (const ev of events) {
    while (ci < cashEvents.length && cashEvents[ci].at <= ev.at) cash += cashEvents[ci++].amt;
    if (ev.kind === 'pay') {
      bal += ev.p.amount;
      walletTx.push({ id: id('wtx'), type: 'payment', amount: ev.p.amount, ref: ev.p.ref, method: ev.p.method, note: `Order payment`, at: ev.p.at, status: 'success' });
    } else if (ev.kind === 'exp') {
      bal -= ev.e.amount;
      walletTx.push({ id: id('wtx'), type: ev.e.category === 'salaries' ? 'payroll' : 'expense', amount: -ev.e.amount, ref: `EXP${seq}`, note: ev.e.description, at: ev.e.createdAt, status: 'success', expenseId: ev.e.id });
    } else if (ev.kind === 'bank' && cash > 2000) {
      const amt = Math.floor((cash * 0.85) / 100) * 100;
      cash -= amt;
      bal += amt;
      walletTx.push({ id: id('wtx'), type: 'cash-deposit', amount: amt, ref: `CSH${seq}`, note: 'Weekly cash banked', at: ev.at, status: 'success' });
    } else if (ev.kind === 'wd' && bal > 30000 && ev.at < T(-1)) {
      const amt = Math.floor((bal * 0.7) / 1000) * 1000;
      bal -= amt;
      const dest = R() < 0.8 ? { type: 'bank', bank: 'GCB Bank', number: '****4410', name: 'PoultryPro Farms Ltd' } : { type: 'momo', network: 'mtn', number: '0244000111', name: 'Kwame Asante' };
      walletTx.push({ id: id('wtx'), type: 'withdrawal', amount: -amt, ref: `WD${seq}`, payoutRef: `TRX${10000000 + seq}`, destination: dest, note: `Withdrawal to ${dest.type === 'bank' ? 'GCB Bank ****4410' : 'MTN MoMo 0244000111'}`, at: ev.at, status: 'success', by: 'usr_owner' });
    }
  }

  // ---------------- Notifications ----------------
  const notifications = [
    { id: id('ntf'), at: T(0, 8, 5), toRoles: ['owner', 'manager'], farmId: 'frm_ejisu', title: 'Feed running low', text: 'Broiler finisher at Ejisu Farm will run out in about 2 days.', link: '/app/inventory', read: false, tone: 'amber' },
    { id: id('ntf'), at: T(0, 7, 30), toRoles: ['owner', 'manager'], farmId: 'frm_ejisu', title: 'Vaccination overdue', text: 'B-2611 · Gumboro (IBD) was due 2 days ago.', link: '/app/health', read: false, tone: 'red' },
    { id: id('ntf'), at: T(-1, 18, 0), toRoles: ['owner', 'manager'], farmId: 'frm_ejisu', title: 'New booking', text: 'Maame Dokono Chop Bar · 60 live broilers · pick-up in 7 days', link: '/app/orders', read: false },
    { id: id('ntf'), at: T(-9, 15, 0), toRoles: ['owner', 'manager'], farmId: 'frm_ejisu', title: 'Mortality alert', text: 'B-2610 lost 17 birds today (heat stress). House temp 35.4 °C.', link: '/app/flocks/flk_b2610', read: true, tone: 'red' },
    { id: id('ntf'), at: T(-1, 9, 0), toCustomerId: 'cus_kofi', title: 'Booking confirmed', text: 'Your order is booked for pick-up at Dodowa Main Farm.', link: '/account/orders', read: false },
    { id: id('ntf'), at: T(-12, 12, 0), toCustomerId: 'cus_kofi', title: 'Balance reminder', text: 'You have an unpaid balance from your last pick-up. Pay any time with MoMo or card.', link: '/account', read: true },
  ];

  return {
    settings,
    farms, pens, flocks, feedLogs, eggLogs, weightLogs, mortality, envLogs, flockMoves,
    vaccinations, treatments, hatchBatches, vaccineTemplates: DEFAULT_TEMPLATES,
    items, stockMoves, suppliers, products, productMoves,
    customers, orders, payments, walletTx, expenses,
    users, tasks, taskRuns, attendance, advances, payruns, assets, maintenance,
    notifications, smsLog: [], audit: [], shopStock: [],
    seededAt: new Date().toISOString(),
  };
}
