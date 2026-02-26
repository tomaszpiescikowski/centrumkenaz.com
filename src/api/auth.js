import { API_URL, safeJson } from './config'

/**
 * Request a password-reset email.
 * The server always returns the same generic message for security.
 *
 * @param {string} email
 * @returns {Promise<{message: string}>}
 */
export async function requestPasswordReset(email) {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await safeJson(response)
  if (!response.ok) {
    throw new Error(data.detail || 'Nie udało się wysłać emaila.')
  }
  return data
}

/**
 * Complete the password-reset using the token from the email link.
 *
 * @param {string} token     – raw token from the URL ?token= param
 * @param {string} newPassword
 * @returns {Promise<{message: string}>}
 */
export async function confirmPasswordReset(token, newPassword) {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  })
  const data = await safeJson(response)
  if (!response.ok) {
    throw new Error(data.detail || 'Token nieprawidłowy lub wygasł.')
  }
  return data
}
