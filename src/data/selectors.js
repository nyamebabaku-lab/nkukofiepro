// Small hooks for "who am I" and "which farm am I looking at".
import { useShallow } from 'zustand/react/shallow';
import { useDB, useSession } from './store';

export function useCurrentUser() {
  const userId = useSession((s) => s.userId);
  return useDB((s) => s.users.find((u) => u.id === userId) || null);
}

export function useCurrentCustomer() {
  const id = useSession((s) => s.customerId);
  return useDB((s) => s.customers.find((c) => c.id === id) || null);
}

/** Farms this user may see. */
export function useMyFarms() {
  const user = useCurrentUser();
  return useDB(useShallow((s) => (user?.role === 'owner' ? s.farms : s.farms.filter((f) => user?.farmIds?.includes(f.id)))));
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
