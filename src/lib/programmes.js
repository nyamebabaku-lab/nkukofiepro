// Care programmes: what to do, feed, temperature, light and space for every bird type, from the
// week before the birds arrive to sale (or the end of lay). Installing a programme on a flock creates
// its routine tasks (only active during the right ages) and one-off milestone tasks (feed changes,
// weighing, preparing for sale...). Vaccinations come from ./vaccines.js.
// Figures are common Ghana practice and breed-guide values; farmers should confirm with their vet
// and follow the feed bag / breed guide where they differ.

import { addDays, format, parseISO } from 'date-fns';

const W = (weeks) => weeks * 7;

// ---------- shared routines ----------
const BIOSECURITY = [
  { title: 'Refresh footbath & check visitors book', time: '06:15', category: 'cleaning', from: -3, to: 9999, important: false },
  { title: 'Remove & record dead birds (bury or burn, never sell)', time: '17:00', category: 'health', from: 0, to: 9999, important: true },
];
const BROODING = (to, temps) => [
  { title: `Check brooder temperature (${temps}) & chick spread`, time: '06:00', category: 'monitoring', from: 0, to, important: true },
  { title: 'Temperature check & adjust curtains / heat', time: '10:00', category: 'monitoring', from: 0, to },
  { title: 'Record house temperature & humidity', time: '14:00', category: 'monitoring', from: 0, to },
  { title: 'Night check: heat, light, chicks spread evenly', time: '21:00', category: 'monitoring', from: 0, to, important: true },
];
const FEED_WATER = (from, to, label = '') => [
  { title: `Morning feed & clean, refill drinkers${label}`, time: '06:30', category: 'feeding', from, to, important: true },
  { title: 'Midday feed & water top-up, stir feed', time: '12:00', category: 'feeding', from, to },
  { title: 'Evening feed & water', time: '17:30', category: 'feeding', from, to, important: true },
];
const PRE_ARRIVAL = (heat) => [
  { day: -7, title: 'Remove old litter, wash house, feeders & drinkers with soap', time: '08:00', category: 'cleaning' },
  { day: -6, title: 'Disinfect house & equipment; lime the floor; repair nets & walls', time: '08:00', category: 'cleaning' },
  { day: -5, title: 'Rest the house (no birds, no visitors); set rodent bait', time: '08:00', category: 'cleaning' },
  { day: -3, title: 'Spread 5–10 cm clean wood shavings; set footbath at the door', time: '08:00', category: 'cleaning' },
  { day: -2, title: 'Set up brooder guard, feeders, drinkers, thermometer; test bulbs/heaters & generator', time: '08:00', category: 'maintenance' },
  { day: -1, title: `Pre-heat brooder for 24 hours to ${heat}; buy feed, vitamins, glucose & vaccines`, time: '10:00', category: 'monitoring', important: true },
];
const ARRIVAL = [
  { day: 0, title: 'Arrival: count birds, check for weak ones, dip beaks in glucose water, then put on feed', time: '08:00', category: 'health', important: true },
  { day: 0, title: 'Give glucose + vitamin water for the first 4–6 hours (no plain cold water)', time: '08:30', category: 'feeding' },
  { day: 1, title: 'Check crop fill (80% of chicks with full, soft crops = good start)', time: '08:00', category: 'monitoring' },
];

