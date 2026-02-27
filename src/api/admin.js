import { API_URL, safeJson } from './config'

export async function fetchAdminEventStats(authFetch, month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  const response = await authFetch(`${API_URL}/admin/stats/events${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch event stats')
  }
  return safeJson(response)
}

export async function fetchAdminUserStats(authFetch) {
  const response = await authFetch(`${API_URL}/admin/stats/users`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch user stats')
  }
  return safeJson(response)
}

export async function fetchAdminPaymentStats(authFetch, month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  const response = await authFetch(`${API_URL}/admin/stats/payments${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch payment stats')
  }
  return safeJson(response)
}

export async function fetchAdminRegistrationStats(authFetch, month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  const response = await authFetch(`${API_URL}/admin/stats/registrations${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch registration stats')
  }
  return safeJson(response)
}

export async function fetchPendingUsers(authFetch) {
  const response = await authFetch(`${API_URL}/admin/users/pending`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch pending users')
  }
  return safeJson(response)
}

export async function approveUser(authFetch, userId) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/approve`, {
    method: 'POST'
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to approve user')
  }
  return safeJson(response)
}

export async function fetchPendingManualPayments(authFetch) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/pending`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch pending manual payments')
  }
  return safeJson(response)
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
  return safeJson(response)
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
  return safeJson(response)
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
  return safeJson(response)
}

export async function fetchManualPaymentsHistory(authFetch) {
  const response = await authFetch(`${API_URL}/admin/manual-payments/history`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch manual payments history')
  }
  return safeJson(response)
}

export async function fetchSubscriptionPurchasesHistory(authFetch) {
  const response = await authFetch(`${API_URL}/admin/subscription-purchases/history`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch subscription purchases history')
  }
  return safeJson(response)
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

export async function fetchAdminBalance(authFetch, period) {
  const query = period ? `?period=${encodeURIComponent(period)}` : ''
  const response = await authFetch(`${API_URL}/admin/stats/balance${query}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch balance')
  }
  return safeJson(response)
}

export async function promoteUserToAdmin(authFetch, email) {
  const response = await authFetch(`${API_URL}/admin/promote-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to promote user')
  }
  return data
}

export async function fetchAllUsers(authFetch) {
  const response = await authFetch(`${API_URL}/admin/users/all`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch users')
  }
  return safeJson(response)
}

export async function blockUser(authFetch, userId) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/block`, { method: 'POST' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to block user')
  }
  return safeJson(response)
}

export async function unblockUser(authFetch, userId) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/unblock`, { method: 'POST' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to unblock user')
  }
  return safeJson(response)
}

export async function downloadUserLogs(authFetch, userId, dateFrom, dateTo) {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  const response = await authFetch(`${API_URL}/admin/users/${userId}/logs/download?${params}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to download logs')
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : `logs_${userId}_${dateFrom}_${dateTo}.txt`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function fetchAdminUserDetail(authFetch, userId) {
  const response = await authFetch(`${API_URL}/admin/users/${userId}/detail`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch admin user detail')
  }
  return safeJson(response)
}
