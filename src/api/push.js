import { API_URL } from './config'

async function getErrorMessage(response, fallback) {
  try {
    const ct = response.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const data = await response.json()
      const detail = data?.message || data?.detail || data?.error
      if (typeof detail === 'string' && detail.trim()) return detail
    } else {
      const text = await response.text()
      if (text && text.trim()) return text.trim()
    }
  } catch {
    // ignore parse errors and use fallback below
  }
  return `${fallback} (HTTP ${response.status})`
}

/**
 * Fetch the VAPID public key from the backend.
 * @returns {Promise<string>} base64url-encoded VAPID public key
 */
export async function fetchVapidPublicKey() {
  const res = await fetch(`${API_URL}/push/vapid-public-key`)
  if (!res.ok) throw new Error(await getErrorMessage(res, 'Push notifications not available'))
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
  if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to save push subscription'))
}

/**
 * Send a test push notification to the currently logged-in admin's
 * own subscriptions. Useful for verifying the whole push pipeline.
 * Returns diagnostic info from the backend.
 * @param {Function} authFetch
 * @returns {Promise<{status: string, message: string, sent: number}>}
 */
export async function sendTestPush(authFetch) {
  const res = await authFetch(`${API_URL}/push/test`, { method: 'POST' })
  if (!res.ok) throw new Error(await getErrorMessage(res, 'Test push failed'))
  return res.json()
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
  if (!res.ok) throw new Error(await getErrorMessage(res, 'Failed to delete push subscription'))
}
