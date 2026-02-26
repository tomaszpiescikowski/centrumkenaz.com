import { createContext, useCallback, useContext, useRef, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../api/config'

const AuthContext = createContext()

const POST_LOGIN_REDIRECT_KEY = 'postLoginRedirect'

const PUBLIC_RETURN_EXCLUDED = ['/support']

const normalizeReturnTo = (returnTo, fallbackReturnTo) => {
  const candidate = typeof returnTo === 'string' && returnTo.startsWith('/')
    ? returnTo
    : fallbackReturnTo
  return PUBLIC_RETURN_EXCLUDED.some(p => candidate === p || candidate.startsWith(p + '?'))
    ? '/'
    : candidate
}

const parseErrorDetail = async (response, fallbackMessage) => {
  try {
    const payload = await response.json()
    // Our API returns {detail: "string"} for application errors
    if (typeof payload?.detail === 'string' && payload.detail.trim()) {
      return payload.detail
    }
    // FastAPI / Pydantic returns {detail: [{msg, loc, ...}, ...]} for validation errors
    if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
      const first = payload.detail[0]
      const field = first?.loc?.slice(1).join('.') ?? ''
      const msg = first?.msg ?? ''
      return field ? `${field}: ${msg}` : msg
    }
  } catch (error) {
    console.error('Failed to parse auth error payload:', error)
  }
  return fallbackMessage
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(null)
  const accessTokenRef = useRef(accessToken)
  const fetchUserRef = useRef(null)

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    accessTokenRef.current = null
    setAccessToken(null)
    setUser(null)
  }, [])

  const storeTokens = useCallback((newAccessToken, newRefreshToken) => {
    localStorage.setItem('accessToken', newAccessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
    accessTokenRef.current = newAccessToken
    setAccessToken(newAccessToken)
  }, [])

  const setPostLoginRedirect = useCallback((returnTo) => {
    const fallbackReturnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const target = normalizeReturnTo(returnTo, fallbackReturnTo)
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, target)
  }, [])

  const refreshTokenFn = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken')
    if (!storedRefreshToken) {
      logout()
      return
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storedRefreshToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        storeTokens(data.access_token, data.refresh_token)
        await fetchUserRef.current(data.access_token, { allowRefresh: false })
      } else {
        logout()
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      logout()
    }
  }, [logout, storeTokens])

  const fetchUser = useCallback(async (token, options = {}) => {
    const { allowRefresh = true } = options

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        return userData
      } else if (response.status === 401 && allowRefresh) {
        await refreshTokenFn()
      } else if (response.status === 429) {
        console.warn('Rate limited while fetching user profile')
      } else {
        logout()
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      logout()
    } finally {
      setLoading(false)
    }
    return null
  }, [logout, refreshTokenFn])

  fetchUserRef.current = fetchUser

  useEffect(() => {
    const storedAccessToken = localStorage.getItem('accessToken')

    if (storedAccessToken) {
      accessTokenRef.current = storedAccessToken
      setAccessToken(storedAccessToken)
      fetchUser(storedAccessToken)
    } else {
      setLoading(false)
    }
  }, [fetchUser])

  const handleAuthCallback = useCallback(async (newAccessToken, newRefreshToken) => {
    storeTokens(newAccessToken, newRefreshToken)
    return await fetchUser(newAccessToken)
  }, [storeTokens, fetchUser])

  const login = useCallback((options = {}) => {
    const { returnTo } = options
    setPostLoginRedirect(returnTo)
    navigate('/login')
  }, [navigate, setPostLoginRedirect])

  const loginWithGoogle = useCallback((options = {}) => {
    const { returnTo } = options
    const existingRedirect = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    if (returnTo) {
      setPostLoginRedirect(returnTo)
    } else if (!existingRedirect) {
      setPostLoginRedirect('/')
    }

    const isPwa = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches

    if (isPwa) {
      // In standalone/PWA mode on iOS, a full-page navigation to an external domain
      // (accounts.google.com) leaves the app and opens Safari — the OAuth callback
      // then stores tokens in Safari's isolated localStorage, never in the PWA.
      // Fix: open OAuth in a popup window; AuthCallback.jsx will postMessage the tokens
      // back here so the PWA receives them without ever leaving the app.
      const popup = window.open(`${API_URL}/auth/google/login`, '_blank')

      let pollClosed
      const handler = async (event) => {
        if (event.origin !== window.location.origin) return
        if (event.data?.type !== 'kenaz_auth_callback') return
        window.removeEventListener('message', handler)
        clearInterval(pollClosed)
        const { access_token, refresh_token } = event.data
        if (access_token && refresh_token) {
          const userData = await handleAuthCallback(access_token, refresh_token)
          const redirectTo = consumePostLoginRedirect()
          if (userData?.account_status === 'pending') {
            navigate('/pending-approval')
            return
          }
          const nextManualPayment = userData?.next_action_manual_payment
          if (nextManualPayment?.registration_id) {
            navigate(`/manual-payment/${nextManualPayment.registration_id}?from=waitlist`)
            return
          }
          navigate(redirectTo || '/')
        }
      }

      window.addEventListener('message', handler)
      // Clean up listener when the popup closes without posting a message (user cancelled)
      pollClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollClosed)
          window.removeEventListener('message', handler)
        }
      }, 500)
    } else {
      window.location.href = `${API_URL}/auth/google/login`
    }
  }, [setPostLoginRedirect, handleAuthCallback, consumePostLoginRedirect, navigate])

  const consumePostLoginRedirect = useCallback(() => {
    const stored = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    if (!stored) return null
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
    return stored
  }, [])

  const loginWithPassword = useCallback(async (credentials) => {
    const response = await fetch(`${API_URL}/auth/password/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const message = await parseErrorDetail(response, 'Login failed')
      throw new Error(message)
    }

    const data = await response.json()
    return handleAuthCallback(data.access_token, data.refresh_token)
  }, [handleAuthCallback])

  const registerWithPassword = useCallback(async (payload) => {
    const response = await fetch(`${API_URL}/auth/password/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const message = await parseErrorDetail(response, 'Registration failed')
      throw new Error(message)
    }

    const data = await response.json()
    return handleAuthCallback(data.access_token, data.refresh_token)
  }, [handleAuthCallback])

  const authFetch = useCallback(async (url, options = {}) => {
    const currentToken = accessTokenRef.current
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${currentToken}`,
    }

    const response = await fetch(url, { ...options, headers })

    if (response.status === 401) {
      const storedRefreshToken = localStorage.getItem('refreshToken')
      if (!storedRefreshToken) {
        logout()
        return response
      }

      try {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${storedRefreshToken}` },
        })

        if (refreshResponse.ok) {
          const data = await refreshResponse.json()
          localStorage.setItem('accessToken', data.access_token)
          localStorage.setItem('refreshToken', data.refresh_token)
          accessTokenRef.current = data.access_token
          setAccessToken(data.access_token)

          headers['Authorization'] = `Bearer ${data.access_token}`
          return fetch(url, { ...options, headers })
        } else {
          logout()
        }
      } catch (error) {
        console.error('Failed to refresh token:', error)
        logout()
      }
    }

    return response
  }, [logout])

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    loginWithPassword,
    registerWithPassword,
    logout,
    handleAuthCallback,
    fetchUser,
    authFetch,
    accessToken,
    consumePostLoginRedirect,
  }), [user, loading, login, loginWithGoogle, loginWithPassword, registerWithPassword, logout, handleAuthCallback, fetchUser, authFetch, accessToken, consumePostLoginRedirect])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
