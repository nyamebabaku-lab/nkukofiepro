// Live accounts: phone + password sign-in, sign-up with a farm code, business registration,
// approvals and status changes. Every rule is enforced again in the database (supabase/migrations).
import { supabase, normPhone, phoneEmail, errorText } from '../data/supabase';
import { useDB, useSession } from '../data/store';
import { startSync, stopSync } from '../data/sync';

export const STATUS = {
  pending: { label: 'Waiting for approval', tone: 'amber' },
  active: { label: 'Active', tone: 'green' },
  suspended: { label: 'Suspended', tone: 'red' },
  deactivated: { label: 'Deactivated', tone: 'slate' },
};
export const MEMBER_ROLES = [
  { value: 'customer', label: 'Customer' },
  { value: 'worker', label: 'Farm worker' },
  { value: 'manager', label: 'Farm manager' },
];
export const roleLabel = (r) => ({ super_admin: 'Super admin', owner: 'Owner', manager: 'Farm manager', worker: 'Farm worker', customer: 'Customer' }[r] || r);

const fail = (e) => {
  throw new Error(errorText(e));
};
const must = ({ data, error }) => (error ? fail(error) : data);

function checkPhone(phone) {
  const p = normPhone(phone);
  if (!p) throw new Error('Enter a 10-digit Ghana number, e.g. 0241234567');
  return p;
}

/** Signs in, or creates the login if it doesn't exist yet (used by every sign-up form). */
async function authFor(phone, password, create) {
  if (String(password).length < 6) throw new Error('Password must be at least 6 characters');
  const email = phoneEmail(phone);
  if (create) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.session) return data.session;
    if (error && !/already registered|already been registered/i.test(error.message)) fail(error);
  }
  return must(await supabase.auth.signInWithPassword({ email, password })).session;
}

export async function fetchProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  const profile = must(await supabase.from('profiles').select('*').eq('user_id', u.user.id).maybeSingle());
  if (!profile) return { user_id: u.user.id, missing: true };
  if (profile.business_id) profile.business = must(await supabase.from('businesses').select('*').eq('id', profile.business_id).maybeSingle());
  return profile;
}

export async function signIn(phone, password) {
  await authFor(checkPhone(phone), password, false);
  return fetchProfile();
}

export async function businessByCode(code) {
  const rows = must(await supabase.rpc('business_by_code', { code }));
  return rows?.[0] || null;
}

export async function signUpMember({ fullName, phone, password, code, role }) {
  const p = checkPhone(phone);
  if (!fullName?.trim()) throw new Error('Enter your full name');
  if (!(await businessByCode(code))) throw new Error('That farm code was not found. Ask the farm for its code.');
  await authFor(p, password, true);
  const existing = await fetchProfile();
  if (existing && !existing.missing) throw new Error('That phone number already has an account — sign in instead');
  must(await supabase.rpc('sign_up_member', { code, member_role: role, full_name: fullName.trim(), phone: p }));
  return fetchProfile();
}

export async function registerBusiness({ bizName, bizLocation, bizPhone, fullName, phone, password }) {
  const p = checkPhone(phone);
  if (!bizName?.trim() || !fullName?.trim()) throw new Error('Enter the business name and your name');
  await authFor(p, password, true);
  const existing = await fetchProfile();
  if (existing && !existing.missing) throw new Error('That phone number already has an account — sign in instead');
  must(await supabase.rpc('register_business', { biz_name: bizName.trim(), biz_location: bizLocation || '', biz_phone: bizPhone || p, full_name: fullName.trim(), phone: p }));
  return fetchProfile();
}

export const superAdminExists = async () => must(await supabase.rpc('super_admin_exists'));

export async function claimSuperAdmin({ fullName, phone, password }) {
  const p = checkPhone(phone);
  await authFor(p, password, true);
  must(await supabase.rpc('claim_super_admin', { full_name: fullName.trim(), phone: p }));
  return fetchProfile();
}

