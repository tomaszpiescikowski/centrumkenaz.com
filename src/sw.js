/**
 * Custom Service Worker for Kenaz PWA.
 *
 * Handles:
 *  1. Workbox precaching (manifest injected by vite-plugin-pwa at build)
 *  2. Runtime caching for images and Google Fonts
 *  3. SPA navigation fallback
 *  4. Web Push notifications (admin join-request alerts etc.)
 *  5. Notification click → open/focus the target URL
 */

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// ── Precaching ────────────────────────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── SPA navigation fallback (serve index.html for unknown paths) ──────────────
// auth/google/callback must go directly to nginx (which proxies to FastAPI) so
// the OAuth authorization code is exchanged only once. If the SW serves
// index.html here instead, the SPA's GoogleCallbackRedirect also hits the
// backend — the same one-time code gets sent to Google twice → invalid_grant.
const BACKEND_PATHS = /^\/(api\/|uploads\/|health|docs|redoc|openapi|auth\/google\/callback)/


registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [BACKEND_PATHS],
  })
)

// ── Runtime caching: images ───────────────────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
)

// ── Runtime caching: Google Fonts ────────────────────────────────────────────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  })
)

// ── SW lifecycle: skip waiting & claim clients immediately ────────────────────
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())

// ── Web Push: show notification ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Kenaz', body: event.data.text() }
  }

  const options = {
    body: data.body || '',
    icon: '/static/pwa-192.png',
    badge: '/static/pwa-192.png',
    data: { url: data.url || '/admin' },
    tag: data.tag || 'kenaz-notification',
    renotify: true,
    requireInteraction: true,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Kenaz', options)
  )
})

// ── Notification click: open / focus the target URL ──────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/admin'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window with the target URL is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
