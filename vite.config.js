import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Three apps from one codebase (VITE_APP): main → dist/, admin → dist/admin/, demo → dist/demo/.
const APP = process.env.VITE_APP || 'demo';
const META = {
  main: { name: 'PoultryPro', short: 'PoultryPro', desc: 'Order from your farm, or record your daily farm work', out: 'dist' },
  admin: { name: 'PoultryPro Admin', short: 'PP Admin', desc: 'Run your farm business and approve your team', out: 'dist/admin' },
  demo: { name: 'PoultryPro — Demo', short: 'PP Demo', desc: 'Try PoultryPro with a demo farm', out: 'dist/demo' },
}[APP];

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_APP': JSON.stringify(APP) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: `poultrypro-${APP}`,
        name: META.name,
        short_name: META.short,
        description: META.desc,
        theme_color: '#1f3d2b',
        background_color: '#f6f1e7',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Every page is cached on first visit so the app opens with no internet.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        // The main app's folder also holds the admin and demo apps; never cache or answer for them.
        globIgnores: APP === 'main' ? ['admin/**', 'demo/**'] : [],
        navigateFallbackDenylist: APP === 'main' ? [/\/admin\//, /\/demo\//] : [],
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
