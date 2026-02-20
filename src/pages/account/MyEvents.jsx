import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { fetchMyRegistrations, cancelRegistration } from '../../api/user'

function MyEvents() {
  const { user, isAuthenticated, authFetch } = useAuth()
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

  const mockCards = [
    { category: 'General fitness', title: 'Morning functional training', date: 'Tuesday, 24 February 2026', time: '07:30 – 08:30', location: 'Room A, Wyżyny 16' },
    { category: 'Yoga & breathwork', title: 'Evening yoga for beginners', date: 'Thursday, 26 February 2026', time: '19:00 – 20:15', location: 'Room B, Wyżyny 16' },
    { category: 'Movement & mobility', title: 'Mobility and stretching session', date: 'Saturday, 28 February 2026', time: '09:00 – 10:00', location: 'Room A, Wyżyny 16' },
    { category: 'Workshop', title: 'Breathwork workshop – Wim Hof method', date: 'Sunday, 1 March 2026', time: '10:30 – 12:00', location: 'Main hall, Wyżyny 16' },
  ]

  if (!isAuthenticated) {
    return (
      <div className="flex h-full min-h-0 flex-col px-3 py-3 sm:px-4 sm:py-6">
        <div className="pointer-events-none select-none blur-[3px]">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="text-3xl font-black text-navy dark:text-cream md:text-4xl">
              {t('account.myEvents')}
            </h1>
            <div className="mt-4 space-y-4">
              {mockCards.map((e, i) => (
                <div key={i} className="rounded-2xl bg-navy/10 dark:bg-cream/10 border border-navy/15 dark:border-cream/15 p-5 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 dark:text-cream/50 mb-1">{e.category}</div>
                      <div className="text-lg font-black text-navy dark:text-cream leading-tight">{e.title}</div>
                    </div>
                    <div className="shrink-0 rounded-xl bg-navy/20 dark:bg-cream/20 px-3 py-1 text-xs font-bold text-navy dark:text-cream">Zapisany</div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-navy/60 dark:text-cream/60 mt-1">
                    <span>📅 {e.date}</span>
                    <span>🕗 {e.time}</span>
                    <span>📍 {e.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isPendingApproval) {
    return (
      <div className="flex h-full min-h-0 flex-col px-3 py-3 sm:px-4 sm:py-6">
        <div className="pointer-events-none select-none blur-[3px]">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="text-3xl font-black text-navy dark:text-cream md:text-4xl">
              {t('account.myEvents')}
            </h1>
            <div className="mt-4 space-y-4">
              {mockCards.map((e, i) => (
                <div key={i} className="rounded-2xl bg-navy/10 dark:bg-cream/10 border border-navy/15 dark:border-cream/15 p-5 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 dark:text-cream/50 mb-1">{e.category}</div>
                      <div className="text-lg font-black text-navy dark:text-cream leading-tight">{e.title}</div>
                    </div>
                    <div className="shrink-0 rounded-xl bg-navy/20 dark:bg-cream/20 px-3 py-1 text-xs font-bold text-navy dark:text-cream">Zapisany</div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-navy/60 dark:text-cream/60 mt-1">
                    <span>📅 {e.date}</span>
                    <span>🕗 {e.time}</span>
                    <span>📍 {e.location}</span>
                  </div>
                </div>
              ))}
            </div>
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
