import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/index.css'
import { registerSW } from 'virtual:pwa-register'

// ---------------------------------------------------------------------------
// PWA force-update: ensures iOS PWA reloads when a new build is deployed.
//
// 1. registerSW with onRegisteredSW → sets up periodic update checks every 60 s
// 2. visibilitychange → checks for SW update every time the app comes back to
//    foreground (critical on iOS where the app can sit in memory for days)
// 3. controllerchange → forces page reload when a new SW takes over
// ---------------------------------------------------------------------------

const intervalMS = 60 * 1000 // check every 60 seconds

// Extra safety net: explicitly register /sw.js early.
// PWABuilder and some headless checks can miss deferred registrations.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
    console.error('[PWA] direct SW register failed:', err)
  })
}

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return

    // Periodic update check
    setInterval(async () => {
      if (registration.installing || !navigator) return
      // Bypass HTTP cache for the SW script to catch new builds
      if ('connection' in navigator && !navigator.onLine) return
      try {
        const resp = await fetch(swUrl, {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        })
        if (resp?.status === 200) await registration.update()
      } catch { /* offline or network error – ignore */ }
    }, intervalMS)

    // Check for update every time the app becomes visible (iOS resume)
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return
      if (registration.installing || !navigator) return
      if ('connection' in navigator && !navigator.onLine) return
      try {
        await registration.update()
      } catch { /* ignore */ }
    })
  },
  onNeedRefresh() {
    // New content available — force-update immediately without user prompt
    updateSW(true)
  },
})

// Fallback: if the browser swaps the controlling SW, hard-reload the page.
// This covers edge cases where the SW activates outside our callbacks.
if ('serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
