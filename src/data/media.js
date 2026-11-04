// Real photos (openly licensed — see photo credits) used across the app. Files live in public/photos/.
import credits from './credits.json';

export const photo = (key) => `${import.meta.env.BASE_URL}photos/${key}.jpg`;
export const CREDITS = credits;

/** Product id → photo, falling back to the product's picture style. */
const BY_PRODUCT = { prd_keets: 'keets', prd_turkey_kg: 'turkeymeat', prd_pol: 'pullet', prd_spent: 'hen', prd_doc_l: 'chicks', prd_lasota: 'vaccine', prd_gumboro: 'vaccine', prd_egg_mh: 'eggs' };
const BY_ART = { crate: 'eggs', halfcrate: 'eggs', cracked: 'cracked', hen: 'hen', broiler: 'broiler', turkey: 'turkey', guinea: 'guinea', duck: 'duck', chick: 'chicks', meat: 'dressed', gizzard: 'gizzard', sachet: 'drugs', vial: 'vaccine', bag: 'feedbag', manure: 'manure', drinker: 'drinker', feeder: 'feeder' };
export const productPhoto = (p) => photo(BY_PRODUCT[p.id] || BY_ART[p.art] || 'eggs');

export const CATEGORY_PHOTO = { eggs: 'eggs', live: 'broiler', meat: 'dressed', chicks: 'chicks', drugs: 'drugs', feed: 'feedbag', equipment: 'drinker', other: 'manure', all: 'farm' };

/** Picture for a flock by species / purpose. */
export const flockPhoto = (f) => photo(f.species === 'turkey' ? 'turkey' : f.species === 'guinea' ? 'guinea' : f.species === 'duck' ? 'duck' : f.purpose === 'broiler' ? 'broiler' : 'hen');

/** Banner photo for a farm (falls back to a general farm shot). */
const BY_FARM = { frm_dodowa: 'layerhouse', frm_ejisu: 'broilerhouse', frm_kasoa: 'africafarm' };
export const farmPhotoKey = (farm) => BY_FARM[farm?.id] || 'farm';
