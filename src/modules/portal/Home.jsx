import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Smartphone, ShieldCheck, Truck, Leaf, Syringe } from 'lucide-react';
import { useDB } from '../../data/store';
import { Button } from '../../components/ui';
import HeroPhoto from '../../components/HeroPhoto';
import { isNative, APK_URL } from '../../data/native';
import { ProductCard } from './Shop';
import { PRODUCT_CATEGORIES } from '../../lib/stock';

export default function Home() {
  const db = useDB();
  const featured = ['prd_egg_l', 'prd_broiler', 'prd_doc_b', 'prd_dressed', 'prd_turkey', 'prd_guinea', 'prd_egg_mh', 'prd_layer_bag'].map((id) => db.products.find((p) => p.id === id)).filter((p) => p?.onPortal);
  return (
    <div>
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <HeroPhoto />
        <div className="relative mx-auto flex min-h-[600px] max-w-6xl items-end px-4 pb-12 pt-64 sm:px-6 md:min-h-[600px] md:items-center md:py-20">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-300 ring-1 ring-white/10"><Leaf className="h-3.5 w-3.5" /> Straight from our farms in Dodowa, Ejisu & Kasoa</p>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Fresh eggs & healthy birds, <span className="text-gold-400">booked in a minute.</span></h1>
            <p className="mt-5 max-w-lg text-lg text-brand-100/80">Order eggs, live birds, dressed chicken, chicks, feed and drugs. Choose your pick-up day, pay a small deposit with MoMo or card, and pay the rest when you collect.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop"><Button size="lg" className="bg-gold-500 text-brand-950 hover:bg-gold-400" icon={ArrowRight}>Shop now</Button></Link>
              <Link to="/signup"><Button size="lg" variant="secondary" className="bg-white/10 text-white ring-white/20 hover:bg-white/20">Create account</Button></Link>
              {!isNative() && <a href={APK_URL}><Button size="lg" variant="secondary" icon={Smartphone} className="bg-white/10 text-white ring-white/20 hover:bg-white/20">Android app</Button></a>}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {PRODUCT_CATEGORIES.map((c) => (
            <Link key={c.value} to={`/shop?cat=${c.value}`} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift dark:bg-navy-900">
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-3xl font-semibold text-brand-900 dark:text-white">Popular this week</h2>
          <Link to="/shop" className="text-sm font-semibold text-brand-700 hover:underline dark:text-gold-400">See everything →</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{featured.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>

      <section className="border-y border-cream-200 bg-white py-14 dark:border-white/5 dark:bg-navy-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-semibold text-brand-900 dark:text-white">How booking works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              [ShoppingBasketIcon, 'Choose', 'Pick products and the farm closest to you.'],
              [CalendarCheck, 'Pick a day', 'Choose a pick-up date that suits you.'],
              [Smartphone, 'Pay a deposit', `Pay ${db.settings.depositPct}% (or everything) by MoMo or card.`],
              [Truck, 'Collect', 'Pay the balance at the farm and take your order home.'],
            ].map(([I, t, d], i) => (
              <div key={t} className="relative rounded-3xl bg-cream-100 p-6 dark:bg-white/5">
                <span className="absolute right-5 top-4 font-display text-5xl font-semibold text-cream-300 dark:text-white/10">{i + 1}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-white"><I className="h-6 w-6" /></span>
                <p className="mt-4 font-bold text-slate-900 dark:text-white">{t}</p>
                <p className="mt-1 text-sm text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3">
        {[[Syringe, 'Vaccinated flocks', 'Every flock follows a vet-approved vaccination plan.'], [ShieldCheck, 'Safe to eat', 'We never sell eggs or meat from birds still on medication.'], [Leaf, 'Fresh daily', 'Eggs are collected and graded every morning.']].map(([I, t, d]) => (
          <div key={t} className="flex gap-4 rounded-3xl bg-white p-6 shadow-soft dark:bg-navy-900">
            <I className="h-7 w-7 shrink-0 text-accent-600" />
            <div><p className="font-bold text-slate-900 dark:text-white">{t}</p><p className="mt-1 text-sm text-slate-500">{d}</p></div>
          </div>
        ))}
      </section>
    </div>
  );
}

function ShoppingBasketIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 11-1 9M19 11l-4-7M2 11h20M3.5 11l1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4M4.5 15.5h15M5 11l4-7M9 11l1 9" />
    </svg>
  );
}
