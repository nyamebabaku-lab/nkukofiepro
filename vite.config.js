import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Four builds from one codebase (VITE_APP): main → dist/ (customers), farm → dist/farm/,
// admin → dist/admin/ (super admin), demo → dist/demo/.
const APP = process.env.VITE_APP || 'demo';
const NAME = 'Nkukɔ Fie Pro';
const META = {
  main: { name: NAME, short: 'Nkukɔ Fie', desc: 'Order fresh eggs, birds and chicks from your farm and pay with MoMo', out: 'dist' },
  farm: { name: `${NAME} Farm`, short: 'NF Farm', desc: 'Run your poultry farm: flocks, eggs, feed, staff, sales and payments', out: 'dist/farm' },
  admin: { name: `${NAME} Admin`, short: 'NF Admin', desc: 'Platform administration', out: 'dist/admin' },
  demo: { name: `${NAME} — Demo`, short: 'NF Demo', desc: 'Try Nkukɔ Fie Pro with a sample farm', out: 'dist/demo' },
}[APP];
// Paths of the other apps that live inside the main app's folder.
const OTHERS = ['admin', 'farm', 'demo', 'get', 'get-farm', 'get-admin'];

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_APP': JSON.stringify(APP) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'apple-touch-icon.png'],
      manifest: {
        id: `nkukofie-${APP}`,
        name: META.name,
        short_name: META.short,
        description: META.desc,
        theme_color: '#1f3d2b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Every page is cached on first visit so the app opens with no internet.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        // The main app's folder also holds the admin and demo apps; never cache or answer for them.
        // Never cache or answer for the other apps or the /get download pages.
        globIgnores: APP === 'main' ? OTHERS.map((d) => `${d}/**`) : ['get/**', 'get-farm/**', 'get-admin/**'],
        navigateFallbackDenylist: APP === 'main' ? OTHERS.map((d) => new RegExp(`/${d}/`)) : [/\/get(-farm|-admin)?\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // Never cache Supabase API calls.
        runtimeCaching: [{ urlPattern: /supabase\.co\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  build: {
    outDir: process.env.OUT_DIR || META.out,
    emptyOutDir: APP === 'main' || !!process.env.OUT_DIR,
    chunkSizeWarningLimit: 1500,
  },
});
