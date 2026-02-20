import { API_URL } from './config'

export async function fetchMyRegistrations(authFetch) {
  const response = await authFetch(`${API_URL}/users/me/registrations`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch registrations')
  }
  return response.json()
}

export async function fetchMyProfile(authFetch) {
  const response = await authFetch(`${API_URL}/users/me/profile`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch profile')
  }
  return response.json()
}

export async function updateMyProfile(authFetch, payload) {
  const response = await authFetch(`${API_URL}/users/me/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to update profile')
  }
  return data
}

export async function submitJoinRequest(authFetch, payload) {
  const response = await authFetch(`${API_URL}/users/me/join-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to submit join request')
  }
  return data
}

export async function fetchUserProfileById(authFetch, userId) {
  const response = await authFetch(`${API_URL}/users/${userId}/profile`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 404) return null
    throw new Error(data.detail || 'Failed to fetch user profile')
  }
  return response.json()
}

export async function cancelRegistration(authFetch, registrationId) {
  const response = await authFetch(`${API_URL}/registrations/${registrationId}/cancel`, {
    method: 'POST',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.success === false) {
    const message = data.error || data.detail || 'Cancellation failed'
    throw new Error(message)
  }
  return data
}

export async function fetchManualPaymentDetails(authFetch, registrationId) {
  const response = await authFetch(`${API_URL}/registrations/${registrationId}/manual-payment`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to fetch manual payment details')
  }
  return data
}

export async function confirmManualPayment(authFetch, registrationId) {
  const response = await authFetch(`${API_URL}/registrations/${registrationId}/manual-payment/confirm`, {
    method: 'POST',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to confirm manual payment')
  }
  return data
}

export async function fetchSubscriptionPlans(authFetch) {
  const response = await authFetch(`${API_URL}/payments/subscription/plans`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch subscription plans')
  }
  return response.json()
}

export async function switchToFreePlan(authFetch) {
  const response = await authFetch(`${API_URL}/payments/subscription/free`, {
    method: 'POST',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to switch plan')
  }
  return data
}

export async function initiateSubscriptionPurchase(authFetch, payload) {
  const response = await authFetch(`${API_URL}/payments/subscription/manual-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to initiate subscription purchase')
  }
  return data
}

export async function fetchPendingSubscriptionPurchase(authFetch) {
  const response = await authFetch(`${API_URL}/payments/subscription/purchases/pending`)
  if (!response.ok) {
    if (response.status === 404) return null
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to fetch pending purchase')
  }
  return response.json()
}

export async function fetchSubscriptionPurchaseDetails(authFetch, purchaseId) {
  const response = await authFetch(`${API_URL}/payments/subscription/purchases/${purchaseId}/manual-payment`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to fetch purchase details')
  }
  return data
}

export async function confirmSubscriptionManualPayment(authFetch, purchaseId) {
  const response = await authFetch(`${API_URL}/payments/subscription/purchases/${purchaseId}/manual-payment/confirm`, {
    method: 'POST',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to confirm subscription payment')
  }
  return data
}
