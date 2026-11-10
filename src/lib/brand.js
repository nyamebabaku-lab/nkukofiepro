// Branding: the platform name + logo (editable by the super admin) and each farm business's own logo.
// Everything that shows the app's name or logo reads it from here.
import { create } from 'zustand';
import { DEFAULT_APP_NAME, MODE, storeKey } from '../config';

const KEY = storeKey('nkukofie-brand');
const saved = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

export const useBrand = create(() => ({
  name: saved().name || DEFAULT_APP_NAME,
  logo: saved().logo || null, // data URL, or null for the built-in egg mark
  farmName: null, // the signed-in farm business (live apps)
  farmLogo: null,
}));

/** Platform name/logo from the server (cached for offline starts). */
export function setPlatformBrand({ name, logo }) {
  const next = { name: name || DEFAULT_APP_NAME, logo: logo || null };
  useBrand.setState(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: keep it in memory */
  }
  document.title = appTitle(next.name);
}

export const setFarmBrand = (farmName, farmLogo) => useBrand.setState({ farmName: farmName || null, farmLogo: farmLogo || null });

/** Window title / app label for each build. */
export const appTitle = (name = useBrand.getState().name) =>
  MODE === 'admin' ? `${name} Admin` : MODE === 'farm' ? `${name} Farm` : MODE === 'demo' ? `${name} — Demo` : name;

/** Splits "Nkukɔ Fie Pro" into "Nkukɔ Fie" + "Pro" so the last word can take the accent colour. */
export function splitName(name) {
  const parts = String(name || DEFAULT_APP_NAME).trim().split(/\s+/);
  if (parts.length < 2) return [parts[0], ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

/** Ghana SMS networks charge double for letters like ɔ and ɛ, so texts use their plain forms. */
export const smsSafe = (text) => String(text).replace(/ɔ/g, 'o').replace(/Ɔ/g, 'O').replace(/ɛ/g, 'e').replace(/Ɛ/g, 'E');

/** Shrinks an uploaded logo to a small square PNG data URL (keeps transparency). */
export function logoFromFile(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('Choose an image file (PNG or JPG)'));
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, size / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      const url = c.toDataURL('image/png');
      resolve(url.length > 280000 ? c.toDataURL('image/jpeg', 0.85) : url);
    };
    img.onerror = () => reject(new Error('That image could not be read'));
    img.src = URL.createObjectURL(file);
    return null;
  });
}

/** Current platform name (for plain strings outside React components). */
export const appName = () => useBrand.getState().name;
/** Name used at the start of SMS texts. */
export const smsPrefix = () => smsSafe(appName());
