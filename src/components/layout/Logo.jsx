import { cx } from '../ui';

export function LogoMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={cx('h-10 w-10 shrink-0', className)} aria-hidden>
      <rect width="48" height="48" rx="14" fill="#d9a441" />
      <path d="M24 8c-6.6 0-11.4 8.6-11.4 16.2C12.6 32 17.6 38 24 38s11.4-6 11.4-13.8C35.4 16.6 30.6 8 24 8z" fill="#fbf8f2" />
      <circle cx="24" cy="26" r="5.4" fill="#c8643b" />
      <path d="M16.5 40.5c2.2 1.3 4.7 2 7.5 2s5.3-.7 7.5-2" stroke="#1f3d2b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function Logo({ compact, dark, className }) {
  return (
    <div className={cx('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <p className={cx('font-display text-[22px] font-semibold tracking-tight', dark ? 'text-cream-100' : 'text-brand-900 dark:text-white')}>
            Poultry<span className="text-gold-500">Pro</span>
          </p>
          <p className={cx('mt-1 text-[10px] font-semibold uppercase tracking-[.2em]', dark ? 'text-brand-200/70' : 'text-slate-500')}>Farm management</p>
        </div>
      )}
    </div>
  );
}
