const explicitApiUrl = import.meta.env.VITE_API_URL

// In dev mode only, infer the backend URL from the current browser hostname.
// This is evaluated at runtime so window.location is always available.
// NEVER falls back to localhost in production builds.
const getDevApiUrl = () => {
  if (typeof window === 'undefined') return ''
  return `http://${window.location.hostname}:8000`
}

// Guard: if a VITE_API_URL containing "localhost" was accidentally baked into a
// production build, ignore it and fall back to the safe relative "/api" path.
const safeExplicitApiUrl =
  !import.meta.env.DEV && explicitApiUrl && /localhost/i.test(explicitApiUrl)
    ? null
    : explicitApiUrl

export const API_URL = safeExplicitApiUrl
  ? safeExplicitApiUrl.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? `${getDevApiUrl()}/api`
    : '/api'

/**
 * Safely parse a JSON response, detecting HTML responses that indicate
 * a proxy misconfiguration (e.g. SPA fallback serving index.html).
 *
 * @param {Response} response - fetch Response to parse
 * @returns {Promise<any>} parsed JSON body
 */
export async function safeJson(response) {
  const ct = response.headers.get('content-type') || ''
  if (ct.includes('text/html')) {
    throw new Error('Server returned HTML instead of JSON – check backend/proxy configuration')
  }
  return response.json()
}
