// Renders the Android splash screens (assets*/splash.png + splash-dark.png) with the hen logo.
// Run from the project root with LD_LIBRARY_PATH set for Chromium; PW = path to playwright-core.
import { writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PW || 'playwright-core');
const ROOT = process.cwd() + '/';
const F = ROOT + 'node_modules/@fontsource/';
const face = (fam, file, w, range) => `@font-face{font-family:${fam};font-weight:${w};src:url(file://${F}${file});unicode-range:${range}}`;
const fonts = [
  face('Fraunces', 'fraunces/files/fraunces-latin-600-normal.woff2', 600, 'U+0000-00FF'),
  face('Fraunces', 'fraunces/files/fraunces-latin-ext-600-normal.woff2', 600, 'U+0100-02BA'),
  face('Jakarta', 'plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2', 600, 'U+0000-00FF'),
].join('\n');
const page = (sub) => `<!doctype html><meta charset="utf-8"><style>${fonts}
html,body{margin:0;width:2732px;height:2732px;background:#1f3d2b;overflow:hidden}
.photo{position:absolute;left:50%;top:0;transform:translateX(-50%);height:2732px;width:1560px;background:url(file://${ROOT}public/hero/hen-chick-green.jpg) center/cover}
.photo:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(31,61,43,.15) 0%,rgba(31,61,43,.25) 45%,rgba(31,61,43,.92) 78%,#1f3d2b 100%),linear-gradient(90deg,#1f3d2b 0%,rgba(31,61,43,0) 12%,rgba(31,61,43,0) 88%,#1f3d2b 100%)}
.brand{position:absolute;left:0;right:0;top:1640px;text-align:center}
.brand img{width:400px;height:400px;border-radius:50%;box-shadow:0 30px 80px rgba(0,0,0,.45)}
h1{margin:70px 0 0;font:600 156px/1 Fraunces;color:#fbf8f2;letter-spacing:-2px}h1 i{font-style:normal;color:#d9a441}
p{margin:44px 0 0;font:600 50px/1 Jakarta;letter-spacing:14px;color:#cfe0d4;text-transform:uppercase}
</style><div class="photo"></div><div class="brand"><img src="file://${ROOT}public/logo.png"><h1>Nkukɔ Fie <i>Pro</i></h1><p>${sub}</p></div>`;
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 2732, height: 2732 } });
for (const [dir, sub] of [['assets', 'Fresh from the farm'], ['assets-farm', 'Farm'], ['assets-admin', 'Admin']]) {
  writeFileSync(ROOT + 'brand/.splash.html', page(sub));
  await p.goto('file://' + ROOT + 'brand/.splash.html'); await p.waitForTimeout(800);
  for (const n of ['splash', 'splash-dark']) await p.screenshot({ path: `${ROOT}${dir}/${n}.png` });
  console.log('splash', dir);
}
await b.close();
