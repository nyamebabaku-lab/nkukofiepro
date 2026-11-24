// Marketplace: farms' listings, bulk buyers' requests with farms' offers, marketplace orders, verified buyers.
// Live apps read and write the market_* tables (rules in supabase/migrations/20261124000000_market_payments_vet.sql).
// The demo runs the same screens on a small in-memory market so it can be tried without an account.
import { create } from 'zustand';
import { addDays, format } from 'date-fns';
import { LIVE } from '../config';
import { supabase } from '../data/supabase';

export const CATEGORIES = [
  { value: 'eggs', label: 'Eggs' },
  { value: 'live', label: 'Live birds' },
  { value: 'meat', label: 'Dressed meat' },
  { value: 'chicks', label: 'Chicks & pullets' },
  { value: 'other', label: 'Other' },
];
export const UNITS = ['crate', 'bird', 'kg', 'chick', 'bag', 'piece'];
export const BUYER_TYPES = [
  { value: 'household', label: 'Household', sub: 'Buy for home — no approval needed' },
  { value: 'trader', label: 'Trader / market seller', sub: 'Wholesale prices after approval' },
  { value: 'bulk', label: 'Bulk buyer', sub: 'Hotel, restaurant, school, caterer, supermarket, processor' },
  { value: 'government', label: 'Government / programme', sub: 'School feeding, Nkokɔ Nkitinkiti off-take, institutions' },
];
export const buyerLabel = (t) => BUYER_TYPES.find((b) => b.value === t)?.label || t;
export const catLabel = (c) => CATEGORIES.find((x) => x.value === c)?.label || c;
export const ORDER_STATUS = {
  new: { label: 'New', tone: 'gold' },
  confirmed: { label: 'Confirmed', tone: 'sky' },
  ready: { label: 'Ready', tone: 'teal' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const day = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd');

// ----------------------------------------------------------------- demo market (in memory)
const DEMO_FARMS = [
  { id: 'demo-own', name: 'Nkukɔ Fie Farms', location: 'Dodowa', region: 'Greater Accra', district: 'Shai-Osudoku', phone: '0302 123 456' },
  { id: 'demo-2', name: 'Asante Gold Poultry', location: 'Ejisu', region: 'Ashanti', district: 'Ejisu', phone: '024 555 0101' },
  { id: 'demo-3', name: 'Volta Fresh Eggs', location: 'Ho', region: 'Volta', district: 'Ho Municipal', phone: '020 444 7788' },
  { id: 'demo-4', name: 'Northern Guinea Fowl Co.', location: 'Tamale', region: 'Northern', district: 'Tamale Metro', phone: '055 123 9090' },
];
const L = (id, business_id, title, category, unit, price, wholesale_price, qty, from = 0, note = '') => ({ id, business_id, title, category, unit, price, wholesale_price, min_wholesale_qty: wholesale_price ? 20 : null, qty, available_from: day(from), status: 'open', note });
const useDemo = create(() => ({
  me: { user_id: 'demo-buyer', full_name: 'Kofi Boateng', phone: '0244000111', buyer_type: 'bulk', org_name: 'Golden Tulip Kumasi (demo)', region: 'Ashanti', district: 'Kumasi Metro', verified: true },
  listings: [
    L('l1', 'demo-own', 'Large eggs — crate of 30', 'eggs', 'crate', 82, 76, 120, 0, 'Collected daily, graded by size'),
    L('l2', 'demo-own', 'Broilers ~2.2 kg live', 'live', 'bird', 135, 125, 400, 6, 'Flock B-2611 ready next week'),
    L('l3', 'demo-2', 'Medium eggs — crate', 'eggs', 'crate', 74, 70, 300),
    L('l4', 'demo-2', 'Dressed chicken (frozen)', 'meat', 'kg', 68, 62, 250, 0, 'Vacuum packed, cold room on site'),
    L('l5', 'demo-3', 'Point-of-lay pullets (16 wks)', 'chicks', 'bird', 95, 90, 500, 10),
    L('l6', 'demo-4', 'Guinea fowl — live', 'live', 'bird', 160, 150, 150, 0, 'Free-range, Tamale'),
    L('l7', 'demo-3', 'Day-old broiler chicks', 'chicks', 'chick', 14, 12.5, 2000, 3),
  ],
  requests: [
    { id: 'r1', buyer_id: 'demo-buyer', title: 'Broilers for Christmas banquets', category: 'live', qty: 500, unit: 'bird', target_weight_kg: 2.0, needed_by: day(18), region: 'Ashanti', district: 'Kumasi Metro', budget_per_unit: 130, delivery: true, note: 'Deliver to hotel, half on 18th and half on 22nd', status: 'open', created_at: new Date().toISOString(), buyer_type: 'bulk' },
    { id: 'r2', buyer_id: 'other', title: 'Eggs for school feeding — weekly', category: 'eggs', qty: 200, unit: 'crate', needed_by: day(9), region: 'Greater Accra', district: 'Shai-Osudoku', budget_per_unit: 72, delivery: false, note: 'Weekly supply for 3 months', status: 'open', created_at: new Date().toISOString(), buyer_type: 'government' },
  ],
  offers: [
    { id: 'o1', request_id: 'r1', business_id: 'demo-2', price_per_unit: 128, qty: 300, ready_date: day(16), avg_weight_kg: 2.1, note: 'Can deliver to Kumasi', status: 'sent', created_at: new Date().toISOString() },
    { id: 'o2', request_id: 'r1', business_id: 'demo-own', price_per_unit: 132, qty: 400, ready_date: day(14), avg_weight_kg: 2.2, flock_code: 'B-2611', status: 'sent', created_at: new Date().toISOString() },
  ],
  orders: [
    { id: 'm1', ref: 'MK7Q2D1', business_id: 'demo-own', buyer_id: 'other', buyer_name: 'Mama Akos (trader)', buyer_phone: '0245556677', title: 'Large eggs — crate of 30', qty: 40, unit: 'crate', unit_price: 76, total: 3040, deposit_paid: 900, pickup_date: day(2), status: 'confirmed', created_at: new Date().toISOString() },
  ],
}));
const dset = (fn) => useDemo.setState((s) => fn(s));
const nid = () => Math.random().toString(36).slice(2, 10);

// ----------------------------------------------------------------- buyers
export async function myBuyer() {
  if (!LIVE) return useDemo.getState().me;
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  return must(await supabase.from('market_buyers').select('*').eq('user_id', u.user.id).maybeSingle());
}
export async function becomeBuyer({ fullName, phone, kind, org, region, district }) {
  if (!LIVE) return dset((s) => ({ me: { ...s.me, buyer_type: kind, org_name: org, region, district, verified: kind === 'household' || s.me.verified } }));
  return must(await supabase.rpc('become_buyer', { full_name: fullName, phone, kind, org: org || null, reg: region || null, dist: district || null }));
}
export async function listBuyers() {
  return must(await supabase.from('market_buyers').select('*').order('created_at', { ascending: false }));
}
export const verifyBuyer = async (userId, ok) => must(await supabase.rpc('verify_buyer', { target: userId, ok }));

// ----------------------------------------------------------------- farms & listings
export async function marketFarms() {
  if (!LIVE) return DEMO_FARMS.map((f) => ({ ...f, listings: useDemo.getState().listings.filter((l) => l.business_id === f.id && l.status === 'open').length }));
  return must(await supabase.rpc('market_farms'));
}
export async function openListings() {
  if (!LIVE) return useDemo.getState().listings.filter((l) => l.status === 'open');
  return must(await supabase.from('market_listings').select('*').eq('status', 'open').order('available_from').limit(500));
}
export async function farmListings(businessId) {
  if (!LIVE) return useDemo.getState().listings.filter((l) => l.business_id === 'demo-own');
  return must(await supabase.from('market_listings').select('*').eq('business_id', businessId).order('created_at', { ascending: false }));
}
export async function saveListing(businessId, v) {
  const row = { business_id: businessId, title: v.title, category: v.category, unit: v.unit, price: +v.price, wholesale_price: v.wholesale_price ? +v.wholesale_price : null, min_wholesale_qty: v.min_wholesale_qty ? +v.min_wholesale_qty : null, qty: +v.qty || 0, available_from: v.available_from, available_to: v.available_to || null, note: v.note || null, status: v.status || 'open', product_id: v.product_id || null };
  if (!LIVE) return dset((s) => ({ listings: v.id ? s.listings.map((l) => (l.id === v.id ? { ...l, ...row, business_id: 'demo-own' } : l)) : [{ ...row, id: nid(), business_id: 'demo-own' }, ...s.listings] }));
  if (v.id) return must(await supabase.from('market_listings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', v.id));
  return must(await supabase.from('market_listings').insert(row));
}
export async function setListingStatus(id, status) {
  if (!LIVE) return dset((s) => ({ listings: s.listings.map((l) => (l.id === id ? { ...l, status } : l)) }));
  return must(await supabase.from('market_listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id));
}

// ----------------------------------------------------------------- buying from a listing
export async function orderListing({ listingId, qty, pickup, delivery, address, note }) {
  if (!LIVE) {
    const s = useDemo.getState();
    const l = s.listings.find((x) => x.id === listingId);
    const price = s.me.verified && s.me.buyer_type !== 'household' && l.wholesale_price && qty >= (l.min_wholesale_qty || 0) ? l.wholesale_price : l.price;
    const o = { id: nid(), ref: `MK${nid().slice(0, 6).toUpperCase()}`, business_id: l.business_id, buyer_id: 'demo-buyer', buyer_name: s.me.org_name || s.me.full_name, buyer_phone: s.me.phone, listing_id: l.id, title: l.title, qty: +qty, unit: l.unit, unit_price: price, total: price * qty, deposit_paid: 0, pickup_date: pickup, delivery, address, note, status: 'new', created_at: new Date().toISOString() };
    dset((st) => ({ orders: [o, ...st.orders], listings: st.listings.map((x) => (x.id === l.id && x.qty ? { ...x, qty: x.qty - qty } : x)) }));
    return o;
  }
  const id = must(await supabase.rpc('order_listing', { listing: listingId, quantity: +qty, pickup, want_delivery: !!delivery, addr: address || null, msg: note || null }));
  return must(await supabase.from('market_orders').select('*').eq('id', id).single());
}

// ----------------------------------------------------------------- requests & offers
export async function openRequests() {
  if (!LIVE) return useDemo.getState().requests.filter((r) => r.status === 'open');
  return must(await supabase.from('market_requests').select('*').eq('status', 'open').order('needed_by').limit(300));
}
export async function myRequests() {
  if (!LIVE) return useDemo.getState().requests.filter((r) => r.buyer_id === 'demo-buyer');
  const { data: u } = await supabase.auth.getUser();
  return must(await supabase.from('market_requests').select('*').eq('buyer_id', u.user.id).order('created_at', { ascending: false }));
}
export async function postRequest(v) {
  const row = { title: v.title, category: v.category, qty: +v.qty, unit: v.unit, target_weight_kg: v.target_weight_kg ? +v.target_weight_kg : null, needed_by: v.needed_by, region: v.region || null, district: v.district || null, location: v.location || null, budget_per_unit: v.budget_per_unit ? +v.budget_per_unit : null, delivery: !!v.delivery, note: v.note || null };
  if (!LIVE) return dset((s) => ({ requests: [{ ...row, id: nid(), buyer_id: 'demo-buyer', status: 'open', created_at: new Date().toISOString(), buyer_type: s.me.buyer_type }, ...s.requests] }));
  return must(await supabase.from('market_requests').insert(row));
}
export async function cancelRequest(id) {
  if (!LIVE) return dset((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)) }));
  return must(await supabase.from('market_requests').update({ status: 'cancelled' }).eq('id', id));
}
export async function offersFor(requestIds) {
  if (!requestIds.length) return [];
  if (!LIVE) return useDemo.getState().offers.filter((o) => requestIds.includes(o.request_id));
  return must(await supabase.from('market_offers').select('*').in('request_id', requestIds).order('price_per_unit'));
}
export async function farmOffers(businessId) {
  if (!LIVE) return useDemo.getState().offers.filter((o) => o.business_id === 'demo-own');
  return must(await supabase.from('market_offers').select('*').eq('business_id', businessId).order('created_at', { ascending: false }));
}
export async function sendOffer(businessId, v) {
  const row = { request_id: v.request_id, business_id: businessId, price_per_unit: +v.price_per_unit, qty: +v.qty, ready_date: v.ready_date, avg_weight_kg: v.avg_weight_kg ? +v.avg_weight_kg : null, flock_code: v.flock_code || null, note: v.note || null };
  if (!LIVE) return dset((s) => ({ offers: [{ ...row, id: nid(), business_id: 'demo-own', status: 'sent', created_at: new Date().toISOString() }, ...s.offers] }));
  return must(await supabase.from('market_offers').insert(row));
}
export async function withdrawOffer(id) {
  if (!LIVE) return dset((s) => ({ offers: s.offers.map((o) => (o.id === id ? { ...o, status: 'withdrawn' } : o)) }));
  return must(await supabase.from('market_offers').update({ status: 'withdrawn' }).eq('id', id));
}
export async function acceptOffer(offerId, { pickup, delivery, address } = {}) {
  if (!LIVE) {
    const s = useDemo.getState();
    const o = s.offers.find((x) => x.id === offerId);
    const r = s.requests.find((x) => x.id === o.request_id);
    const order = { id: nid(), ref: `MK${nid().slice(0, 6).toUpperCase()}`, business_id: o.business_id, buyer_id: 'demo-buyer', buyer_name: s.me.org_name, buyer_phone: s.me.phone, offer_id: o.id, title: r.title, qty: o.qty, unit: r.unit, unit_price: o.price_per_unit, total: o.qty * o.price_per_unit, deposit_paid: 0, pickup_date: pickup || o.ready_date, delivery: !!delivery, address, status: 'new', created_at: new Date().toISOString() };
    dset((st) => ({ offers: st.offers.map((x) => (x.id === offerId ? { ...x, status: 'accepted' } : x)), requests: st.requests.map((x) => (x.id === r.id ? { ...x, status: 'awarded' } : x)), orders: [order, ...st.orders] }));
    return order;
  }
  const id = must(await supabase.rpc('accept_offer', { offer: offerId, pickup: pickup || null, want_delivery: !!delivery, addr: address || null }));
  return must(await supabase.from('market_orders').select('*').eq('id', id).single());
}

// ----------------------------------------------------------------- marketplace orders
export async function buyerOrders() {
  if (!LIVE) return useDemo.getState().orders.filter((o) => o.buyer_id === 'demo-buyer');
  const { data: u } = await supabase.auth.getUser();
  return must(await supabase.from('market_orders').select('*').eq('buyer_id', u.user.id).order('created_at', { ascending: false }));
}
export async function farmMarketOrders(businessId) {
  if (!LIVE) return useDemo.getState().orders.filter((o) => o.business_id === 'demo-own');
  return must(await supabase.from('market_orders').select('*').eq('business_id', businessId).order('created_at', { ascending: false }));
}
export async function setMarketOrderStatus(id, status) {
  if (!LIVE) return dset((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
  return must(await supabase.from('market_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id));
}
/** Demo only: marks a deposit as paid (live deposits are recorded by the payment server). */
export const demoDeposit = (id, amount) => dset((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, deposit_paid: (o.deposit_paid || 0) + amount, status: o.status === 'new' ? 'confirmed' : o.status } : o)) }));

/** Re-renders when the market changes (realtime in the live apps, the store in the demo). */
export function subscribeMarket(onChange) {
  if (!LIVE) return useDemo.subscribe(onChange);
  const ch = supabase
    .channel(`market-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_orders' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_offers' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'market_requests' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}
export const DEMO_OWN_FARM = 'demo-own';
