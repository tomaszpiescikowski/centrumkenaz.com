import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../context/NotificationContext'
import { useLanguage } from '../../context/LanguageContext'

function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { handleAuthCallback, consumePostLoginRedirect } = useAuth()
  const { showError } = useNotification()
  const { t } = useLanguage()
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const run = async () => {
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      const error = searchParams.get('message')

      if (error) {
        console.error('Auth error:', error)
        showError(error, { title: t('notifications.errorTitle') })
        navigate('/')
        return
      }

      let userData = null
      if (accessToken && refreshToken) {
        // If we were opened as a popup from a PWA loginWithGoogle() call, postMessage the tokens
        // back to the opener instead of storing them here (which would put them in Safari's
        // isolated localStorage, not the PWA's). The opener's handler stores tokens and navigates.
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(
              { type: 'kenaz_auth_callback', access_token: accessToken, refresh_token: refreshToken },
              window.location.origin
            )
            window.close()
            return
          } catch {
            // postMessage failed — fall through to normal flow
          }
        }
        userData = await handleAuthCallback(accessToken, refreshToken).catch((err) => {
          // Unexpected error — tokens may still be in localStorage; proceed so
          // AuthContext can retry the user-fetch on the next page load.
          console.error('Auth callback error:', err)
          return null
        })
      }

      const returnTo = consumePostLoginRedirect()
      if (userData?.account_status === 'pending') {
        window.location.href = '/pending-approval'
        return
      }
      const nextManualPayment = userData?.next_action_manual_payment
      if (nextManualPayment?.registration_id) {
        window.location.href = `/manual-payment/${nextManualPayment.registration_id}?from=waitlist`
        return
      }
      window.location.href = returnTo || '/'
    }

    run()
  }, [searchParams, handleAuthCallback, consumePostLoginRedirect, navigate, showError, t])

  return (
    <div className="page-shell flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="page-card text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy dark:border-cream mx-auto mb-4"></div>
        <p className="text-navy dark:text-cream">Logowanie...</p>
      </div>
    </div>
  )
}

export default AuthCallback
