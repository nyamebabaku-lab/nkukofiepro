// Which app this build is: 'main' (customers, workers, managers), 'admin' (owners, super admin) or 'demo'.
export const MODE = import.meta.env.VITE_APP || 'demo';
export const LIVE = MODE !== 'demo';
/** Namespaces browser storage so the three apps on the same website never share data. */
export const storeKey = (name) => (MODE === 'demo' ? name : `${name}-${MODE}`);