// ---------- programmes ----------
export const PROGRAMMES = {
  broiler: {
    id: 'broiler',
    name: 'Broilers',
    emoji: '🐔',
    summary: 'Day-old to sale in 5–7 weeks. Target about 2.0–2.5 kg live weight at 35–42 days with FCR under 1.8.',
    sale: { from: 35, to: 49, weightG: 2200, label: 'Sale from day 35 (about 2.0–2.5 kg)' },
    end: 49,
    stages: [
      { key: 'prep', name: 'Before chicks arrive', from: -7, to: -1, feed: null, temp: [32, 34], light: '—', space: 'Brooder ring: about 30–40 chicks per m²', goals: ['Clean, disinfected, rested house', 'Brooder pre-heated 24 hours', 'Feed, water, vitamins and vaccines ready'], watch: ['Wet or mouldy litter', 'Rats and wild birds getting in'] },
      { key: 'brood', name: 'Brooding', from: 0, to: 14, feed: { name: 'Broiler starter', protein: '22–23%', form: 'Crumbs / fine mash' }, temp: [30, 34], tempNote: 'Days 1–3: 32–34 °C · days 4–7: 30–32 °C · week 2: 28–30 °C', light: '23 h light for the first 7 days, then 20 h', space: 'Widen the brooder ring every 2–3 days; 20–25 birds/m² by day 14', water: 'About 2× the feed eaten; vitamins & glucose days 1–3', goals: ['Day-7 weight about 4.5× the day-old weight (≈185 g)', 'Mortality under 1% in week 1'], watch: ['Chicks crowding under heat = too cold', 'Chicks panting away from heat = too hot', 'Pasty vents, weak or lame chicks'] },
      { key: 'start', name: 'Starter', from: 15, to: 21, feed: { name: 'Broiler starter', protein: '22–23%', form: 'Crumbs' }, temp: [26, 30], tempNote: 'Reduce about 2–3 °C per week; remove brooder heat by days 18–21 in warm weather', light: '20 h light, 4 h dark', space: '15–18 birds/m²', water: '200–250 ml per bird per day', goals: ['Day-21 weight ≈ 900–950 g'], watch: ['Bloody droppings (coccidiosis)', 'Sudden deaths (Gumboro around days 18–28)'] },
      { key: 'grow', name: 'Grower', from: 22, to: 32, feed: { name: 'Broiler grower', protein: '20–21%', form: 'Pellets / crumbs' }, temp: [22, 26], light: '18–20 h light', space: '10–12 birds/m²', water: '300–400 ml per bird per day (more in heat)', goals: ['Day-28 weight ≈ 1.5 kg'], watch: ['Heat stress (panting, wings out) — open curtains, give cool water and vitamins', 'Wet litter near drinkers'] },
      { key: 'finish', name: 'Finisher & sale', from: 33, to: 49, feed: { name: 'Broiler finisher', protein: '18–19%', form: 'Pellets' }, temp: [21, 25], light: '18–20 h light', space: 'About 10 birds/m² (under 30 kg/m²)', water: '400–500 ml per bird per day', goals: ['Day-35 weight ≈ 2.2 kg', 'Sell by day 42–49 — growth slows and feed per kg rises after that'], watch: ['Drug withdrawal periods before sale', 'Leg problems in heavy birds'] },
    ],
    routines: [
      ...BIOSECURITY,
      ...BROODING(14, '30–34 °C'),
      ...FEED_WATER(0, 49),
      { title: 'Turn wet litter & check ventilation', time: '11:00', category: 'cleaning', from: 7, to: 49, repeat: 'weekly', days: [2, 5] },
      { title: 'Weigh 2–5% of birds & record average weight', time: '08:00', category: 'monitoring', from: 7, to: 49, repeat: 'weekly', days: [1], important: true },
      { title: 'Heat-stress check: open curtains, cool water, vitamins', time: '13:30', category: 'monitoring', from: 21, to: 49 },
    ],
    milestones: [
      ...PRE_ARRIVAL('32–34 °C'),
      ...ARRIVAL,
      { day: 3, title: 'Widen brooder ring; raise drinkers to chick back height', time: '09:00', category: 'maintenance' },
      { day: 7, title: 'Reduce light to 20 hours; widen brooder ring again', time: '18:00', category: 'monitoring' },
      { day: 10, title: 'Change paper/chick trays to tube feeders', time: '09:00', category: 'feeding' },
      { day: 18, title: 'Start removing brooder heat (keep at night if cold)', time: '09:00', category: 'monitoring' },
      { day: 21, title: 'Feed change: mix starter + grower 50/50 for 2 days, then grower only', time: '06:30', category: 'feeding', important: true },
      { day: 28, title: 'Book buyers / post on the shop: birds ready from day 35', time: '10:00', category: 'sales' },
      { day: 32, title: 'Feed change: mix grower + finisher 50/50 for 2 days, then finisher only', time: '06:30', category: 'feeding', important: true },
      { day: 33, title: 'Check drug withdrawal periods are over before any sale', time: '09:00', category: 'health', important: true },
      { day: 35, title: 'Sale weighing: weigh 5% of birds and confirm sale prices', time: '08:00', category: 'sales', important: true },
      { day: 41, title: 'Before slaughter: remove feed 8–10 hours earlier (keep water); catch at night', time: '18:00', category: 'sales' },
    ],
  },

  layer: {
    id: 'layer',
    name: 'Layers',
    emoji: '🥚',
    summary: 'Day-old to point of lay at 18–20 weeks, then about 52–60 weeks of laying. Peak about 93–95% at 26–30 weeks.',
    sale: { from: W(72), to: W(80), weightG: 1900, label: 'Sell as spent hens from about 72–80 weeks' },
    end: W(80),
    stages: [
      { key: 'prep', name: 'Before chicks arrive', from: -7, to: -1, feed: null, temp: [32, 34], light: '—', space: 'Brooder ring: about 30–40 chicks per m²', goals: ['Clean, disinfected, rested house', 'Brooder pre-heated 24 hours'], watch: ['Wet litter, rats, wild birds'] },
      { key: 'brood', name: 'Brooding', from: 0, to: 21, feed: { name: 'Chick starter mash', protein: '19–20%', form: 'Crumbs / mash' }, temp: [29, 34], tempNote: 'Days 1–3: 32–34 °C · week 1: 31–32 °C · week 2: 29–30 °C · week 3: 27–28 °C', light: '23 h light days 1–3, then reduce by 1–2 h each week', space: 'Widen the ring every 3 days', water: 'Vitamins & glucose days 1–3', goals: ['Even, active chicks; week-1 mortality under 1%'], watch: ['Crowding = cold; panting = hot', 'Pasty vents'] },
      { key: 'starter', name: 'Starter', from: 22, to: W(8), feed: { name: 'Chick starter mash', protein: '19–20%', form: 'Mash' }, temp: [22, 27], tempNote: 'Remove heat by about week 4 in warm weather', light: 'Bring down to natural daylight (about 12 h) by week 6–8', space: '10–12 birds/m² on deep litter', water: '50–120 ml per bird per day', goals: ['Week-8 weight ≈ 650 g', 'Beak trimming at 7–10 days if practised (by a trained person)'], watch: ['Coccidiosis (bloody droppings)', 'Pecking — check light and space'] },
      { key: 'grower', name: 'Grower / pullet', from: W(8) + 1, to: W(16), feed: { name: 'Grower (developer) mash', protein: '15–16%', form: 'Mash' }, temp: null, light: 'Natural daylight only — do NOT increase light while growing', space: '6–8 birds/m²', water: '150–200 ml per bird per day', goals: ['Week-16 weight ≈ 1.3 kg', 'Uniformity above 80%'], watch: ['Under- or over-weight pullets lay poorly', 'Worms — deworm before lay'] },
      { key: 'prelay', name: 'Pre-lay', from: W(16) + 1, to: W(19), feed: { name: 'Pre-layer mash', protein: '16–17% · 2–2.5% calcium', form: 'Mash' }, temp: null, light: 'At 5% lay (≈ week 18–19) add 30 minutes of light per week up to 16 h', space: 'Move to laying house / cages by week 16–17; nest boxes 1 per 4–5 hens', water: '200 ml+ per bird per day', goals: ['First eggs at 18–20 weeks', 'Body weight ≈ 1.5 kg at first egg'], watch: ['Moving stress — vitamins for 3 days'] },
      { key: 'lay', name: 'Laying', from: W(19) + 1, to: W(80), feed: { name: 'Layer mash', protein: '16–17% · 3.5–4% calcium', form: 'Mash (+ oyster shell in the afternoon)' }, temp: null, light: '16 h light a day; never reduce light during lay', space: 'Deep litter 4–5 birds/m² or as cage maker advises', water: '250 ml+ per bird per day (more in heat)', goals: ['Peak 93–95% at 26–30 weeks', 'Egg weight ≈ 60 g by week 30', 'Feed ≈ 110–120 g per hen per day'], watch: ['Sudden drop in laying (disease, stress, feed or water problems)', 'Soft or thin shells (calcium)', 'Egg eating — collect often'] },
    ],
    routines: [
      ...BIOSECURITY,
      ...BROODING(21, '29–34 °C'),
      ...FEED_WATER(0, W(19)),
      { title: 'Morning feed & clean, refill drinkers', time: '06:00', category: 'feeding', from: W(19) + 1, to: W(80), important: true },
      { title: 'Afternoon feed + oyster shell / limestone', time: '15:00', category: 'feeding', from: W(19) + 1, to: W(80) },
      { title: 'Collect eggs — morning round', time: '09:00', category: 'eggs', from: W(18), to: W(80), important: true },
      { title: 'Collect eggs — midday round', time: '12:30', category: 'eggs', from: W(18), to: W(80) },
      { title: 'Collect eggs — afternoon round, grade & tray', time: '16:00', category: 'eggs', from: W(18), to: W(80), important: true },
      { title: 'Lights on (for 16 h day)', time: '04:30', category: 'monitoring', from: W(20), to: W(80) },
      { title: 'Lights off', time: '20:30', category: 'monitoring', from: W(20), to: W(80) },
      { title: 'Weigh 2–5% of birds & record average weight', time: '08:00', category: 'monitoring', from: 7, to: W(20), repeat: 'weekly', days: [1], important: true },
      { title: 'Turn litter & check ventilation', time: '11:00', category: 'cleaning', from: 7, to: W(80), repeat: 'weekly', days: [3] },
      { title: 'Remove non-layers / sick birds (culling check)', time: '10:00', category: 'health', from: W(24), to: W(80), repeat: 'weekly', days: [4] },
    ],
    milestones: [
      ...PRE_ARRIVAL('32–34 °C'),
      ...ARRIVAL,
      { day: 3, title: 'Reduce light from 23 h towards 20 h; widen brooder ring', time: '18:00', category: 'monitoring' },
      { day: 8, title: 'Beak trimming (only by a trained person) — vitamin K in water 2 days before and after', time: '09:00', category: 'health' },
      { day: 28, title: 'Remove brooder heat; light now close to natural daylight', time: '09:00', category: 'monitoring' },
      { day: W(8), title: 'Feed change: chick mash → grower mash (mix 50/50 for 3 days)', time: '06:30', category: 'feeding', important: true },
      { day: W(15), title: 'Prepare laying house / cages and nest boxes', time: '09:00', category: 'maintenance' },
      { day: W(16), title: 'Feed change: grower → pre-layer mash (mix for 3 days); move to laying house', time: '06:30', category: 'feeding', important: true },
      { day: W(19), title: 'Feed change: pre-layer → layer mash at 5% lay; start adding 30 min light per week', time: '06:30', category: 'feeding', important: true },
      { day: W(22), title: 'Stock egg trays & arrange egg buyers for peak lay', time: '10:00', category: 'sales' },
      { day: W(70), title: 'Plan replacement flock & spent-hen sale', time: '10:00', category: 'sales' },
    ],
  },

  cockerel: {
    id: 'cockerel',
    name: 'Cockerels & local birds',
    emoji: '🐓',
    summary: 'Slower-growing birds sold at about 3–5 months (1.8–2.5 kg), often timed for Christmas, Easter and Eid.',
    sale: { from: W(12), to: W(20), weightG: 2000, label: 'Sale from about 12–16 weeks (≈ 1.8–2.2 kg)' },
    end: W(20),
    stages: [
      { key: 'prep', name: 'Before chicks arrive', from: -7, to: -1, feed: null, temp: [32, 34], light: '—', space: '30–40 chicks per m² in the brooder', goals: ['Clean, disinfected, rested house'], watch: ['Wet litter, rats'] },
      { key: 'brood', name: 'Brooding', from: 0, to: 21, feed: { name: 'Chick starter mash', protein: '19–20%', form: 'Crumbs / mash' }, temp: [28, 34], tempNote: 'Days 1–7: 32–34 °C · week 2: 30 °C · week 3: 28 °C', light: '23 h light the first week, then 18–20 h', space: 'Widen ring every 3 days', water: 'Vitamins & glucose days 1–3', goals: ['Low early mortality'], watch: ['Crowding / panting', 'Pasty vents'] },
      { key: 'grow', name: 'Grower', from: 22, to: W(8), feed: { name: 'Chick / grower mash', protein: '18–19%', form: 'Mash' }, temp: [22, 27], light: '16–18 h light', space: '8–10 birds/m²', water: '100–200 ml per bird per day', goals: ['Week-8 weight ≈ 800–900 g'], watch: ['Fighting and pecking', 'Coccidiosis'] },
      { key: 'finish', name: 'Finisher & sale', from: W(8) + 1, to: W(20), feed: { name: 'Grower or broiler finisher mash', protein: '16–18%', form: 'Mash / pellets' }, temp: null, light: 'Natural daylight + evening light', space: '6–8 birds/m²', water: '200–250 ml per bird per day', goals: ['1.8–2.2 kg at 12–16 weeks'], watch: ['Plan the sale date around festive demand', 'Drug withdrawal periods before sale'] },
    ],
    routines: [
      ...BIOSECURITY,
      ...BROODING(21, '28–34 °C'),
      ...FEED_WATER(0, W(20)),
      { title: 'Weigh 2–5% of birds & record average weight', time: '08:00', category: 'monitoring', from: 7, to: W(20), repeat: 'weekly', days: [1] },
      { title: 'Turn litter & check ventilation', time: '11:00', category: 'cleaning', from: 7, to: W(20), repeat: 'weekly', days: [3] },
    ],
    milestones: [
      ...PRE_ARRIVAL('32–34 °C'),
      ...ARRIVAL,
      { day: 7, title: 'Reduce light to 18–20 h; widen brooder ring', time: '18:00', category: 'monitoring' },
      { day: 24, title: 'Remove brooder heat', time: '09:00', category: 'monitoring' },
      { day: W(8), title: 'Feed change: to grower / finisher mash (mix for 3 days)', time: '06:30', category: 'feeding', important: true },
      { day: W(10), title: 'Book buyers for the festive / market date', time: '10:00', category: 'sales' },
      { day: W(12), title: 'Sale weighing & withdrawal check', time: '08:00', category: 'sales', important: true },
    ],
  },

  turkey: {
    id: 'turkey',
    name: 'Turkeys',
    emoji: '🦃',
    summary: 'Poults need more heat and protein. Sell hens at 14–18 weeks (6–9 kg) and toms at 16–22 weeks (10–15 kg).',
    sale: { from: W(16), to: W(24), weightG: 9000, label: 'Sale from about 16 weeks' },
    end: W(24),
    stages: [
      { key: 'prep', name: 'Before poults arrive', from: -7, to: -1, feed: null, temp: [35, 37], light: '—', space: 'Brooder: 20–25 poults per m²', goals: ['Clean house', 'Brooder pre-heated to 35–37 °C'], watch: ['Chickens nearby (blackhead disease)'] },
      { key: 'brood', name: 'Brooding', from: 0, to: 28, feed: { name: 'Turkey starter', protein: '26–28%', form: 'Crumbs' }, temp: [29, 37], tempNote: 'Week 1: 35–37 °C, then about 3 °C lower each week', light: '23 h light the first week, then 18 h', space: 'Widen ring every 3 days', water: 'Dip beaks into water on arrival — poults are slow to find water', goals: ['Poults eating and drinking in the first hours'], watch: ['Starve-outs (poults not finding feed)', 'Crowding'] },
      { key: 'grow', name: 'Grower', from: 29, to: W(12), feed: { name: 'Turkey grower', protein: '22–24%', form: 'Pellets / mash' }, temp: [21, 28], light: '16–18 h light', space: '3–4 birds/m²', water: '0.3–0.6 L per bird per day', goals: ['Week-12 weight ≈ 6–7 kg (toms)'], watch: ['Blackhead (yellow droppings) — keep away from chickens', 'Leg problems'] },
      { key: 'finish', name: 'Finisher & sale', from: W(12) + 1, to: W(24), feed: { name: 'Turkey finisher', protein: '16–18%', form: 'Pellets' }, temp: null, light: 'Natural daylight + evening light', space: '2–3 birds/m²', water: '0.6–1 L per bird per day', goals: ['Hens 6–9 kg, toms 10–15 kg'], watch: ['Heat stress', 'Withdrawal periods before sale'] },
    ],
    routines: [
      ...BIOSECURITY,
      ...BROODING(28, '35–37 °C week 1'),
      ...FEED_WATER(0, W(24)),
      { title: 'Weigh a few birds & record average weight', time: '08:00', category: 'monitoring', from: 7, to: W(24), repeat: 'weekly', days: [1] },
      { title: 'Turn litter & check ventilation', time: '11:00', category: 'cleaning', from: 7, to: W(24), repeat: 'weekly', days: [3] },
    ],
    milestones: [
      ...PRE_ARRIVAL('35–37 °C'),
      ...ARRIVAL,
      { day: 1, title: 'Check every poult is eating and drinking; add shiny marbles to drinkers if slow', time: '10:00', category: 'feeding' },
      { day: 28, title: 'Feed change: starter → grower (mix for 3 days); reduce heat', time: '06:30', category: 'feeding', important: true },
      { day: W(12), title: 'Feed change: grower → finisher (mix for 3 days)', time: '06:30', category: 'feeding', important: true },
      { day: W(14), title: 'Book buyers (Christmas / Easter / events)', time: '10:00', category: 'sales' },
      { day: W(16), title: 'Sale weighing & withdrawal check', time: '08:00', category: 'sales', important: true },
    ],
  },

  guinea: {
    id: 'guinea',
    name: 'Guinea fowl',
    emoji: '🐦',
    summary: 'Keets are delicate for the first 4 weeks: keep them warm and dry with high-protein feed. Sell at 12–16 weeks (1.2–1.5 kg) or keep for eggs (lay from 28–32 weeks, mostly in the rainy season).',
    sale: { from: W(12), to: W(20), weightG: 1300, label: 'Sale from about 12–16 weeks' },
    end: W(20),
    stages: [
      { key: 'prep', name: 'Before keets arrive', from: -7, to: -1, feed: null, temp: [35, 37], light: '—', space: 'Brooder: 40–50 keets per m²', goals: ['Warm, dry, draught-free brooder'], watch: ['Damp floors — keets chill and die quickly'] },
      { key: 'brood', name: 'Brooding', from: 0, to: 28, feed: { name: 'Keet / turkey starter', protein: '24–26%', form: 'Crumbs' }, temp: [27, 37], tempNote: 'Week 1: 35 °C, then about 2–3 °C lower each week to week 4', light: '23 h light the first week, then 18 h', space: 'Widen ring every 3 days', water: 'Shallow drinkers with stones — keets drown easily', goals: ['Survival above 90% to week 4'], watch: ['Chilling, drowning, piling in corners'] },
      { key: 'grow', name: 'Grower', from: 29, to: W(10), feed: { name: 'Grower mash', protein: '18–20%', form: 'Mash' }, temp: null, light: '16 h light', space: '6–8 birds/m²', water: '100–200 ml per bird per day', goals: ['Week-8 weight ≈ 650 g'], watch: ['Flying out — clip wings or roof the run'] },
      { key: 'finish', name: 'Finisher / breeder', from: W(10) + 1, to: W(20), feed: { name: 'Finisher or layer mash', protein: '16–17%', form: 'Mash' }, temp: null, light: 'Natural daylight', space: '4–6 birds/m²', water: '200 ml+ per bird per day', goals: ['1.2–1.5 kg at 12–16 weeks'], watch: ['Stress from handling — catch at night'] },
    ],
    routines: [
      ...BIOSECURITY,
      ...BROODING(28, '35 °C week 1'),
      ...FEED_WATER(0, W(20)),
      { title: 'Weigh a few birds & record average weight', time: '08:00', category: 'monitoring', from: 7, to: W(20), repeat: 'weekly', days: [1] },
    ],
    milestones: [
      ...PRE_ARRIVAL('35 °C'),
      ...ARRIVAL,
      { day: 28, title: 'Feed change: keet starter → grower (mix for 3 days); remove heat', time: '06:30', category: 'feeding', important: true },
      { day: W(10), title: 'Feed change: grower → finisher (mix for 3 days)', time: '06:30', category: 'feeding', important: true },
      { day: W(12), title: 'Sale weighing & withdrawal check', time: '08:00', category: 'sales', important: true },
    ],
  },

  duck: {
    id: 'duck',
    name: 'Ducks',
    emoji: '🦆',
    summary: 'Hardy and fast growing. Meat ducks sell at 8–12 weeks (2.5–3.5 kg); layer ducks start laying at about 20–24 weeks.',
    sale: { from: W(8), to: W(14), weightG: 2800, label: 'Sale from about 8–12 weeks' },
    end: W(14),
    stages: [
      { key: 'prep', name: 'Before ducklings arrive', from: -7, to: -1, feed: null, temp: [30, 32], light: '—', space: 'Brooder: 20–25 ducklings per m²', goals: ['Dry litter; drinkers deep enough to dip the head but not swim'], watch: ['Wet litter'] },
      { key: 'brood', name: 'Brooding', from: 0, to: 21, feed: { name: 'Duck / broiler starter', protein: '20–22%', form: 'Crumbs / pellets' }, temp: [24, 32], tempNote: 'Week 1: 30–32 °C · week 2: 27 °C · week 3: 24 °C', light: '23 h light the first week, then 18 h', space: 'Widen ring every 3 days', water: 'Always beside the feed — ducklings need water to swallow', goals: ['Strong, dry ducklings'], watch: ['Wet, dirty ducklings chill easily'] },
      { key: 'grow', name: 'Grower', from: 22, to: W(7), feed: { name: 'Duck grower', protein: '16–18%', form: 'Pellets' }, temp: null, light: '16 h light', space: '4–5 birds/m²', water: '0.5–1 L per bird per day; a pond or trough for washing', goals: ['Week-6 weight ≈ 2.2 kg'], watch: ['Leg weakness (niacin) — add brewer’s yeast or vitamins'] },
      { key: 'finish', name: 'Finisher & sale', from: W(7) + 1, to: W(14), feed: { name: 'Duck finisher', protein: '15–16%', form: 'Pellets' }, temp: null, light: 'Natural daylight', space: '3–4 birds/m²', water: '1 L per bird per day', goals: ['2.5–3.5 kg at 8–12 weeks'], watch: ['Withdrawal periods before sale'] },
    ],
    routines: [
      ...BIOSECURITY,
      ...BROODING(21, '30–32 °C week 1'),
      ...FEED_WATER(0, W(14)),
      { title: 'Refresh pond / washing water & clean area around drinkers', time: '12:30', category: 'cleaning', from: 21, to: W(14) },
      { title: 'Weigh a few birds & record average weight', time: '08:00', category: 'monitoring', from: 7, to: W(14), repeat: 'weekly', days: [1] },
    ],
    milestones: [
      ...PRE_ARRIVAL('30–32 °C'),
      ...ARRIVAL,
      { day: 21, title: 'Feed change: starter → grower (mix for 3 days); remove heat', time: '06:30', category: 'feeding', important: true },
      { day: W(7), title: 'Feed change: grower → finisher (mix for 3 days)', time: '06:30', category: 'feeding', important: true },
      { day: W(8), title: 'Sale weighing & withdrawal check', time: '08:00', category: 'sales', important: true },
    ],
  },

  quail: {
    id: 'quail',
    name: 'Quail',
    emoji: '🐤',
    summary: 'Very fast: meat quail sell at 5–6 weeks; laying quail start at 6–7 weeks and lay for about a year.',
    sale: { from: 35, to: 49, weightG: 200, label: 'Meat sale from about 5–6 weeks' },
    end: W(56),
    stages: [
      { key: 'prep', name: 'Before chicks arrive', from: -7, to: -1, feed: null, temp: [35, 37], light: '—', space: 'Brooder: 100–150 chicks per m²', goals: ['Warm brooder; fine litter or paper on wire floors'], watch: ['Gaps — chicks are tiny and escape'] },
      { key: 'brood', name: 'Brooding', from: 0, to: 21, feed: { name: 'Quail / turkey starter', protein: '24–26%', form: 'Fine crumbs' }, temp: [26, 37], tempNote: 'Week 1: 35–37 °C, then about 3 °C lower each week', light: '24 h light the first week, then 16 h', space: 'Widen every 3 days', water: 'Shallow drinkers with pebbles — chicks drown easily', goals: ['Low early losses'], watch: ['Drowning, piling, chilling'] },
      { key: 'grow', name: 'Grower', from: 22, to: 42, feed: { name: 'Quail grower', protein: '20–22%', form: 'Crumbs' }, temp: null, light: '16 h light', space: '60–80 birds/m²', water: '20–30 ml per bird per day', goals: ['Weight ≈ 150–190 g at 4–6 weeks'], watch: ['Pecking — dim light'] },
      { key: 'lay', name: 'Laying', from: 43, to: W(56), feed: { name: 'Quail layer', protein: '20% · 3% calcium', form: 'Crumbs' }, temp: null, light: '16 h light', space: '50–60 birds/m² or cages', water: '30 ml+ per bird per day', goals: ['Laying 80%+ from week 9'], watch: ['Soft shells (calcium)'] },
    ],
    routines: [
      ...BIOSECURITY,
      ...BROODING(21, '35–37 °C week 1'),
      ...FEED_WATER(0, W(56)),
      { title: 'Collect quail eggs', time: '16:00', category: 'eggs', from: 42, to: W(56), important: true },
    ],
    milestones: [
      ...PRE_ARRIVAL('35–37 °C'),
      ...ARRIVAL,
      { day: 21, title: 'Feed change: starter → grower; remove heat', time: '06:30', category: 'feeding', important: true },
      { day: 35, title: 'Meat quail: sale weighing & withdrawal check', time: '08:00', category: 'sales' },
      { day: 42, title: 'Layers: change to quail layer feed; 16 h light', time: '06:30', category: 'feeding', important: true },
    ],
  },
};

