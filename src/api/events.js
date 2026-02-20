import { API_URL } from './config'
import { toLocalDateKey } from '../utils/date'

function requestWithAuth(authFetch, url, options = {}) {
  if (authFetch) return authFetch(url, options)
  return fetch(url, options)
}

function extractApiErrorMessage(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => extractApiErrorMessage(item))
      .filter(Boolean)
    return messages.length ? messages.join(' ') : null
  }
  if (typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg
    if (typeof detail.message === 'string') return detail.message
    if (detail.detail) return extractApiErrorMessage(detail.detail)
  }
  return null
}

function normalizeEvent(apiEvent) {
  const startDay = apiEvent.start_date ? toLocalDateKey(apiEvent.start_date) : null
  const endDay = apiEvent.end_date ? toLocalDateKey(apiEvent.end_date) : null

  return {
    id: apiEvent.id,
    title: apiEvent.title,
    description: apiEvent.description || '',
    type: apiEvent.event_type,
    date: startDay,
    startDateTime: apiEvent.start_date || null,
    endDate: endDay,
    endDateTime: apiEvent.end_date || null,
    time: apiEvent.time_info || '',
    city: apiEvent.city,
    location: apiEvent.location || null,
    showMap: apiEvent.show_map ?? true,
    priceGuest: Number(apiEvent.price_guest ?? 0),
    priceMember: Number(apiEvent.price_member ?? 0),
    manualPaymentVerification: Boolean(apiEvent.manual_payment_verification),
    manualPaymentUrl: apiEvent.manual_payment_url || null,
    manualPaymentDueHours: Number(apiEvent.manual_payment_due_hours ?? 24),
    maxParticipants: apiEvent.max_participants ?? null,
    requiresSubscription: Boolean(apiEvent.requires_subscription),
    cancelCutoffHours: Number(apiEvent.cancel_cutoff_hours ?? 24),
    pointsValue: Number(apiEvent.points_value ?? 0),
  }
}

export async function fetchEventsForRange({ startFrom, startTo, limit = 200, city = null, authFetch = null }) {
  const params = new URLSearchParams()
  if (startFrom) params.set('start_from', startFrom)
  if (startTo) params.set('start_to', startTo)
  if (city) params.set('city', city)
  params.set('limit', String(Math.min(limit, 100)))

  const response = await requestWithAuth(authFetch, `${API_URL}/events/?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch events')
  }
  const data = await response.json()
  const normalized = data.map(normalizeEvent)
  return normalized
}

export async function fetchEventsForMonth({ year, month, limit = 500, city = null, authFetch = null }) {
  const mm = String(month).padStart(2, '0')
  const monthParam = `${year}-${mm}`
  const params = new URLSearchParams()
  params.set('month', monthParam)
  if (city) params.set('city', city)
  params.set('limit', String(Math.min(limit, 100)))

  const response = await requestWithAuth(authFetch, `${API_URL}/events/?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch events')
  }
  const data = await response.json()
  const normalized = data.map(normalizeEvent)
  return normalized
}

export async function fetchEventById(id, authFetch = null) {
  const response = await requestWithAuth(authFetch, `${API_URL}/events/${id}`)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch event')
  }
  const data = await response.json()
  return normalizeEvent(data)
}

export async function fetchRegisteredEventIds(authFetch) {
  const response = await authFetch(`${API_URL}/events/registered`)
  if (!response.ok) {
    throw new Error('Failed to fetch registered events')
  }
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchEventAvailability(eventId, authFetch = null) {
  const response = await requestWithAuth(authFetch, `${API_URL}/events/${eventId}/availability`)
  if (!response.ok) {
    throw new Error('Failed to fetch event availability')
  }
  return response.json()
}

export async function createEvent(authFetch, payload) {
  const response = await authFetch(`${API_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(extractApiErrorMessage(data.detail) || 'Failed to create event')
  }

  const data = await response.json()
  return normalizeEvent(data)
}

export async function updateEvent(authFetch, eventId, payload) {
  const response = await authFetch(`${API_URL}/events/${eventId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(extractApiErrorMessage(data.detail) || 'Failed to update event')
  }

  const data = await response.json()
  return normalizeEvent(data)
}

export async function deleteEvent(authFetch, eventId) {
  const response = await authFetch(`${API_URL}/events/${eventId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(extractApiErrorMessage(data.detail) || 'Failed to delete event')
  }

  return response.json()
}
