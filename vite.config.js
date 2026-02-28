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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: [
        'static/pwa-192.png',
        'static/pwa-512.png',
        'static/pwa-512-maskable.png',
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
        screenshots: [
          {
            src: 'static/motyw.jpg',
            sizes: '1080x1350',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Kenaz – ekran główny',
          },
          {
            src: 'static/motyw_kalendarz.jpg',
            sizes: '1080x1350',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Kenaz – kalendarz wydarzeń',
          },
          {
            src: 'static/motyw_cennik.jpg',
            sizes: '1080x1350',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Kenaz – cennik subskrypcji',
          },
          {
            src: 'static/motyw_dark_mode.jpg',
            sizes: '1080x1350',
            type: 'image/jpeg',
            form_factor: 'narrow',
            label: 'Kenaz – tryb ciemny',
          },
        ],
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
            src: 'static/pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
      devOptions: {
        // Enable service worker in Vite dev mode so push notification
        // subscriptions can be created and tested without a full build.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
