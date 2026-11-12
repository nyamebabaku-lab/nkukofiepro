import { cx } from '../ui';
import { useBrand, splitName } from '../../lib/brand';
import { useDB } from '../../data/store';
import { LIVE } from '../../config';
import henLogo from '../../assets/logo.png';

/** The Nkukɔ Fie Pro hen logo (white disc), used wherever no custom platform logo is set. */
export function LogoMark({ className }) {
  return <img src={henLogo} alt="" className={cx('h-10 w-10 shrink-0 rounded-full bg-white object-contain', className)} />;
}

/** The platform logo image, or the built-in hen logo. */
export function BrandMark({ className, src }) {
  const logo = useBrand((s) => s.logo);
  const url = src === undefined ? logo : src;
  if (url) return <img src={url} alt="" className={cx('h-10 w-10 shrink-0 rounded-[12px] object-contain', className)} />;
  return <LogoMark className={className} />;
}

/**
 * App logo + name. `farm` shows the signed-in farm business's own logo and name instead
 * (customer shop, staff app, receipts) whenever that farm has one.
 */
export default function Logo({ compact, dark, className, farm }) {
  const brand = useBrand();
  // Two plain selectors (a new object per render would re-render forever).
  const demoName = useDB((s) => s.settings?.businessName);
  const demoLogo = useDB((s) => s.settings?.farmLogo);
  const f = farm ? (LIVE ? { name: brand.farmName, logo: brand.farmLogo } : { name: demoName, logo: demoLogo }) : null;
  const useFarm = !!(f?.name && (f.logo || !LIVE));
  const [first, last] = splitName(brand.name);
  return (
    <div className={cx('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark src={useFarm ? f.logo || null : undefined} />
      {!compact && (
        <div className="min-w-0 leading-none">
          {useFarm ? (
            <p className={cx('truncate font-display text-[20px] font-semibold tracking-tight', dark ? 'text-cream-100' : 'text-brand-900 dark:text-white')}>{f.name}</p>
          ) : (
            <p className={cx('truncate font-display text-[22px] font-semibold tracking-tight', dark ? 'text-cream-100' : 'text-brand-900 dark:text-white')}>
              {first}
              {last && <span className="text-gold-500"> {last}</span>}
            </p>
          )}
          <p className={cx('mt-1 truncate text-[10px] font-semibold uppercase tracking-[.2em]', dark ? 'text-brand-200/70' : 'text-slate-500')}>{useFarm ? `on ${brand.name}` : 'Farm management'}</p>
        </div>
      )}
    </div>
  );
}
