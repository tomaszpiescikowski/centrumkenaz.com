import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __COMMIT_SHA__: JSON.stringify(process.env.VITE_COMMIT_SHA || ''),
    __COMMIT_SUBJECT__: JSON.stringify(process.env.VITE_COMMIT_SUBJECT || ''),
    __COMMIT_BODY__: JSON.stringify(process.env.VITE_COMMIT_BODY || ''),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'static/pwa-192.png',
        'static/pwa-512.png',
        'static/apple-touch-180.png',
        'static/render.png',
      ],
      manifest: {
        id: '/',
        name: 'Kenaz Centrum',
        short_name: 'Kenaz',
        description: 'Kenaz - kalendarz wydarzen i spolecznosc offline.',
        theme_color: '#0f172a',
        background_color: '#f8f6ef',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'pl',
        dir: 'ltr',
        categories: ['lifestyle', 'social'],
        prefer_related_applications: false,
        icons: [
          {
            src: 'static/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'static/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'static/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/admin\//, /^\/api/, /^\/auth\//, /^\/cities\//, /^\/docs/, /^\/events\//, /^\/health/, /^\/payments\//, /^\/products\//, /^\/registrations\//, /^\/uploads\//, /^\/users\//, /^\/openapi\.json/],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
