// Product & staff photos live in IndexedDB (localStorage is too small for images).
import { useEffect, useState } from 'react';

const DB = 'poultrypro-photos';
const STORE = 'photos';
let dbp;
const open = () =>
  (dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));

const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
  });
};

const listeners = new Set();
export const savePhoto = async (key, dataUrl) => {
  await tx('readwrite', (s) => (dataUrl ? s.put(dataUrl, key) : s.delete(key)));
  listeners.forEach((l) => l(key));
};
export const getPhoto = (key) => tx('readonly', (s) => s.get(key)).catch(() => null);

export function usePhoto(key) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const load = () => getPhoto(key).then((v) => alive && setUrl(v || null));
    load();
    const l = (k) => k === key && load();
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, [key]);
  return url;
}

/** Shrinks a picked image to a small JPEG data URL. */
export function resizeImage(file, max = 520) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