export const PROGRAMME_LIST = Object.values(PROGRAMMES);

/** Which programme fits a flock. */
export function programmeFor(f) {
  if (!f) return null;
  if (f.programme && PROGRAMMES[f.programme]) return PROGRAMMES[f.programme];
  if (f.species === 'turkey') return PROGRAMMES.turkey;
  if (f.species === 'guinea') return PROGRAMMES.guinea;
  if (f.species === 'duck') return PROGRAMMES.duck;
  if (f.species === 'quail') return PROGRAMMES.quail;
  if (f.purpose === 'broiler') return PROGRAMMES.broiler;
  if (['layer', 'breeder'].includes(f.purpose)) return PROGRAMMES.layer;
  return PROGRAMMES.cockerel;
}

/** The stage a flock of `age` days is in (last stage once past the end). */
export function stageAt(p, age) {
  if (!p) return null;
  return p.stages.find((s) => age >= s.from && age <= s.to) || (age < p.stages[0].from ? p.stages[0] : p.stages[p.stages.length - 1]);
}
export const nextStage = (p, stage) => p.stages[p.stages.indexOf(stage) + 1] || null;

/** Recommended brooding temperature range for an age (null when no extra heat is needed). */
export function tempRangeAt(p, age) {
  const s = stageAt(p, age);
  if (!s?.temp) return null;
  // drop gradually across the stage
  const span = Math.max(1, s.to - Math.max(0, s.from));
  const k = Math.min(1, Math.max(0, (age - Math.max(0, s.from)) / span));
  const [lo, hi] = s.temp;
  const top = Math.round(hi - (hi - lo) * k * 0.7);
  return [Math.max(lo, top - 3), top];
}

