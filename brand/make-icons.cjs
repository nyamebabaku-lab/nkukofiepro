// Builds every app icon from brand/logo-source.png (the hen logo).
// node brand/make-icons.cjs   (needs sharp; run from the project root)
const sharp = require(process.env.SHARP || 'sharp');
const SRC = 'brand/logo-source.png';
const W = '#ffffff';
const disc = async (size) => {
  const crop = await sharp(SRC).flatten({ background: W }).extract({ left: 150, top: 150, width: 1700, height: 1700 }).resize(size).toBuffer();
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
  return sharp(crop).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
};
const pill = (label, cx, cy, w, h, fill) => `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/><text x="${cx}" y="${cy + h * 0.21}" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="700" font-size="${h * 0.56}" letter-spacing="${h * 0.08}" fill="#fff">${label}</text>`;
// square icon: white background, logo, optional label pill
const square = async (size, { scale = 0.86, label, color, bg = true, out }) => {
  const parts = [];
  if (label) {
    const d = Math.round(size * scale * 0.72);
    parts.push({ input: await disc(d), left: Math.round((size - d) / 2), top: Math.round(size * 0.5 - d * 0.62) });
    const svg = `<svg width="${size}" height="${size}">${pill(label, size / 2, size * 0.5 + d * 0.55, size * scale * 0.5, size * scale * 0.13, color)}</svg>`;
    parts.push({ input: Buffer.from(svg), left: 0, top: 0 });
  } else {
    const d = Math.round(size * scale);
    parts.push({ input: await disc(d), left: Math.round((size - d) / 2), top: Math.round((size - d) / 2) });
  }
  await sharp({ create: { width: size, height: size, channels: 4, background: bg ? W : { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(parts).png().toFile(out);
};
(async () => {
  await sharp(await disc(512)).toFile('public/logo.png');
  await sharp(await disc(64)).toFile('public/favicon.png');
  await square(192, { scale: 0.9, out: 'public/icon-192.png' });
  await square(512, { scale: 0.9, out: 'public/icon-512.png' });
  await square(512, { scale: 0.74, out: 'public/icon-maskable-512.png' });
  await square(180, { scale: 0.88, out: 'public/apple-touch-icon.png' });
  const apps = { assets: null, 'assets-farm': ['FARM', '#1f6b35'], 'assets-admin': ['ADMIN', '#1f3d2b'] };
  for (const [dir, tag] of Object.entries(apps)) {
    const o = tag ? { label: tag[0], color: tag[1] } : {};
    await square(1024, { ...o, scale: tag ? 0.9 : 0.84, out: `${dir}/icon-only.png` });
    await square(1024, { ...o, scale: tag ? 0.6 : 0.64, bg: false, out: `${dir}/icon-foreground.png` }); // adaptive safe zone
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: W } }).png().toFile(`${dir}/icon-background.png`);
  }
  console.log('icons done');
})();
