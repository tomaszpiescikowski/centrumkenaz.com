import { API_URL, safeJson } from './config'

// ─── Public endpoints ─────────────────────────────────────────────

export async function fetchDonationSettings() {
  const response = await fetch(`${API_URL}/donations/settings`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch donation settings')
  }
  return safeJson(response)
}

export async function createDonation(data) {
  const response = await fetch(`${API_URL}/donations/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json.detail || 'Failed to submit donation')
  }
  return json
}

export async function fetchMyDonations(authFetch) {
  const response = await authFetch(`${API_URL}/donations/my`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch donations')
  }
  return safeJson(response)
}

// ─── Admin endpoints ──────────────────────────────────────────────

export async function fetchAdminDonationSettings(authFetch) {
  const response = await authFetch(`${API_URL}/donations/admin/settings`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch admin donation settings')
  }
  return safeJson(response)
}

export async function updateAdminDonationSettings(authFetch, payload) {
  const response = await authFetch(`${API_URL}/donations/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to update donation settings')
  }
  return data
}

export async function fetchAdminDonations(authFetch, status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const response = await authFetch(`${API_URL}/donations/admin/list${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch donations')
  }
  return safeJson(response)
}

export async function confirmDonation(authFetch, donationId, note) {
  const response = await authFetch(`${API_URL}/donations/admin/${donationId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || null }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to confirm donation')
  }
  return data
}

export async function cancelDonation(authFetch, donationId, note) {
  const response = await authFetch(`${API_URL}/donations/admin/${donationId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || null }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to cancel donation')
  }
  return data
}

export async function fetchAdminDonationStats(authFetch) {
  const response = await authFetch(`${API_URL}/donations/admin/stats`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch donation stats')
  }
  return safeJson(response)
}
