import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const NotificationContext = createContext(null)

function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null)

  const clearNotification = useCallback(() => {
    setNotification(null)
  }, [])

  const showNotification = useCallback(({ type = 'info', title = null, message, duration = 5000, actions = [] }) => {
    if (!message) return

    const id = Date.now() + Math.random()
    setNotification({ id, type, title, message, actions })

    if (duration > 0) {
      window.setTimeout(() => {
        setNotification((current) => (current?.id === id ? null : current))
      }, duration)
    }
  }, [])

  const showSuccess = useCallback((message, options = {}) => {
    showNotification({ type: 'success', message, ...options })
  }, [showNotification])

  const showError = useCallback((message, options = {}) => {
    showNotification({ type: 'error', message, ...options })
  }, [showNotification])

  const showInfo = useCallback((message, options = {}) => {
    showNotification({ type: 'info', message, ...options })
  }, [showNotification])

  const showWarning = useCallback((message, options = {}) => {
    showNotification({ type: 'warning', message, ...options })
  }, [showNotification])

  const showConfirm = useCallback((message, options = {}) => {
    showNotification({
      type: 'confirm',
      message,
      duration: 0,
      ...options,
    })
  }, [showNotification])

  const value = useMemo(() => ({
    notification,
    showNotification,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showConfirm,
    clearNotification,
  }), [notification, showNotification, showSuccess, showError, showInfo, showWarning, showConfirm, clearNotification])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

export { NotificationProvider, useNotification }
