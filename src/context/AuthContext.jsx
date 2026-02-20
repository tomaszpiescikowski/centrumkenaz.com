import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../api/config'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState(null)

  const POST_LOGIN_REDIRECT_KEY = 'postLoginRedirect'

  const normalizeReturnTo = (returnTo, fallbackReturnTo) => (
    typeof returnTo === 'string' && returnTo.startsWith('/')
      ? returnTo
      : fallbackReturnTo
  )

  const setPostLoginRedirect = (returnTo) => {
    const fallbackReturnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const target = normalizeReturnTo(returnTo, fallbackReturnTo)
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, target)
  }

  const storeTokens = (newAccessToken, newRefreshToken) => {
    localStorage.setItem('accessToken', newAccessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
    setAccessToken(newAccessToken)
  }

  const parseErrorDetail = async (response, fallbackMessage) => {
    try {
      const payload = await response.json()
      if (typeof payload?.detail === 'string' && payload.detail.trim()) {
        return payload.detail
      }
    } catch (error) {
      console.error('Failed to parse auth error payload:', error)
    }
    return fallbackMessage
  }

  useEffect(() => {
    // Check for tokens in localStorage on mount
    const storedAccessToken = localStorage.getItem('accessToken')

    if (storedAccessToken) {
      setAccessToken(storedAccessToken)
      fetchUser(storedAccessToken)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async (token, options = {}) => {
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
        // Token invalid, try refresh
        await refreshToken()
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
  }

  const refreshToken = async () => {
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
        await fetchUser(data.access_token, { allowRefresh: false })
      } else {
        logout()
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      logout()
    }
  }

  const login = (options = {}) => {
    const { returnTo } = options
    setPostLoginRedirect(returnTo)
    navigate('/login')
  }

  const loginWithGoogle = (options = {}) => {
    const { returnTo } = options
    const existingRedirect = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    if (returnTo) {
      setPostLoginRedirect(returnTo)
    } else if (!existingRedirect) {
      setPostLoginRedirect('/')
    }
    window.location.href = `${API_URL}/auth/google/login`
  }

  const consumePostLoginRedirect = () => {
    const stored = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
    if (!stored) return null
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
    return stored
  }

  const handleAuthCallback = async (newAccessToken, newRefreshToken) => {
    storeTokens(newAccessToken, newRefreshToken)
    return await fetchUser(newAccessToken)
  }

  const loginWithPassword = async (credentials) => {
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
  }

  const registerWithPassword = async (payload) => {
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
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setAccessToken(null)
    setUser(null)
  }

  const authFetch = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    }

    const response = await fetch(url, { ...options, headers })

    if (response.status === 401) {
      await refreshToken()
      // Retry with new token
      const newToken = localStorage.getItem('accessToken')
      headers['Authorization'] = `Bearer ${newToken}`
      return fetch(url, { ...options, headers })
    }

    return response
  }

  const value = {
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
  }

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
