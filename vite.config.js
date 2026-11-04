import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'PoultryPro — Farm Management',
        short_name: 'PoultryPro',
        description: 'Run your poultry farms: flocks, eggs, feed, vaccinations, staff, sales and payments',
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // Photos are cached the first time they are seen, so they also work offline afterwards.
        runtimeCaching: [{ urlPattern: /\/photos\/.*\.jpg$/, handler: 'CacheFirst', options: { cacheName: 'photos', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 180 } } }],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
