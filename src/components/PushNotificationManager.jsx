import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'

/**
 * Invisible component that silently re-syncs an existing push permission +
 * subscription for logged-in active users.
 *
 * Mounted once at the top level in App.jsx. If permission is already granted,
 * we re-register the existing endpoint in backend DB without showing a prompt.
 * This keeps the subscription fresh across service worker updates.
 */
function PushNotificationManager() {
  const { user, isAuthenticated, authFetch } = useAuth()
  const isActive = isAuthenticated && user?.account_status === 'active'

  const { supported, permission, subscribing, subscribe } = usePushNotifications({
    authFetch,
    isActive,
  })

  // Only attempt once per session
  const attempted = useRef(false)

  useEffect(() => {
    if (!supported || !isActive || attempted.current || subscribing) return
    if (permission !== 'granted') return

    // Always attempt subscribe() regardless of current subscribed state.
    // subscribe() is idempotent – pushManager.subscribe() returns the existing
    // subscription when the VAPID key matches, and savePushSubscription() does
    // an upsert on the backend.  This ensures the backend DB stays in sync even
    // after a DB reset, a new deployment, or a failed previous attempt.
    attempted.current = true
    subscribe({ requestPermission: false })
  }, [supported, isActive, permission, subscribing, subscribe])

  return null
}

export default PushNotificationManager
