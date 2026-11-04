import {
  LayoutDashboard, ClipboardPen, Warehouse, Bird, Syringe, Egg, Package, ShoppingBag, Store, CalendarClock, Users, Tags,
  LineChart, Wallet, Banknote, UserCog, ListChecks, Clock, Wrench, BarChart3, Settings, Bell,
} from 'lucide-react';

export const ROLES = {
  owner: { label: 'Owner', tone: 'gold' },
  manager: { label: 'Farm manager', tone: 'green' },
  worker: { label: 'Farm worker', tone: 'sky' },
};

export const NAV = [
  { group: 'Overview', items: [
    { key: 'dashboard', label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { key: 'log', label: 'Daily records', path: '/app/log', icon: ClipboardPen },
  ] },
  { group: 'Farm', items: [
    { key: 'farms', label: 'Farms & pens', path: '/app/farms', icon: Warehouse },
    { key: 'flocks', label: 'Flocks', path: '/app/flocks', icon: Bird },
    { key: 'health', label: 'Health & vaccines', path: '/app/health', icon: Syringe },
    { key: 'hatchery', label: 'Hatchery', path: '/app/hatchery', icon: Egg },
    { key: 'inventory', label: 'Inventory', path: '/app/inventory', icon: Package },
  ] },
  { group: 'Sales', items: [
    { key: 'orders', label: 'Orders', path: '/app/orders', icon: ShoppingBag },
    { key: 'pos', label: 'Point of sale', path: '/app/pos', icon: Store },
    { key: 'pickups', label: 'Pick-ups', path: '/app/pickups', icon: CalendarClock },
    { key: 'customers', label: 'Customers & debts', path: '/app/customers', icon: Users },
    { key: 'products', label: 'Products & prices', path: '/app/products', icon: Tags },
  ] },
  { group: 'Money', items: [
    { key: 'finance', label: 'Finance', path: '/app/finance', icon: LineChart },
    { key: 'wallet', label: 'Wallet', path: '/app/wallet', icon: Wallet },
    { key: 'payroll', label: 'Payroll', path: '/app/payroll', icon: Banknote },
  ] },
  { group: 'Team', items: [
    { key: 'staff', label: 'Staff', path: '/app/staff', icon: UserCog },
    { key: 'tasks', label: 'Tasks', path: '/app/tasks', icon: ListChecks },
    { key: 'attendance', label: 'Attendance', path: '/app/attendance', icon: Clock },
    { key: 'maintenance', label: 'Equipment', path: '/app/maintenance', icon: Wrench },
  ] },
  { group: 'Insights', items: [
    { key: 'reports', label: 'Reports', path: '/app/reports', icon: BarChart3 },
    { key: 'settings', label: 'Settings', path: '/app/settings', icon: Settings },
  ] },
];
export const EXTRA = [{ key: 'notifications', label: 'Notifications', path: '/app/notifications', icon: Bell }];

const ACCESS = {
  owner: '*',
  manager: ['dashboard', 'log', 'farms', 'flocks', 'health', 'hatchery', 'inventory', 'orders', 'pos', 'pickups', 'customers', 'products', 'staff', 'tasks', 'attendance', 'maintenance', 'reports', 'notifications'],
  worker: ['dashboard', 'log', 'flocks', 'health', 'hatchery', 'pickups', 'tasks', 'attendance', 'notifications'],
};
export const can = (role, key) => ACCESS[role] === '*' || (ACCESS[role] || []).includes(key);

export const navFor = (role) => NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(role, i.key)) })).filter((g) => g.items.length);
export const navItem = (key) => [...NAV.flatMap((g) => g.items), ...EXTRA].find((i) => i.key === key);

/** Bottom bar on phones: 4 tabs + the big "Log" button in the middle. */
export const MOBILE_TABS = {
  owner: ['dashboard', 'flocks', 'orders', 'wallet'],
  manager: ['dashboard', 'flocks', 'orders', 'tasks'],
  worker: ['dashboard', 'tasks', 'flocks', 'health'],
};
