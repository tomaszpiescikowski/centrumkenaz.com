import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { API_URL } from '../../api/config'

function RegisterButton({ eventId, price, isFull, isPast, isRegistered, requiresSubscription, onSuccess }) {
  const { t } = useLanguage()
  const { isAuthenticated, login, authFetch, user } = useAuth()

  const needsSubscription = requiresSubscription && isAuthenticated
    && user?.role !== 'member' && user?.role !== 'admin'
  const { showError, showSuccess } = useNotification()
  const [loading, setLoading] = useState(false)
  const [locked, setLocked] = useState(false)

  const mapErrorMessage = (detail) => {
    const raw = typeof detail === 'string' ? detail : ''
    const normalized = raw.toLowerCase()

    if (normalized.includes('subscription required')) {
      return t('registration.errorSubscriptionRequired')
    }
    if (normalized.includes('already registered')) {
      return t('registration.alreadyRegistered')
    }
    if (normalized.includes('no spots') || normalized.includes('full')) {
      return t('registration.noSpots')
    }
    if (
      normalized.includes('already started')
      || normalized.includes('event has passed')
      || normalized.includes('past events')
      || normalized.includes('cannot register for past')
    ) {
      return t('registration.errorPastEvent')
    }
    if (raw) {
      return raw
    }
    return t('registration.errorFailed')
  }

  const handleRegister = async () => {
    if (!isAuthenticated) {
      login()
      return
    }

    if (locked || isRegistered) {
      return
    }

    setLoading(true)

    const eventPath = `/event/${eventId}`
    const successUrl = `${window.location.origin}${eventPath}?payment=success`
    const cancelUrl = `${window.location.origin}${eventPath}?payment=cancelled`

    try {
      const response = await authFetch(`${API_URL}/events/${eventId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: successUrl,
          cancel_url: cancelUrl,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const rawDetail = data.detail || ''
        const message = mapErrorMessage(rawDetail)
        showError(message)
        if (String(rawDetail).toLowerCase().includes('already registered')) {
          setLocked(true)
        }
        return
      }

      if (data.status === 'waitlist' || data.is_waitlisted) {
        showSuccess(t('registration.waitlistSuccess'), {
          title: t('registration.waitlistTitle'),
        })
        if (onSuccess) onSuccess()
        setLocked(true)
        return
      }

      if (data.is_free || data.status === 'confirmed') {
        // Free event - registration confirmed
        showSuccess(t('event.registrationSuccessSubtitle'), {
          title: t('event.registrationSuccessTitle'),
        })
        if (onSuccess) onSuccess()
        setLocked(true)
      } else if ((data.manual_payment_required || data.status === 'manual_payment_required') && data.registration_id) {
        showSuccess(t('registration.manualPaymentRedirectSuccess'), {
          title: t('registration.manualPaymentRedirectTitle'),
        })
        if (onSuccess) onSuccess()
        window.location.href = `/manual-payment/${data.registration_id}`
      } else if (data.redirect_url) {
        // Paid event - redirect to payment
        window.location.href = data.redirect_url
      }
    } catch (err) {
      console.error('Registration error:', err)
      showError(t('registration.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  if (isPast) {
    return (
      <button
        disabled
        className="ev-cta-btn
          bg-navy/20 dark:bg-cream/20 text-navy/50 dark:text-cream/50
          cursor-not-allowed"
      >
        {t('registration.pastEvent')}
      </button>
    )
  }

  if (isRegistered || locked) {
    return (
      <button
        disabled
        className="ev-cta-btn
          bg-navy/20 dark:bg-cream/20 text-navy/50 dark:text-cream/50
          cursor-not-allowed"
      >
        {t('registration.alreadyRegistered')}
      </button>
    )
  }

  if (needsSubscription) {
    return (
      <div className="space-y-2">
        <button
          disabled
          className="ev-cta-btn
            bg-navy/20 dark:bg-cream/20 text-navy/50 dark:text-cream/50
            cursor-not-allowed"
        >
          {t('registration.ctaSignUp')}
        </button>
        <p className="text-center text-xs text-navy/50 dark:text-cream/50">
          {t('registration.subscriptionDisabledHint')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleRegister}
        disabled={loading}
        className={`
          ev-cta-btn
          transition-all hover:scale-[1.01]
          ${loading
            ? 'bg-navy/50 dark:bg-cream/50 cursor-not-allowed'
            : 'btn-primary'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('registration.submitting')}
          </span>
        ) : isAuthenticated ? (
          isFull
            ? t('registration.ctaWaitlist')
            : t('registration.ctaSignUp')
        ) : (
          t('registration.ctaLogin')
        )}
      </button>
      {!isAuthenticated && (
        <p className="text-center text-xs text-navy/50 dark:text-cream/50">
          {t('registration.mustBeLoggedIn')}
        </p>
      )}
    </div>
  )
}

export default RegisterButton
