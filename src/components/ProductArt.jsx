// Flat illustrations for products (used when no photo is uploaded).
import { cx } from './ui';
import { usePhoto } from '../data/photos';

const BG = {
  crate: 'from-gold-100 to-gold-200', halfcrate: 'from-gold-100 to-gold-200', cracked: 'from-cream-100 to-cream-300',
  hen: 'from-accent-100 to-accent-200', broiler: 'from-brand-100 to-brand-200', turkey: 'from-accent-100 to-gold-200', guinea: 'from-cream-200 to-brand-100', duck: 'from-sky-100 to-brand-100',
  chick: 'from-gold-100 to-amber-200', meat: 'from-rose-100 to-accent-100', gizzard: 'from-rose-100 to-accent-100',
  sachet: 'from-brand-50 to-teal-100', vial: 'from-sky-50 to-sky-100', bag: 'from-cream-200 to-gold-100', manure: 'from-cream-200 to-amber-100', drinker: 'from-sky-50 to-brand-100', feeder: 'from-brand-50 to-cream-200',
};

const Egg = ({ x, y, s = 1, c = '#c98a55', crack }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="0" rx="8.5" ry="10.5" fill={c} />
    <ellipse cx="-2.6" cy="-4" rx="2.4" ry="3.2" fill="#fff" opacity=".35" />
    {crack && <path d="M-6 -1 l3 2 l2 -3 l3 3 l3 -2" stroke="#6b3d1f" strokeWidth="1.1" fill="none" />}
  </g>
);

function Tray({ rows, crack }) {
  const eggs = [];
  const cols = 4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) eggs.push([22 + c * 25 + (r % 2) * 0, (rows === 2 ? 50 : 38) + r * 22, (r + c) % 3]);
  const shades = ['#c98a55', '#d79b66', '#b9784a'];
  return (
    <>
      <path d={`M10 ${rows === 2 ? 72 : 80} h100 l-8 ${rows === 2 ? 18 : 22} h-84z`} fill="#b07f4f" />
      <rect x="10" y={rows === 2 ? 66 : 74} width="100" height="10" rx="3" fill="#c79464" />
      {eggs.map(([x, y, k], i) => (
        <Egg key={i} x={x} y={y} c={shades[k]} crack={crack && i % 3 === 0} />
      ))}
    </>
  );
}

