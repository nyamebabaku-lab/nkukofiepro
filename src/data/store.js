// Single client-side data store. All reads/writes go through these actions,
// so swapping localStorage for a cloud backend (Supabase) later only touches this file.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildSeed } from './seed';
import { uid, nowISO } from '../lib/format';

export const DB_KEY = 'poultrypro-db';
export const DB_VERSION = 1;

const PREFIX = {
  farms: 'frm', pens: 'pen', flocks: 'flk', feedLogs: 'fd', eggLogs: 'egg', weightLogs: 'wt', mortality: 'mt', envLogs: 'env',
  flockMoves: 'fmv', vaccinations: 'vac', treatments: 'trt', hatchBatches: 'htc', items: 'itm', stockMoves: 'smv', suppliers: 'sup',
  products: 'prd', productMoves: 'pmv', customers: 'cus', orders: 'ord', payments: 'pay', walletTx: 'wtx', expenses: 'exp',
  users: 'usr', tasks: 'tsk', taskRuns: 'trn', attendance: 'att', advances: 'adv', payruns: 'prn', assets: 'ast', maintenance: 'mnt',
  notifications: 'ntf', smsLog: 'sms', audit: 'aud', vaccineTemplates: 'vtp',
};

// localStorage that reports a full device instead of failing silently.
let warned = 0;
const safeStorage = {
  getItem: (k) => localStorage.getItem(k),
  removeItem: (k) => localStorage.removeItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      if (Date.now() - warned > 30000) {
        warned = Date.now();
        window.dispatchEvent(new CustomEvent('poultrypro-storage-full', { detail: e.name }));
      }
    }
  },
};

const sessionUser = () => useSession.getState().userId;

export const useDB = create(
  persist(
    (set) => ({
      ...buildSeed(),

      add: (col, obj) => {
        const rec = { id: uid(PREFIX[col] || 'id'), createdAt: nowISO(), ...obj };
        set((s) => ({ [col]: [...s[col], rec] }));
        return rec;
      },
      addMany: (col, list) => {
        const recs = list.map((o) => ({ id: uid(PREFIX[col] || 'id'), createdAt: nowISO(), ...o }));
        set((s) => ({ [col]: [...s[col], ...recs] }));
        return recs;
      },
      update: (col, id, patch) =>
        set((s) => ({ [col]: s[col].map((r) => (r.id === id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)) })),
      remove: (col, id) => set((s) => ({ [col]: s[col].filter((r) => r.id !== id) })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      /** Appends to the audit trail (newest first, capped so storage stays small). */
      log: (action, detail, extra = {}) =>
        set((s) => ({ audit: [{ id: uid('aud'), at: nowISO(), userId: sessionUser() || null, action, detail, ...extra }, ...s.audit].slice(0, 500) })),
      /** In-app notification. Target with toRoles: ['owner','manager'], toUserId, or toCustomerId. */
      notify: (n) => set((s) => ({ notifications: [{ id: uid('ntf'), at: nowISO(), read: false, ...n }, ...s.notifications].slice(0, 300) })),
      markRead: (ids) => set((s) => ({ notifications: s.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) })),
      /** Simulated SMS (phase 2 sends these through an SMS gateway). */
      sms: (to, text) => set((s) => ({ smsLog: [{ id: uid('sms'), at: nowISO(), to, text, status: 'sent' }, ...s.smsLog].slice(0, 300) })),

      resetDemo: () => set({ ...buildSeed() }),
      importData: (data) => set({ ...buildSeed(), ...data }),
    }),
    {
      name: DB_KEY,
      version: DB_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')),
    },
  ),
);

/** Who is signed in, chosen farm, and UI preferences (kept apart from farm data). */
export const useSession = create(
  persist(
    (set) => ({
      userId: null, // staff user id
      customerId: null, // customer portal login
      farmId: 'all',
      dark: false,
      sidebarCollapsed: false,
      login: (userId) => set({ userId, customerId: null }),
      loginCustomer: (customerId) => set({ customerId, userId: null }),
      logout: () => set({ userId: null, customerId: null, farmId: 'all' }),
      setFarm: (farmId) => set({ farmId }),
      toggleDark: () => set((s) => ({ dark: !s.dark })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'poultrypro-session' },
  ),
);

/** Customer cart for the portal. */
export const useCart = create(
  persist(
    (set) => ({
      farmId: null,
      lines: [], // { productId, qty }
      setFarm: (farmId) => set({ farmId }),
      add: (productId, qty = 1) =>
        set((s) => {
          const ex = s.lines.find((l) => l.productId === productId);
          return { lines: ex ? s.lines.map((l) => (l.productId === productId ? { ...l, qty: l.qty + qty } : l)) : [...s.lines, { productId, qty }] };
        }),
      setQty: (productId, qty) => set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.productId !== productId) : s.lines.map((l) => (l.productId === productId ? { ...l, qty } : l)) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'poultrypro-cart' },
  ),
);
