import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['static/render.png', 'static/pwa-192.png', 'static/pwa-512.png', 'static/apple-touch-180.png'],
      manifest: {
        name: 'Kenaz Centrum',
        short_name: 'Kenaz',
        description: 'Kenaz - kalendarz wydarzen i spolecznosc offline.',
        theme_color: '#0f172a',
        background_color: '#f8f6ef',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'pl',
        icons: [
          {
            src: '/static/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/static/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/static/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2}'],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