/** Puts a signed-in, active account into the app: session + the business's data. */
export async function enterApp(profile, { viewBusinessId } = {}) {
  const s = useSession.getState();
  s.setProfile(profile);
  if (profile.role === 'super_admin') {
    useSession.setState({ userId: profile.user_id, customerId: null, viewBusinessId: viewBusinessId || null });
    if (viewBusinessId) await startSync(viewBusinessId, { role: 'owner', readOnly: true });
    else stopSync();
    return;
  }
  if (profile.role === 'customer') useSession.setState({ customerId: profile.user_id, userId: null });
  else useSession.setState({ userId: profile.user_id, customerId: null });
  await startSync(profile.business_id, { role: profile.role });
}

export async function signOut() {
  stopSync();
  try {
    await supabase.auth.signOut();
  } catch {
    /* offline: the local session is cleared anyway */
  }
  useSession.getState().logout();
  useDB.getState().loadBusiness({});
}

// ---------- approvals & status (owner for their people, super admin for everyone) ----------
export const setAccountStatus = async (userId, status, reason) => must(await supabase.rpc('set_account_status', { target: userId, new_status: status, reason: reason || null }));
export const setMemberRole = async (userId, role) => must(await supabase.rpc('set_member_role', { target: userId, new_role: role }));
export const deleteAccount = async (userId) => must(await supabase.rpc('delete_account', { target: userId }));
export const regenerateFarmCode = async () => must(await supabase.rpc('regenerate_farm_code'));
export const setBusinessStatus = async (id, status, reason) => must(await supabase.rpc('set_business_status', { bid: id, new_status: status, reason: reason || null }));
export const setBusinessTest = async (id, flag) => must(await supabase.rpc('set_business_test', { bid: id, flag }));
export const deleteBusiness = async (id) => must(await supabase.rpc('delete_business', { bid: id }));
export const clearTestData = async () => must(await supabase.rpc('clear_test_data'));
export const setPlatform = async ({ demo = null, testing = null }) => must(await supabase.rpc('set_platform', { demo, testing }));
export const platformSettings = async () => must(await supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle());
export const setPlatformBranding = async (name, logo) => must(await supabase.rpc('set_platform_branding', { new_name: name, new_logo: logo || null }));
export const setBusinessLogo = async (logo) => must(await supabase.rpc('set_business_logo', { new_logo: logo || null }));

export async function listProfiles(businessId) {
  let q = supabase.from('profiles').select('*').order('requested_at', { ascending: false });
  if (businessId) q = q.eq('business_id', businessId);
  return must(await q);
}
export const listBusinesses = async () => must(await supabase.from('businesses').select('*').order('created_at', { ascending: false }));
export const listAudit = async (businessId) => {
  let q = supabase.from('platform_audit').select('*').order('at', { ascending: false }).limit(200);
  if (businessId) q = q.eq('business_id', businessId);
  return must(await q);
};

/** Calls back whenever profiles/businesses change (approvals arriving, status changes). */
export function watchAccounts(onChange) {
  const ch = supabase
    .channel(`accounts-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ---------- passwords ----------
/** "Forgot password?": tells the farm owner (or the super admin, for owners). Same answer for any number. */
export async function requestReset(phone) {
  must(await supabase.rpc('request_password_reset', { phone: checkPhone(phone) }));
}

/** 6-digit temporary password that is easy to read out over the phone. */
function tempPassword() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(100000 + (n[0] % 900000));
}

/** Owner / super admin: sets a temporary password and returns it to pass on. */
export async function resetPassword(userId) {
  const code = tempPassword();
  must(await supabase.rpc('admin_reset_password', { target: userId, temp_password: code }));
  return code;
}

/** Signed-in user chooses a new password (also used right after a reset). */
export async function changeMyPassword(next, confirm) {
  if (String(next).length < 6) throw new Error('Password must be at least 6 characters');
  if (confirm !== undefined && next !== confirm) throw new Error('The two passwords are not the same');
  must(await supabase.auth.updateUser({ password: next }));
  must(await supabase.rpc('password_changed'));
}
