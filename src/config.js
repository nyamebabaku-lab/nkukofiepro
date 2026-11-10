// Which app this build is:
//   'main'  — Nkukɔ Fie Pro: customers
//   'farm'  — Nkukɔ Fie Pro Farm: farm owners, managers and workers
//   'admin' — Nkukɔ Fie Pro Admin: the platform super admin
//   'demo'  — the public demo with a sample farm
export const MODE = import.meta.env.VITE_APP || 'demo';
export const LIVE = MODE !== 'demo';
/** Default platform name (the super admin can change it; see lib/brand.js). */
export const DEFAULT_APP_NAME = 'Nkukɔ Fie Pro';
/** Namespaces browser storage so the apps on the same website never share data. */
export const storeKey = (name) => (MODE === 'demo' ? name : `${name}-${MODE}`);
/** Public web address and Android downloads. */
export const SITE = 'https://nyamebabaku-lab.github.io/nkukofiepro/';
export const RELEASES = 'https://github.com/nyamebabaku-lab/nkukofiepro/releases/latest/download/';
