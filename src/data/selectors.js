// Small hooks for "who am I" and "which farm am I looking at".
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDB, useSession } from './store';

export function useCurrentUser() {
  const userId = useSession((s) => s.userId);
  const profile = useSession((s) => s.profile);
  const viewing = useSession((s) => s.viewBusinessId);
  const rec = useDB((s) => s.users.find((u) => u.id === userId) || null);
  const farms = useDB((s) => s.farms);
  return useMemo(() => {
    if (!userId) return null;
    // Super admin opening a business for support: sees it like the owner, read-only.
    if (profile?.role === 'super_admin' && viewing) return { id: userId, name: profile.full_name, role: 'owner', position: 'Super admin · read-only', farmIds: farms.map((f) => f.id), readOnly: true, salary: 0 };
    if (rec) return profile && profile.user_id === userId ? { ...rec, role: profile.role } : rec;
    // Live apps: the staff card is created on approval; until it arrives, build one from the account.
    if (profile && profile.user_id === userId && profile.role !== 'customer')
      return { id: userId, name: profile.full_name, phone: profile.phone, role: profile.role, position: profile.role === 'owner' ? 'Owner' : profile.role === 'manager' ? 'Farm Manager' : 'Farm Worker', farmIds: profile.role === 'owner' ? farms.map((f) => f.id) : [], salary: 0, status: 'active' };
    return null;
  }, [userId, profile, viewing, rec, farms]);
}

export function useCurrentCustomer() {
  const id = useSession((s) => s.customerId);
  const profile = useSession((s) => s.profile);
  const rec = useDB((s) => s.customers.find((c) => c.id === id) || null);
  return useMemo(() => {
    if (!id) return null;
    if (rec) return rec;
    if (profile && profile.user_id === id) return { id, name: profile.full_name, phone: profile.phone, type: 'retail', location: '', email: '' };
    return null;
  }, [id, profile, rec]);
}

/** Farms this user may see. */
export function useMyFarms() {
  const user = useCurrentUser();
  // Staff without farms assigned yet see every farm of their business.
  return useDB(useShallow((s) => (user?.role === 'owner' || !user?.farmIds?.length ? s.farms : s.farms.filter((f) => user.farmIds.includes(f.id)))));
}

/** The farm filter in effect: 'all' (owner only) or a farm id the user belongs to. */
export function useFarmScope() {
  const user = useCurrentUser();
  const chosen = useSession((s) => s.farmId);
  const farms = useMyFarms();
  if (!user) return 'all';
  if (chosen !== 'all' && farms.some((f) => f.id === chosen)) return chosen;
  if (user.role === 'owner' || farms.length > 1) return 'all';
  return farms[0]?.id || 'all';
}

/** Filter helper: does a record with farmId belong in the current scope? (for multi-farm managers 'all' = their farms) */
export function useInScope() {
  const scope = useFarmScope();
  const farms = useMyFarms();
  const ids = farms.map((f) => f.id);
  return (farmId) => (scope === 'all' ? !farmId || ids.includes(farmId) : farmId === scope);
}

export const notificationsFor = (user, customer, list) =>
  list.filter((n) => {
    if (customer) return n.toCustomerId === customer.id;
    if (!user) return false;
    if (n.toCustomerId) return false;
    if (n.toUserId) return n.toUserId === user.id;
    if (n.toRoles && !n.toRoles.includes(user.role)) return false;
    if (n.farmId && user.role !== 'owner' && !user.farmIds.includes(n.farmId)) return false;
    return true;
  });
