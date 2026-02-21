import { API_URL, safeJson } from './config'

export async function fetchAnnouncements() {
  const response = await fetch(`${API_URL}/api/announcements/`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch announcements')
  }
  return safeJson(response)
}

export async function createAnnouncement(authFetch, payload) {
  const response = await authFetch(`${API_URL}/api/announcements/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to create announcement')
  }
  return data
}

export async function deleteAnnouncement(authFetch, announcementId) {
  const response = await authFetch(`${API_URL}/api/announcements/${announcementId}`, {
    method: 'DELETE',
  })
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to delete announcement')
  }
}
