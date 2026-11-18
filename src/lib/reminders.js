// Task & vaccination reminders on this device.
// Android app: real phone notifications scheduled ahead (they fire even when the app is closed or offline).
// Browser: a notification / toast while the app is open.
// SMS for urgent misses and the owner's daily summaries are sent by the server (supabase/functions/farm-reminders).
import { useEffect, useRef } from 'react';
import { addDays, format } from 'date-fns';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useDB } from '../data/store';
import { storeKey, MODE } from '../config';
import { isNative } from '../data/native';
import { tasksFor, isMine } from './tasks';
import { toast } from '../components/ui';
import { appName } from './brand';

export const useReminderPrefs = create(persist(
  (set) => ({ enabled: true, leadMin: 0, vaccines: true, set: (p) => set(p) }),
  { name: storeKey('nkukofie-reminders') },
));

const DAYS_AHEAD = 3;
const MAX = 60; // Android allows ~500 pending; keep it light
const ID_BASE = 700000;

/** Upcoming reminders for this person over the next few days. */
export function upcomingReminders(db, user, { leadMin = 0, vaccines = true } = {}) {
  if (!user) return [];
  const now = Date.now();
  const out = [];
  const myFarms = user.role === 'owner' ? db.farms.map((f) => f.id) : user.farmIds || [];
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const date = format(addDays(new Date(), d), 'yyyy-MM-dd');
    tasksFor(db, { date, farmIds: myFarms }).filter((t) => !t.done && isMine(t, user)).forEach((t) => {
      const at = new Date(`${date}T${t.time}:00`).getTime() - leadMin * 60000;
      if (at > now) out.push({ key: `t:${t.id}:${date}`, at, title: `${t.important ? '⚠️ ' : ''}${t.title}`, body: `Task at ${t.time}. Tap to open your list.`, link: '/app/tasks' });
    });
    if (vaccines && user.role !== 'customer') {
      db.vaccinations.filter((v) => v.status === 'due' && v.dueDate === date && myFarms.includes(v.farmId)).forEach((v) => {
        const f = db.flocks.find((x) => x.id === v.flockId);
        if (!f || f.status !== 'active') return;
        const at = new Date(`${date}T07:00:00`).getTime();
        if (at > now) out.push({ key: `v:${v.id}`, at, title: `💉 ${v.name} · ${f.code}`, body: `${v.method}. Due today.`, link: '/app/health' });
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX);
}

const hashId = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return ID_BASE + (Math.abs(h) % 1000000); };

let LN = null;
async function plugin() {
  if (!isNative()) return null;
  if (!LN) {
    LN = (await import('@capacitor/local-notifications')).LocalNotifications;
    await LN.createChannel({ id: 'tasks', name: 'Farm tasks & vaccines', importance: 5, visibility: 1, vibration: true }).catch(() => {});
    LN.addListener('localNotificationActionPerformed', (e) => { const link = e.notification?.extra?.link; if (link) window.location.hash = `#${link}`; });
  }
  return LN;
}

/** Ask for permission (Android 13+ and browsers). */
export async function askReminderPermission() {
  const ln = await plugin();
  if (ln) { const r = await ln.requestPermissions(); return r.display === 'granted'; }
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

async function scheduleNative(list) {
  const ln = await plugin();
  if (!ln) return false;
  const perm = await ln.checkPermissions();
  if (perm.display !== 'granted') return false;
  const pending = await ln.getPending();
  const ours = pending.notifications.filter((n) => n.id >= ID_BASE);
  if (ours.length) await ln.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  if (!list.length) return true;
  await ln.schedule({ notifications: list.map((r) => ({ id: hashId(r.key), title: r.title, body: r.body, channelId: 'tasks', schedule: { at: new Date(r.at), allowWhileIdle: true }, extra: { link: r.link }, smallIcon: 'ic_stat_notify', iconColor: '#1f3d2b' })) });
  return true;
}

/** Keeps this device's reminders in step with the data. Mount once inside the app shell. */
export function useReminders(user) {
  const tasks = useDB((s) => s.tasks);
  const runs = useDB((s) => s.taskRuns);
  const vacc = useDB((s) => s.vaccinations);
  const prefs = useReminderPrefs();
  const shown = useRef(new Set());
  const listRef = useRef([]);

  // ask once on the phone for notification permission after sign-in
  useEffect(() => {
    if (!user || !isNative() || MODE === 'main') return;
    const k = storeKey('nkukofie-notif-asked');
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch { /* ignore */ }
    askReminderPermission().catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || MODE === 'main') return undefined;
    const id = setTimeout(() => {
      const list = prefs.enabled ? upcomingReminders(useDB.getState(), user, prefs) : [];
      listRef.current = list;
      scheduleNative(list).catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [tasks, runs, vacc, user, prefs.enabled, prefs.leadMin, prefs.vaccines]); // eslint-disable-line react-hooks/exhaustive-deps

  // browser: fire while the app is open
  useEffect(() => {
    if (!user || isNative() || MODE === 'main') return undefined;
    const tick = () => {
      const now = Date.now();
      listRef.current.filter((r) => r.at <= now && r.at > now - 90000 && !shown.current.has(r.key)).forEach((r) => {
        shown.current.add(r.key);
        toast.info(r.title, r.body);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try { const n = new Notification(r.title, { body: r.body, icon: './icon-192.png', tag: r.key }); n.onclick = () => { window.focus(); window.location.hash = `#${r.link}`; }; } catch { /* some browsers need a service worker */ }
        }
      });
    };
    const iv = setInterval(tick, 30000);
    tick();
    return () => clearInterval(iv);
  }, [user]);
}

/** Sends one test notification right away (to check permission and sound). */
export async function testReminder() {
  const ln = await plugin();
  const title = `${appName()} reminder test`;
  const body = 'Reminders are working on this phone.';
  if (ln) {
    if ((await ln.checkPermissions()).display !== 'granted' && !(await askReminderPermission())) return false;
    await ln.schedule({ notifications: [{ id: ID_BASE - 1, title, body, channelId: 'tasks', schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true }, smallIcon: 'ic_stat_notify', iconColor: '#1f3d2b' }] });
    return true;
  }
  if (!(await askReminderPermission())) { toast.info(title, body); return false; }
  try { new Notification(title, { body, icon: './icon-192.png' }); } catch { toast.info(title, body); }
  return true;
}

