import { API_URL, safeJson } from './config'

// ─── Public ──────────────────────────────────────────────────────

/**
 * Return the list of all custom event types stored in the database.
 * No authentication required.
 */
export async function fetchEventTypes() {
  const response = await fetch(`${API_URL}/event-types`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch event types')
  }
  return safeJson(response)
}

// ─── Admin ───────────────────────────────────────────────────────

/**
 * Create a new custom event type.
 * @param {Function} authFetch  - authenticated fetch from AuthContext
 * @param {{ label: string, icon_key: string, color: string }} payload
 */
export async function createEventType(authFetch, payload) {
  const response = await authFetch(`${API_URL}/event-types/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Failed to create event type')
  return data
}

/**
 * Delete a custom event type by key.
 * All events that had this type are automatically reassigned to "inne".
 * @param {Function} authFetch  - authenticated fetch from AuthContext
 * @param {string}   key        - the event type key to delete
 */
export async function deleteEventType(authFetch, key) {
  const response = await authFetch(`${API_URL}/event-types/admin/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Failed to delete event type')
  return data
}
