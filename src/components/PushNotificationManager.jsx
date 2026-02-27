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

    // If permission was already granted, silently re-register without a prompt.
    // If permission is 'default' (not yet asked), immediately request it –
    // this ensures all active members receive important notifications.
    if (permission === 'denied') return
    if (subscribed) return  // already subscribed this session

    attempted.current = true
    subscribe()
  }, [supported, isActive, permission, subscribed, subscribing, subscribe])

  return null
}

export default PushNotificationManager
