import { API_URL } from './config'

export async function fetchAdminEventStats(authFetch, month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  const response = await authFetch(`${API_URL}/admin/stats/events${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch event stats')
  }
  return response.json()
}

export async function fetchAdminUserStats(authFetch) {
  const response = await authFetch(`${API_URL}/admin/stats/users`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch user stats')
  }
  return response.json()
}

export async function fetchAdminPaymentStats(authFetch, month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  const response = await authFetch(`${API_URL}/admin/stats/payments${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch payment stats')
  }
  return response.json()
}

export async function fetchAdminRegistrationStats(authFetch, month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  const response = await authFetch(`${API_URL}/admin/stats/registrations${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch registration stats')
  }
  return response.json()
}

export async function fetchPendingUsers(authFetch) {
  const response = await authFetch(`${API_URL}/admin/users/pending`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch pending users')
  }
  return response.json()
}

export async function approveUser(authFetch, userId) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/approve`, {
    method: 'POST'
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to approve user')
  }
  return response.json()
}

export async function fetchPendingManualPayments(authFetch) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/pending`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch pending manual payments')
  }
  return response.json()
}

export async function approveManualPayment(authFetch, registrationId) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/${registrationId}/approve`, {
    method: 'POST',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to approve manual payment')
  }
  return data
}

export async function fetchManualRefundTasks(authFetch) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/refunds`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch manual refund tasks')
  }
  return response.json()
}

export async function updateManualRefundTask(authFetch, taskId, payload) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/refunds/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to update manual refund task')
  }
  return data
}

export async function fetchWaitlistPromotions(authFetch) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/promotions`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch waitlist promotions')
  }
  return response.json()
}

export async function updateWaitlistPromotion(authFetch, registrationId, payload) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/promotions/${registrationId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to update waitlist promotion')
  }
  return data
}

export async function fetchPendingSubscriptionPurchases(authFetch) {
  const response = await authFetch(`${API_URL}/admin/subscription-purchases/pending`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch pending subscription purchases')
  }
  return response.json()
}

export async function approveSubscriptionPurchase(authFetch, purchaseId) {
  const response = await authFetch(`${API_URL}/admin/subscription-purchases/${purchaseId}/approve`, {
    method: 'POST',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to approve subscription purchase')
  }
  return data
}
