import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { fetchMyRegistrations, cancelRegistration } from '../../api/user'
import EventIcon from '../../components/common/EventIcon'


function Panel() {
  const { user, isAuthenticated, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess, showConfirm } = useNotification()
  const navigate = useNavigate()
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

  const handleCancel = (reg) => {
    const price = parseFloat(reg.effective_price || '0')
    const isManualPaid = reg.event.manual_payment_verification && price > 0

    let message = t('account.cancelConfirmMessage')
    if (isManualPaid) {
      message += '\n\n' + t('account.cancelConfirmManualRefund')
    }

    showConfirm(message, {
      actions: [
        {
          label: t('common.close'),
          variant: 'neutral',
        },
        {
          label: t('account.cancelConfirmButton'),
          variant: 'danger',
          onClick: async () => {
            try {
              await cancelRegistration(authFetch, reg.registration_id)
              const data = await fetchMyRegistrations(authFetch)
              setRegistrations(data)
              showSuccess(t('account.cancelSuccess'))
            } catch (err) {
              showError(err.message || t('account.cancelError'))
            }
          },
        },
      ],
    })
  }

  const mockCards = [
    { category: 'General fitness', title: 'Morning functional training', date: 'Tuesday, 24 February 2026', time: '07:30 – 08:30', location: 'Room A, Wyżyny 16' },
    { category: 'Yoga & breathwork', title: 'Evening yoga for beginners', date: 'Thursday, 26 February 2026', time: '19:00 – 20:15', location: 'Room B, Wyżyny 16' },
    { category: 'Movement & mobility', title: 'Mobility and stretching session', date: 'Saturday, 28 February 2026', time: '09:00 – 10:00', location: 'Room A, Wyżyny 16' },
    { category: 'Workshop', title: 'Breathwork workshop – Wim Hof method', date: 'Sunday, 1 March 2026', time: '10:30 – 12:00', location: 'Main hall, Wyżyny 16' },
  ]

  // Blurred placeholder for unauthenticated / pending users
  if (!isAuthenticated || isPendingApproval) {
    return (
      <div className="flex h-full min-h-0 flex-col px-3 py-3 sm:px-4 sm:py-6">
        <div className="pointer-events-none select-none blur-[3px]">
          <div className="mx-auto w-full max-w-4xl">
            <h1 className="text-3xl font-black text-navy dark:text-cream md:text-4xl">
              {t('nav.panel')}
            </h1>
            <div className="mt-6 flex flex-col gap-6 lg:flex-row">
              {/* My events mock tile */}
              <div className="panel-tile flex-1">
                <div className="panel-tile-header">
                  <h2 className="text-sm font-bold text-navy dark:text-cream">{t('events.myEventsTitle')}</h2>
                </div>
                <div className="divide-y divide-navy/10 dark:divide-cream/10">
                  {mockCards.slice(0, 2).map((e, i) => (
                    <div key={i} className="panel-row panel-row-ok flex flex-col gap-2">
                      <div className="text-sm font-semibold text-navy dark:text-cream leading-tight">{e.title}</div>
                      <div className="flex flex-wrap gap-3 text-xs text-navy/60 dark:text-cream/60">
                        <span>{e.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell flex h-full min-h-0 flex-col gap-4 sm:gap-6">
      <div className="shrink-0">
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
          {t('nav.panel')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60">
          {t('events.panelSubtitle')}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        {/* Left tile – My Events */}
        <section className="panel-tile flex min-h-0 flex-1 flex-col">
          <div className="panel-tile-header">
            <h2 className="text-sm font-bold text-navy dark:text-cream">
              {t('events.myEventsTitle')}
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-5 py-4 text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
            ) : registrations.length === 0 ? (
              <div className="px-5 py-4">
                <div className="rounded-2xl border border-dashed border-navy/20 p-6 dark:border-cream/20">
                  <p className="text-navy/70 dark:text-cream/70">{t('account.noEvents')}</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-navy/10 dark:divide-cream/10">
                {registrations.map((reg) => {
                  const eventPassed = new Date(reg.event.start_date) < new Date()
                  const price = parseFloat(reg.effective_price || '0')
                  const isFree = price === 0
                  const showTransferRef = reg.manual_payment_transfer_reference && (
                    reg.status === 'manual_payment_required' ||
                    reg.status === 'manual_payment_verification' ||
                    reg.status === 'confirmed'
                  )

                  return (
                    <div
                      key={reg.registration_id}
                      className={`panel-row panel-row-clickable relative ${statusRowClass(reg.status)}`}
                      onClick={() => navigate(`/event/${reg.event.id}`)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/event/${reg.event.id}`) }}
                    >
                      <div className="flex gap-3">
                        {/* Left 2/3 – event data */}
                        <div className="flex-[2] min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-cream">
                            <EventIcon type={reg.event.event_type || 'inne'} size="sm" />
                            <span className="truncate">{reg.event.title}</span>
                          </div>
                          <p className="text-xs text-navy/60 dark:text-cream/60">
                            {formatDate(reg.event.start_date)}
                            {reg.event.city ? ` • ${reg.event.city}` : ''}
                          </p>
                          {reg.event.location && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reg.event.location)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-navy dark:text-cream"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {reg.event.location} ↗
                            </a>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <StatusPill status={reg.status} label={t(`account.statuses.${reg.status}`)} />
                            {!isFree && (
                              <span className="panel-info-chip">
                                <span className="panel-info-label">{t('account.price')}:</span> {price.toFixed(2)} zł
                              </span>
                            )}
                            {isFree && (
                              <span className="panel-info-chip">
                                {t('account.free')}
                              </span>
                            )}

                          </div>

                        </div>

                        {/* Right 1/3 – actions */}
                        <div className="flex-1 flex flex-col items-end justify-between" onClick={(e) => e.stopPropagation()}>
                          {/* Bottom-right: Manual payment + Cancel */}
                          <div className="flex flex-col items-end gap-1.5">
                            {reg.can_confirm_manual_payment && (
                              <Link
                                to={`/manual-payment/${reg.registration_id}`}
                                className="btn-primary px-3 py-1.5 text-xs"
                              >
                                {t('account.openManualPayment')}
                              </Link>
                            )}
                            {!eventPassed && reg.status !== 'cancelled' && reg.status !== 'refunded' && (
                              reg.can_cancel ? (
                                <button
                                  onClick={() => handleCancel(reg)}
                                  className="btn-primary px-3 py-1.5 text-xs"
                                >
                                  {t('account.cancelStandard')}
                                </button>
                              ) : (
                                <span
                                  className="panel-cancel-disabled text-xs"
                                  title={t('account.cancellationNotPossible')}
                                >
                                  {t('account.cancelStandard')}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}

function statusRowClass(status) {
  if (status === 'confirmed') return 'panel-row-ok'
  if (status === 'pending' || status === 'manual_payment_verification') return 'panel-row-wait'
  if (status === 'manual_payment_required') return 'panel-row-pay'
  return ''
}

function statusPillClass(status) {
  if (status === 'confirmed') return 'ev-leg-ok'
  if (status === 'pending' || status === 'manual_payment_verification') return 'ev-leg-wait'
  if (status === 'manual_payment_required') return 'ev-leg-pay'
  if (status === 'waitlist') return 'ev-leg-wait'
  if (status === 'cancelled' || status === 'refunded') return 'ev-leg-cancel'
  return ''
}

function StatusPill({ status, label }) {
  return (
    <span className={`ev-leg-pill ${statusPillClass(status)}`}>
      {label}
    </span>
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

export default Panel