/** Tasks a programme creates for a flock (routines during their age window + dated milestones). */
export function programmeTasks(p, flock, { assigneeId = null, from = null } = {}) {
  if (!p) return [];
  const dateAt = (day) => format(addDays(parseISO(flock.hatchDate), day), 'yyyy-MM-dd');
  const startKey = from || format(new Date(), 'yyyy-MM-dd');
  const tag = (t) => `${t} · ${flock.code}`;
  const base = { farmId: flock.farmId, penId: flock.penId || null, flockId: flock.id, assigneeId, active: true, auto: true, programme: p.id };
  const routines = p.routines.map((r) => ({ ...base, title: tag(r.title), time: r.time, category: r.category, repeat: r.repeat || 'daily', days: r.days || [], fromDay: r.from, toDay: r.to, important: !!r.important }));
  const milestones = p.milestones
    .map((m) => ({ ...base, title: tag(m.title), time: m.time, category: m.category, repeat: 'once', days: [], date: dateAt(m.day), ageDay: m.day, important: !!m.important }))
    .filter((m) => m.date >= startKey);
  return [...routines, ...milestones];
}

// ---------- general knowledge ----------
export const BIOSECURITY_RULES = [
  'Footbath with fresh disinfectant at every house door — change it daily.',
  'Keep a visitors book; visitors wear clean boots and do not enter if they visited another farm that day.',
  'One age group per house where possible ("all in, all out"); clean and rest the house 2 weeks between flocks.',
  'Never sell or eat sick or dead birds. Bury deep with lime, or burn them.',
  'Keep wild birds, rats and stray animals out — nets, bait stations and closed feed stores.',
  'Buy chicks only from approved hatcheries; quarantine new adult birds for 2 weeks.',
  'Clean drinkers daily and feeders weekly; keep litter dry.',
  'Report sudden heavy deaths to the district veterinary officer (VSD) at once — it may be bird flu or Newcastle disease.',
];

