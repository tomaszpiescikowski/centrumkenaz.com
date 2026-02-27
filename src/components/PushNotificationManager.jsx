import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'

/**
 * Invisible component that automatically requests and registers a push
 * subscription for logged-in admin users.
 *
 * Mounted once at the top level in App.jsx.  The subscription is requested
 * silently on mount: if permission has already been granted the browser
 * doesn't show a prompt and we just re-register the current endpoint.
 * This keeps the subscription fresh across service worker updates.
 */
function PushNotificationManager() {
  const { user, isAuthenticated, authFetch } = useAuth()
  const isAdmin = isAuthenticated && user?.role === 'admin' && user?.account_status === 'active'

  const { supported, permission, subscribed, subscribing, subscribe } = usePushNotifications({
    authFetch,
    isAdmin,
  })

  // Only attempt once per admin session
  const attempted = useRef(false)

  useEffect(() => {
    if (!supported || !isAdmin || attempted.current || subscribing) return

    // If permission was already granted, silently re-register without a prompt.
    // If permission is 'default' (not yet asked), immediately request it –
    // this is intentional: admins should get notified automatically.
    if (permission === 'denied') return
    if (subscribed) return  // already subscribed this session

    attempted.current = true
    subscribe()
  }, [supported, isAdmin, permission, subscribed, subscribing, subscribe])

  return null
}

export default PushNotificationManager
