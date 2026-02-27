import { useState, useEffect, useCallback } from 'react'
import { fetchVapidPublicKey, savePushSubscription, deletePushSubscription } from '../api/push'

/**
 * Convert a base64url VAPID public key string into a Uint8Array
 * suitable for PushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

/**
 * Hook for managing Web Push subscriptions.
 *
 * Only meaningful when:
 *  - The browser supports Push API and Notification API
 *  - `isAdmin` is true
 *
 * @param {{ authFetch: Function, isAdmin: boolean }} options
 * @returns {{ supported, permission, subscribed, subscribing, subscribe, unsubscribe }}
 */
export function usePushNotifications({ authFetch, isAdmin } = {}) {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const [permission, setPermission] = useState(() =>
    supported ? Notification.permission : 'denied'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  // Check existing subscription state on mount
  useEffect(() => {
    if (!supported || !isAdmin) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub)
      })
    }).catch(() => {})
  }, [supported, isAdmin])

  const subscribe = useCallback(async () => {
    if (!supported || !isAdmin || subscribing) return
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const vapidKey = await fetchVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      await savePushSubscription(authFetch, sub)
      setSubscribed(true)
    } catch (err) {
      setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
      console.error('[PushNotifications] subscribe error:', err)
    } finally {
      setSubscribing(false)
    }
  }, [supported, isAdmin, subscribing, authFetch])

  const unsubscribe = useCallback(async () => {
    if (!supported || !isAdmin) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        if (authFetch) await deletePushSubscription(authFetch, sub)
        await sub.unsubscribe()
        setSubscribed(false)
      }
    } catch (err) {
      console.error('[PushNotifications] unsubscribe error:', err)
    }
  }, [supported, isAdmin, authFetch])

  return { supported, permission, subscribed, subscribing, subscribe, unsubscribe }
}
