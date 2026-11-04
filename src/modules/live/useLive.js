// Decides what a live app shows: sign-in, waiting/blocked screens, or the app itself.
import { create } from 'zustand';
import { MODE } from '../../config';
import { supabase, supabaseReady } from '../../data/supabase';
import { useSession } from '../../data/store';
import { fetchProfile, enterApp, signOut } from '../../lib/accounts';

export const APP_ROLES = MODE === 'admin' ? ['owner', 'super_admin'] : ['customer', 'worker', 'manager'];

export const useLive = create(() => ({ phase: 'boot', profile: null, notice: null }));
const set = (p) => useLive.setState(p);

let watch = null;
function watchMe(profile) {
  if (watch) supabase.removeChannel(watch);
  watch = supabase
    .channel(`me-${profile.user_id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${profile.user_id}` }, () => refresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', ...(profile.business_id ? { filter: `id=eq.${profile.business_id}` } : {}) }, () => refresh())
    .subscribe();
}

export async function decide(profile) {
  if (!profile) return set({ phase: 'out', profile: null });
  if (profile.missing) {
    await signOut();
    return set({ phase: 'out', profile: null, notice: 'Your sign-up was not finished. Please create your account again.' });
  }
  set({ profile });
  watchMe(profile);
  if (!APP_ROLES.includes(profile.role)) return set({ phase: 'wrongApp' });
  if (profile.role !== 'super_admin' && profile.business?.status !== 'active') return set({ phase: profile.business?.status === 'pending' ? 'pending' : 'businessBlocked' });
  if (profile.status !== 'active') return set({ phase: profile.status === 'pending' ? 'pending' : 'blocked' });
  const was = useLive.getState().phase;
  if (was !== 'in') {
    set({ phase: 'loading' });
    await enterApp(profile, { viewBusinessId: useSession.getState().viewBusinessId });
  } else useSession.getState().setProfile(profile);
  return set({ phase: 'in' });
}

export async function refresh() {
  try {
    await decide(await fetchProfile());
  } catch (e) {
    // Offline: carry on with the account and data saved on this phone.
    const cached = useSession.getState().profile;
    if (!navigator.onLine && cached?.status === 'active') {
      if (useLive.getState().phase !== 'in') await enterApp(cached).catch(() => {});
      set({ phase: 'in', profile: cached });
    } else set({ phase: 'error', notice: e.message });
  }
}

export async function boot() {
  if (!supabaseReady) return set({ phase: 'unconfigured' });
  await refresh();
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') set({ phase: 'out', profile: null });
  });
}

export async function leave(notice) {
  if (watch) supabase.removeChannel(watch);
  watch = null;
  await signOut();
  set({ phase: 'out', profile: null, notice: notice || null });
}
