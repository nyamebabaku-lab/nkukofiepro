// Welcome screen: the 3D logo reveal (made in Blender) plays when the app opens and when someone
// comes back to it after being away. Silent; tap anywhere to skip. Plain DOM so it shows before the app has loaded.
import { isNative } from '../data/native';

const BG = '#122c1c'; // the video's own background green, so there's no flash around it
const AWAY_MS = 30000; // coming back sooner than this (e.g. after picking a photo) doesn't replay it
const BASE = import.meta.env.BASE_URL;
let el = null;
let hiddenAt = 0;
let started;
/** Resolves once the intro is playing (or isn't shown), so heavy app loading doesn't make it stutter. */
export const introStarted = new Promise((r) => { started = r; });

function close(fast) {
  const node = el;
  if (!node) return;
  el = null;
  node.style.opacity = '0';
  setTimeout(() => node.remove(), fast ? 150 : 450);
}

export function playIntro() {
  if (el || typeof document === 'undefined') return started();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return started();
  const portrait = window.innerHeight >= window.innerWidth;
  el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;inset:0;z-index:2147483000;background:${BG};display:flex;align-items:center;justify-content:center;transition:opacity .45s ease;cursor:pointer`;
  const v = document.createElement('video');
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'auto';
  v.setAttribute('muted', '');
  v.setAttribute('playsinline', '');
  v.setAttribute('webkit-playsinline', '');
  const ext = v.canPlayType('video/mp4; codecs="avc1.4D401F"') ? 'mp4' : 'webm'; // WebM for browsers without H.264
  v.src = `${BASE}intro/intro-${portrait ? '9x16' : '16x9'}.${ext}`;
  v.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none';
  el.appendChild(v);
  const node = el;
  const done = () => el === node && close();
  v.addEventListener('ended', done);
  v.addEventListener('error', () => { started(); if (el === node) close(true); });
  v.addEventListener('playing', () => {
    setTimeout(started, 250);
    if (isNative()) import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 })).catch(() => {});
  }, { once: true });
  el.addEventListener('click', () => el === node && close(true));
  setTimeout(done, 6000); // never hold anyone up if the video stalls
  document.body.appendChild(el);
  const p = v.play();
  if (p?.catch) p.catch(() => { started(); if (el === node) close(true); }); // autoplay refused
  setTimeout(started, 1500);
}

/** Plays on open, and again on return after being away for a while. */
export function startIntro() {
  playIntro();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      close(true);
    } else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) {
      playIntro();
    }
  });
}