export const DISEASES = [
  { name: 'Newcastle disease', signs: 'Gasping, twisted necks, green watery droppings, sudden drop in eggs, many deaths.', action: 'Isolate, call the vet / VSD at once. Prevent with the Newcastle vaccines on schedule.' },
  { name: 'Gumboro (IBD)', signs: 'Chicks 3–6 weeks: ruffled feathers, whitish watery droppings, pecking at vent, sudden deaths.', action: 'No cure — give vitamins & electrolytes, keep warm, call the vet. Prevent with Gumboro vaccines.' },
  { name: 'Coccidiosis', signs: 'Bloody or brown watery droppings, hunched birds, wet litter, weight loss.', action: 'Treat with an anticoccidial (e.g. amprolium) in water for 5–7 days; dry the litter.' },
  { name: 'Fowl pox', signs: 'Wart-like scabs on comb, wattles and face; yellow patches in the mouth.', action: 'Vaccinate unaffected birds; control mosquitoes. Antibiotics only for secondary infection (vet advice).' },
  { name: 'Chronic respiratory disease (CRD)', signs: 'Sneezing, nasal discharge, swollen face, rattling breath.', action: 'Improve ventilation; vet-prescribed antibiotic (e.g. tylosin). Mind withdrawal periods.' },
  { name: 'Fowl typhoid / pullorum', signs: 'Yellow-green diarrhoea, pale comb, droopy birds, deaths in all ages.', action: 'Vet-prescribed antibiotic; vaccinate layers; buy chicks from clean hatcheries.' },
  { name: 'Heat stress', signs: 'Panting, wings held out, less feed, drop in eggs, deaths on hot afternoons.', action: 'Open curtains, add fans or shade, cool water, vitamins & electrolytes; feed in cooler hours.' },
  { name: 'Avian influenza (bird flu)', signs: 'Very sudden heavy deaths, swollen blue combs, bleeding legs.', action: 'Do not move or sell birds. Report to the VSD immediately — it is a notifiable disease.' },
  { name: 'Worms', signs: 'Thin birds, pale combs, poor growth or laying, worms in droppings.', action: 'Deworm (e.g. piperazine or levamisole) as scheduled; keep litter clean.' },
];
