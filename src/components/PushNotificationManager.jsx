import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'

/**
 * Invisible component that automatically requests and registers a push
 * subscription for all logged-in active users (admins and members alike).
 *
 * Mounted once at the top level in App.jsx.  The subscription is requested
 * silently on mount: if permission has already been granted the browser
 * doesn't show a prompt and we just re-register the current endpoint.
 * This keeps the subscription fresh across service worker updates.
 */
function PushNotificationManager() {
  const { user, isAuthenticated, authFetch } = useAuth()
  const isActive = isAuthenticated && user?.account_status === 'active'

  const { supported, permission, subscribed, subscribing, subscribe } = usePushNotifications({
    authFetch,
    isActive,
  })

  // Only attempt once per session
  const attempted = useRef(false)

  useEffect(() => {
    if (!supported || !isActive || attempted.current || subscribing) return
    if (permission === 'denied') return

    // Always attempt subscribe() regardless of current subscribed state.
    // subscribe() is idempotent – pushManager.subscribe() returns the existing
    // subscription when the VAPID key matches, and savePushSubscription() does
    // an upsert on the backend.  This ensures the backend DB stays in sync even
    // after a DB reset, a new deployment, or a failed previous attempt.
    attempted.current = true
    subscribe()
  }, [supported, isActive, permission, subscribing, subscribe])

  return null
}

export default PushNotificationManager
