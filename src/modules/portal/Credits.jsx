import { CREDITS, photo } from '../../data/media';

const LICENSE = { by: 'CC BY', 'by-sa': 'CC BY-SA', cc0: 'CC0', pdm: 'Public domain' };

export default function Credits() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold text-brand-900 dark:text-white">Photo credits</h1>
      <p className="mt-2 max-w-2xl text-slate-500">Photos in PoultryPro are openly licensed and used with thanks to their photographers. Payment logos belong to MTN, Telecel, AT, Visa and Mastercard and are shown only to identify payment options.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CREDITS.map((c) => (
          <a key={c.key} href={c.landing} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-2xl bg-white p-3 shadow-soft transition hover:shadow-lift dark:bg-navy-900">
            <img src={photo(c.key)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            <span className="min-w-0 text-xs">
              <span className="block truncate font-semibold text-slate-800 dark:text-white">{c.title || 'Untitled'}</span>
              <span className="block truncate text-slate-500">by {c.creator || 'unknown'}</span>
              <span className="block text-slate-400">{LICENSE[c.license] || c.license.toUpperCase()} {c.lv} · {c.src}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
