import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { fetchMyRegistrations, cancelRegistration } from '../../api/user'
import AuthGateCard from '../../components/ui/AuthGateCard'

function MyEvents() {
  const { user, isAuthenticated, authFetch, login } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)

  const isPendingApproval = isAuthenticated && user?.account_status !== 'active'

  useEffect(() => {
    if (!isAuthenticated || isPendingApproval) {
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchMyRegistrations(authFetch)
        if (!cancelled) setRegistrations(data)
      } catch (err) {
        if (!cancelled) {
          setRegistrations([])
          showError(err.message || t('account.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authFetch, isAuthenticated, isPendingApproval, t, showError])

  const handleCancel = async (registrationId) => {
    try {
      await cancelRegistration(authFetch, registrationId)
      const data = await fetchMyRegistrations(authFetch)
      setRegistrations(data)
      showSuccess(t('account.cancelSuccess'))
    } catch (err) {
      showError(err.message || t('account.cancelError'))
    }
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('account.myEvents')}
        message={t('account.loginRequired')}
        actionLabel={t('account.loginButton')}
        onAction={() => login({ returnTo: '/my-events' })}
      />
    )
  }

  if (isPendingApproval) {
    return (
      <div className="page-shell relative flex h-full min-h-0 flex-col gap-4 sm:gap-6">
        <div className="pointer-events-none select-none blur-[3px]">
          <div className="shrink-0">
            <h1 className="text-3xl font-black text-navy dark:text-cream md:text-4xl">
              {t('account.myEvents')}
            </h1>
          </div>
          <section className="min-h-0 flex-1 mt-4">
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="page-card h-28 bg-navy/5 dark:bg-cream/5" />
              ))}
            </div>
          </section>
        </div>
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-navy/20 bg-cream/85 p-5 text-center shadow-xl dark:border-cream/20 dark:bg-navy/85">
            <p className="text-xl font-black text-navy dark:text-cream">
              {t('calendar.pendingRequiredTitle')}
            </p>
            <p className="mt-2 text-navy/80 dark:text-cream/80">
              {t('calendar.pendingRequiredBody')}
            </p>
            <Link
              to="/pending-approval"
              className="btn-primary mt-4 px-6 py-3 font-bold"
            >
              {t('calendar.pendingRequiredButton')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell flex h-full min-h-0 flex-col gap-4 sm:gap-6">
      <div className="shrink-0">
        <h1 className="text-3xl font-black text-navy dark:text-cream md:text-4xl">
          {t('account.myEvents')}
        </h1>
      </div>

      <section className="min-h-0 flex-1">
        {loading ? (
          <p className="mt-3 text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
        ) : registrations.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-navy/20 p-6 dark:border-cream/20">
            <p className="text-navy/70 dark:text-cream/70">{t('account.noEvents')}</p>
          </div>
        ) : (
          <div className="mt-3 flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 sm:pr-2">
              {registrations.map((reg) => {
                const eventPassed = new Date(reg.event.start_date) < new Date()
                const pointsEarned = eventPassed && reg.status === 'confirmed' && reg.event.points_value > 0

                return (
                  <div
                    key={reg.registration_id}
                    className="page-card relative"
                  >
                    {pointsEarned && (
                      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-navy/10 px-2 py-1 text-xs font-bold text-navy dark:bg-cream/20 dark:text-cream">
                        <span>+{reg.event.points_value}</span>
                        <span className="opacity-70">{t('admin.pointsAbbr')}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-between gap-4">
                      <div className={pointsEarned ? 'pr-16' : ''}>
                        <h3 className="text-lg font-bold text-navy dark:text-cream">
                          {reg.event.title}
                        </h3>
                        <p className="text-sm text-navy/60 dark:text-cream/60">
                          {formatDate(reg.event.start_date)}
                          {reg.event.city ? ` • ${reg.event.city}` : ''}
                        </p>
                        {reg.event.location && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reg.event.location)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-navy dark:text-cream"
                          >
                            {reg.event.location} ↗
                          </a>
                        )}
                      </div>
                      <Link
                        to={`/event/${reg.event.id}`}
                        className="text-sm font-semibold text-navy dark:text-cream"
                      >
                        {t('account.viewEvent')}
                      </Link>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                      <Badge label={t('account.status')} value={t(`account.statuses.${reg.status}`)} />
                      <Badge
                        label={t('account.cancellationWindow')}
                        value={reg.can_cancel
                          ? t('account.cancellationOpen')
                          : t('account.cancellationClosed')}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {reg.can_confirm_manual_payment && (
                        <Link
                          to={`/registrations/${reg.registration_id}/manual-payment`}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          {t('account.openManualPayment')}
                        </Link>
                      )}
                      {reg.status !== 'confirmed'
                        && reg.status !== 'pending'
                        && reg.status !== 'manual_payment_required'
                        && reg.status !== 'manual_payment_verification' ? (
                        <button
                          disabled
                          className="cursor-not-allowed rounded-full bg-navy/20 px-4 py-2 text-sm font-semibold text-navy/50 dark:bg-cream/20 dark:text-cream/50"
                        >
                          {t('account.cancellationClosedMessage')}
                        </button>
                      ) : reg.can_cancel ? (
                        <button
                          onClick={() => handleCancel(reg.registration_id)}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          {t('account.cancelStandard')}
                        </button>
                      ) : (
                        <p className="text-sm text-navy/60 dark:text-cream/60">
                          {t('account.cancellationClosedMessage')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Badge({ label, value, title }) {
  return (
    <div className="rounded-full bg-navy/5 px-3 py-2 text-xs dark:bg-cream/10">
      <span className="text-navy/60 dark:text-cream/60">{label}: </span>
      <span className="font-semibold text-navy dark:text-cream" title={title}>{value}</span>
    </div>
  )
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default MyEvents
