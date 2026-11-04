// The farm's hen & chick picture, washed into the brand green so text sits cleanly on top.
import { cx } from './ui';

export const HERO_IMG = `${import.meta.env.BASE_URL}hero/hen-chick.jpg`;

/**
 * fade: 'side' — photo fills the right part on wide screens and the top on phones (text beside / below it);
 *       'up'   — photo fills the panel, text sits at the bottom.
 */
export default function HeroPhoto({ className, focus = '50% 40%', fade = 'side' }) {
  const side = fade === 'side';
  return (
    <div className={cx('pointer-events-none absolute inset-0', className)} aria-hidden>
      <div className={cx('absolute inset-0', side && 'md:left-auto md:w-[56%]')}>
        <img src={HERO_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: focus }} />
        {/* Green colour wash over the photo. */}
        <div className="absolute inset-0 bg-brand-700 opacity-35 mix-blend-color" />
        <div className="absolute inset-0 bg-brand-900/20" />
        {side && <div className="absolute inset-y-0 left-0 hidden w-2/3 bg-gradient-to-r from-brand-900 via-brand-900/60 to-transparent md:block" />}
      </div>
      <div className={cx('absolute inset-0', side ? 'bg-gradient-to-t from-brand-900 via-brand-900/75 to-brand-900/5 md:hidden' : 'bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/10')} />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-brand-900/60 to-transparent" />
    </div>
  );
}
