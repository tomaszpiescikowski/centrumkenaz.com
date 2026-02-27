import { API_URL } from './config'

/**
 * Fetch the VAPID public key from the backend.
 * @returns {Promise<string>} base64url-encoded VAPID public key
 */
export async function fetchVapidPublicKey() {
  const res = await fetch(`${API_URL}/push/vapid-public-key`)
  if (!res.ok) throw new Error('Push notifications not available')
  const data = await res.json()
  return data.public_key
}

/**
 * Save a push subscription to the backend (admin only).
 * @param {Function} authFetch
 * @param {PushSubscription} subscription  – native browser PushSubscription
 */
export async function savePushSubscription(authFetch, subscription) {
  const json = subscription.toJSON()
  const res = await authFetch(`${API_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  })
  if (!res.ok) throw new Error('Failed to save push subscription')
}

/**
 * Remove a push subscription from the backend (admin only).
 * @param {Function} authFetch
 * @param {PushSubscription} subscription
 */
export async function deletePushSubscription(authFetch, subscription) {
  const json = subscription.toJSON()
  const res = await authFetch(`${API_URL}/push/subscribe`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  })
  if (!res.ok) throw new Error('Failed to delete push subscription')
}
