const explicitApiUrl = import.meta.env.VITE_API_URL

// In dev mode only, infer the backend URL from the current browser hostname.
// This is evaluated at runtime so window.location is always available.
// NEVER falls back to localhost in production builds.
const getDevApiUrl = () => {
  if (typeof window === 'undefined') return ''
  return `http://${window.location.hostname}:8000`
}

export const API_URL = explicitApiUrl
  ? explicitApiUrl.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? getDevApiUrl()
    : ''
