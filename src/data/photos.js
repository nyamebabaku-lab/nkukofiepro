// Product photos.
// Live apps: uploaded to file storage (photos/<business>/<key>.jpg) so every phone and every customer sees them,
// with a copy kept on this phone (IndexedDB) for offline use. Demo: on this phone only.
import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from './supabase';
import { useDB } from './store';

const DB = 'nkukofie-photos';
const STORE = 'photos';
const BUCKET = 'photos';
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

const bid = () => useDB.getState().businessId || null;
const fileName = (key) => `${bid()}/${String(key).replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`;
const cacheKey = (key, v) => (v ? `${key}@${v}` : key);

/** Public address of a shared photo (null in the demo or before a farm is loaded). */
export function remotePhotoUrl(key, v) {
  if (!supabaseReady || !bid()) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName(key));
  return `${data.publicUrl}${v ? `?v=${v}` : ''}`;
}

async function dataUrlBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

const listeners = new Set();
export const getPhoto = (key) => tx('readonly', (s) => s.get(key)).catch(() => null);

/**
 * Saves (or with null, removes) a photo. Returns the version stamp to keep on the record,
 * `shared: true` when it reached the server, and `error` when it could only be kept on this phone.
 */
export async function savePhoto(key, dataUrl) {
  const v = dataUrl ? Date.now() : null;
  await tx('readwrite', (s) => (dataUrl ? s.put(dataUrl, cacheKey(key, v)) : s.delete(key))).catch(() => {});
  let shared = false, error = null;
  if (supabaseReady && bid()) {
    try {
      if (dataUrl) {
        const { error: e } = await supabase.storage.from(BUCKET).upload(fileName(key), await dataUrlBlob(dataUrl), { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
        if (e) throw e;
      } else {
        await supabase.storage.from(BUCKET).remove([fileName(key)]);
      }
      shared = true;
    } catch (e) {
      error = e?.message || String(e);
    }
  }
  listeners.forEach((l) => l(key));
  return { v, shared, error };
}

/** Uploads a photo that so far lives only on this phone (made before photos were shared). */
export async function sharePhoto(key, v) {
  if (!supabaseReady || !bid()) return null;
  const local = (v && (await getPhoto(cacheKey(key, v)))) || (await getPhoto(key));
  if (!local) return null;
  const r = await savePhoto(key, local);
  return r.shared ? r.v : null;
}

/** The photo to show: this phone's copy if it has one, otherwise the shared one. */
export function usePhoto(key, v) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!key) {
      setUrl(null);
      return undefined;
    }
    let alive = true;
    const load = async () => {
      const local = (await getPhoto(cacheKey(key, v))) || (!v ? await getPhoto(key) : null);
      if (alive) setUrl(local || (v ? remotePhotoUrl(key, v) : null));
    };
    load();
    const l = (k) => k === key && load();
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, [key, v]);
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