const ART = {
  crate: () => <Tray rows={3} />,
  halfcrate: () => <Tray rows={2} />,
  cracked: () => <Tray rows={3} crack />,
  hen: () => (
    <>
      <ellipse cx="62" cy="72" rx="34" ry="26" fill="#9a4a24" />
      <path d="M92 60 q16 -14 10 10 q-4 8 -12 6z" fill="#7a3518" />
      <circle cx="38" cy="46" r="15" fill="#a8532a" />
      <path d="M30 31 q4 -8 8 0 q4 -8 8 0 q2 6 -8 6 q-10 0 -8 -6z" fill="#d1352b" />
      <path d="M23 47 l-8 3 l8 3z" fill="#e7a83b" />
      <circle cx="35" cy="44" r="2.2" fill="#1b1b1b" />
      <path d="M30 54 q3 8 6 0z" fill="#d1352b" />
      <path d="M50 78 q14 10 30 0" stroke="#7a3518" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M55 96 v10 M70 96 v10" stroke="#e7a83b" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  broiler: () => (
    <>
      <ellipse cx="62" cy="72" rx="36" ry="27" fill="#fbf8f2" stroke="#e7dcc6" strokeWidth="2" />
      <path d="M94 62 q14 -10 8 10 q-4 6 -10 5z" fill="#efe6d4" />
      <circle cx="37" cy="46" r="15" fill="#fffdf8" stroke="#e7dcc6" strokeWidth="2" />
      <path d="M29 31 q4 -8 8 0 q4 -8 8 0 q2 6 -8 6 q-10 0 -8 -6z" fill="#d1352b" />
      <path d="M22 47 l-8 3 l8 3z" fill="#e7a83b" />
      <circle cx="34" cy="44" r="2.2" fill="#1b1b1b" />
      <path d="M29 54 q3 8 6 0z" fill="#d1352b" />
      <path d="M50 78 q14 10 30 0" stroke="#e2d6be" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M55 97 v10 M70 97 v10" stroke="#e7a83b" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  turkey: () => (
    <>
      {[...Array(7)].map((_, i) => (
        <ellipse key={i} cx="62" cy="40" rx="9" ry="34" fill={i % 2 ? '#7a4a2a' : '#5b3720'} transform={`rotate(${-60 + i * 20} 62 70)`} />
      ))}
      <ellipse cx="62" cy="76" rx="26" ry="22" fill="#3f2a1d" />
      <circle cx="62" cy="50" r="10" fill="#c9a07a" />
      <path d="M62 56 q-4 12 2 16" stroke="#d1352b" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M53 50 l-7 2 l7 2z" fill="#e7a83b" />
      <circle cx="59" cy="47" r="1.8" fill="#111" />
      <path d="M55 96 v10 M69 96 v10" stroke="#c98a55" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  guinea: () => (
    <>
      <ellipse cx="64" cy="70" rx="34" ry="26" fill="#3d4148" />
      {[...Array(18)].map((_, i) => (
        <circle key={i} cx={40 + (i % 6) * 9 + (Math.floor(i / 6) % 2) * 4} cy={58 + Math.floor(i / 6) * 9} r="1.8" fill="#e8e3da" />
      ))}
      <path d="M36 62 q-6 -16 2 -22" stroke="#3d4148" strokeWidth="8" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="36" r="8" fill="#e9e3da" />
      <path d="M36 28 l3 -7 l3 7z" fill="#c8643b" />
      <path d="M31 37 l-6 2 l6 2z" fill="#c8a35a" />
      <path d="M38 44 q-3 6 2 6" fill="#d1352b" />
      <circle cx="36" cy="35" r="1.6" fill="#111" />
      <path d="M58 94 v10 M72 94 v10" stroke="#8a8f99" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  duck: () => (
    <>
      <ellipse cx="66" cy="74" rx="36" ry="22" fill="#2a2f2b" />
      <path d="M48 70 q22 -12 48 4 q-22 12 -48 -4z" fill="#f3efe6" />
      <circle cx="38" cy="48" r="14" fill="#f3efe6" />
      <path d="M33 44 q4 -6 10 0" fill="#c8443b" />
      <path d="M24 52 q-10 2 -12 -2 q4 -6 12 -4z" fill="#e9a23b" />
      <circle cx="36" cy="46" r="2" fill="#111" />
      <path d="M44 60 q4 8 10 10" stroke="#f3efe6" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M10 98 q55 10 100 0" stroke="#7cb4c9" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  ),
  chick: () => (
    <>
      <circle cx="44" cy="74" r="20" fill="#f6c845" />
      <circle cx="44" cy="52" r="13" fill="#f9d45c" />
      <path d="M32 52 l-8 3 l8 3z" fill="#e7883b" />
      <circle cx="41" cy="50" r="2" fill="#1b1b1b" />
      <circle cx="84" cy="80" r="16" fill="#f3bf3c" />
      <circle cx="84" cy="62" r="11" fill="#f6c845" />
      <path d="M94 62 l7 2.5 l-7 2.5z" fill="#e7883b" />
      <circle cx="87" cy="60" r="1.8" fill="#1b1b1b" />
      <path d="M38 94 v6 M50 94 v6 M80 96 v6 M90 96 v6" stroke="#e7883b" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  meat: () => (
    <>
      <ellipse cx="60" cy="96" rx="44" ry="8" fill="#e8dccb" />
      <path d="M38 40 q24 -18 46 6 q16 20 -6 38 q-14 10 -28 4 l-16 16 q-6 6 -11 0 q-5 -5 1 -11 l16 -16 q-6 -14 -2 -37z" fill="#d6864f" />
      <path d="M52 48 q12 -6 22 4" stroke="#f0b27e" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="98" r="7" fill="#fbf4ea" />
      <circle cx="18" cy="90" r="7" fill="#fbf4ea" />
    </>
  ),
  gizzard: () => (
    <>
      <ellipse cx="60" cy="88" rx="42" ry="14" fill="#fbf4ea" stroke="#e1d3bd" strokeWidth="2" />
      <ellipse cx="46" cy="76" rx="16" ry="11" fill="#a24a3c" />
      <ellipse cx="70" cy="74" rx="17" ry="12" fill="#b9574a" />
      <ellipse cx="58" cy="66" rx="14" ry="10" fill="#c46a5b" />
    </>
  ),
  sachet: () => (
    <>
      <path d="M32 22 h56 l4 8 v66 l-4 8 h-56 l-4 -8 v-66z" fill="#2f6146" />
      <rect x="28" y="22" width="64" height="8" fill="#264e39" />
      <rect x="40" y="44" width="40" height="34" rx="6" fill="#f6f1e7" />
      <path d="M60 50 v22 M49 61 h22" stroke="#c8643b" strokeWidth="6" strokeLinecap="round" />
      <rect x="40" y="86" width="40" height="5" rx="2" fill="#d9a441" />
    </>
  ),
  vial: () => (
    <>
      <rect x="44" y="18" width="32" height="12" rx="3" fill="#8a96a3" />
      <rect x="46" y="28" width="28" height="8" fill="#c8cfd6" />
      <path d="M40 36 h40 v58 q0 10 -10 10 h-20 q-10 0 -10 -10z" fill="#e9f3f8" stroke="#9fc3d6" strokeWidth="2" />
      <path d="M42 64 h36 v30 q0 8 -8 8 h-20 q-8 0 -8 -8z" fill="#f3b6a1" />
      <rect x="46" y="46" width="28" height="12" rx="2" fill="#2f6146" />
    </>
  ),
  bag: () => (
    <>
      <path d="M28 30 q32 -10 64 0 l6 68 q-38 10 -76 0z" fill="#e8d6b0" stroke="#c9b083" strokeWidth="2" />
      <path d="M30 30 q30 6 60 0" stroke="#c9b083" strokeWidth="3" fill="none" />
      <rect x="40" y="52" width="40" height="26" rx="5" fill="#2f6146" />
      <text x="60" y="70" textAnchor="middle" fontSize="13" fontWeight="800" fill="#f6f1e7" fontFamily="sans-serif">50kg</text>
      <path d="M44 90 h32" stroke="#d9a441" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  manure: () => (
    <>
      <path d="M30 34 q30 -10 60 0 l6 64 q-36 10 -72 0z" fill="#b59a72" stroke="#8f774f" strokeWidth="2" />
      <path d="M32 34 q28 6 56 0" stroke="#8f774f" strokeWidth="3" fill="none" />
      <path d="M48 70 q12 -16 24 0 q-12 10 -24 0z" fill="#4f7a3a" />
      <path d="M60 70 v14" stroke="#4f7a3a" strokeWidth="3" />
    </>
  ),
  drinker: () => (
    <>
      <path d="M60 14 v14" stroke="#7c8a96" strokeWidth="3" />
      <path d="M54 28 h12 l20 52 h-52z" fill="#d84f3a" />
      <ellipse cx="60" cy="84" rx="38" ry="10" fill="#2a6f97" />
      <ellipse cx="60" cy="82" rx="30" ry="6" fill="#7cc3e6" />
    </>
  ),
  feeder: () => (
    <>
      <path d="M60 10 v12" stroke="#7c8a96" strokeWidth="3" />
      <rect x="44" y="22" width="32" height="54" rx="6" fill="#d9a441" />
      <rect x="48" y="30" width="24" height="6" rx="2" fill="#f2d993" />
      <ellipse cx="60" cy="88" rx="38" ry="12" fill="#c8643b" />
      <ellipse cx="60" cy="85" rx="28" ry="6" fill="#e8c27a" />
    </>
  ),
};

export default function ProductArt({ art = 'crate', photo, className, rounded = 'rounded-2xl' }) {
  if (photo) return <img src={photo} alt="" className={cx('h-full w-full object-cover', rounded, className)} />;
  const Draw = ART[art] || ART.crate;
  return (
    <div className={cx('flex items-center justify-center bg-gradient-to-br', BG[art] || BG.crate, rounded, className)}>
      <svg viewBox="0 0 120 120" className="h-[78%] w-[78%] drop-shadow-sm">
        <Draw />
      </svg>
    </div>
  );
}

export const ART_OPTIONS = Object.keys(ART);

/** Product picture: uploaded photo if there is one, otherwise the illustration. */
export function ProductImage({ p, className, rounded }) {
  const photo = usePhoto(p.hasPhoto ? `product:${p.id}` : null);
  return <ProductArt art={p.art} photo={photo} className={className} rounded={rounded} />;
}
