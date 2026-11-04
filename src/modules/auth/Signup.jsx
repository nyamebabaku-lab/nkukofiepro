import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useCart, useDB, useSession } from '../../data/store';
import { Button, FormFields, toast } from '../../components/ui';
import Logo from '../../components/layout/Logo';

const FIELDS = [
  { name: 'name', label: 'Full name or business name', required: true, span: 2 },
  { name: 'phone', label: 'Phone (MoMo number)', type: 'tel', required: true, placeholder: '024 123 4567' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'optional' },
  { name: 'type', label: 'I am buying as', type: 'select', options: [{ value: 'retail', label: 'Household' }, { value: 'trader', label: 'Trader / reseller' }, { value: 'business', label: 'Restaurant, hotel or business' }], required: true },
  { name: 'location', label: 'Town / area', placeholder: 'e.g. Adenta' },
  { name: 'password', label: 'Password', type: 'password', required: true, span: 2, hint: 'At least 6 characters' },
];

export default function Signup() {
  const [v, setV] = useState({ type: 'retail' });
  const loginCustomer = useSession((s) => s.loginCustomer);
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    const db = useDB.getState();
    const missing = FIELDS.filter((f) => f.required && !String(v[f.name] || '').trim());
    if (missing.length) return toast.error('Missing information', missing.map((m) => m.label).join(', '));
    if (String(v.password).length < 6) return toast.error('Password too short', 'Use at least 6 characters');
    const phone = v.phone.replace(/\s/g, '');
    if (!/^0\d{9}$/.test(phone)) return toast.error('Check the phone number', 'Use a 10-digit Ghana number, e.g. 0241234567');
    if (db.customers.some((c) => c.phone.replace(/\s/g, '') === phone)) return toast.error('Already registered', 'That phone number has an account — sign in instead');
    const c = db.add('customers', { ...v, phone, notes: '' });
    db.notify({ toRoles: ['owner', 'manager'], title: 'New customer sign-up', text: `${c.name} · ${c.phone}`, link: `/app/customers/${c.id}` });
    loginCustomer(c.id);
    toast.success('Account created', 'You can now book and pay for orders');
    navigate(useCart.getState().lines.length ? '/cart' : '/shop');
    return null;
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-4 py-10 dark:bg-navy-950">
      <div className="w-full max-w-lg">
        <Link to="/"><Logo className="mb-8 justify-center" /></Link>
        <form onSubmit={submit} className="card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-brand-900 dark:text-white">Create your customer account</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Book eggs, birds, meat and chicks, choose your pick-up day and pay with MoMo or card.</p>
          <FormFields fields={FIELDS} value={v} onChange={setV} />
          <Button type="submit" size="lg" className="mt-6 w-full" icon={UserPlus}>Create account</Button>
          <p className="mt-4 text-center text-sm text-slate-500">Already have one? <Link to="/login" state={{ customer: true }} className="font-semibold text-brand-700 dark:text-gold-400">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
