import { useEffect } from 'react'
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

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      const error = searchParams.get('message')

      if (error) {
        console.error('Auth error:', error)
        if (!cancelled) {
          showError(error, { title: t('notifications.errorTitle') })
          navigate('/')
        }
        return
      }

      let userData = null
      if (accessToken && refreshToken) {
        userData = await handleAuthCallback(accessToken, refreshToken)
      }

      const returnTo = consumePostLoginRedirect()
      if (!cancelled) {
        if (userData?.account_status === 'pending') {
          navigate('/pending-approval')
          return
        }
        const nextManualPayment = userData?.next_action_manual_payment
        if (nextManualPayment?.registration_id) {
          navigate(`/registrations/${nextManualPayment.registration_id}/manual-payment?from=waitlist`)
          return
        }
        navigate(returnTo || '/')
      }
    }

    run()
    return () => {
      cancelled = true
    }
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
