import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import {
  fetchAdminEventStats,
  fetchAdminPaymentStats,
  fetchAdminRegistrationStats,
  fetchAdminUserStats,
} from '../../api/admin'
import SortableDataTable from '../../components/ui/SortableDataTable'
import ViewCard from '../../components/ui/ViewCard'
import AuthGateCard from '../../components/ui/AuthGateCard'
import usePreserveScrollSearchSwitch from '../../hooks/usePreserveScrollSearchSwitch'
import useViewSorts from '../../hooks/useViewSorts'
import { formatAmount, formatPercent, parseAmount, parsePercent } from '../../utils/numberFormat'

const ALLOWED_VIEWS = ['events', 'users', 'payments', 'registrations']
const createDefaultSorts = () => ({
  events: [],
  users: [],
  payments: [],
  registrations: [],
})

function AdminPayments() {
  const { user, isAuthenticated, authFetch, login } = useAuth()
  const { t } = useLanguage()
  const { showError } = useNotification()
  const [eventStats, setEventStats] = useState([])
  const [userStats, setUserStats] = useState([])
  const [paymentStats, setPaymentStats] = useState(null)
  const [registrationStats, setRegistrationStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monthCursor, setMonthCursor] = useState(() => new Date())
  const [searchParams, setSearchParams] = useSearchParams()
  const { sortByView, toggleSort } = useViewSorts(createDefaultSorts)

  const isAdmin = user?.role === 'admin'

  const monthKey = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`
  const requestedView = searchParams.get('view')
  const activeView = ALLOWED_VIEWS.includes(requestedView) ? requestedView : null
  const showMonthScope = activeView === 'events' || activeView === 'payments' || activeView === 'registrations'
  const switchView = usePreserveScrollSearchSwitch(setSearchParams, 'view')

  useEffect(() => {
    if (requestedView && !ALLOWED_VIEWS.includes(requestedView)) {
      setSearchParams({ view: 'events' }, { replace: true })
    }
  }, [requestedView, setSearchParams])

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const [events, users, payments, registrations] = await Promise.all([
          fetchAdminEventStats(authFetch, monthKey),
          fetchAdminUserStats(authFetch),
          fetchAdminPaymentStats(authFetch, monthKey),
          fetchAdminRegistrationStats(authFetch, monthKey),
        ])
        if (!cancelled) {
          setEventStats(events)
          setUserStats(users)
          setPaymentStats(payments)
          setRegistrationStats(registrations)
        }
      } catch (err) {
        if (!cancelled) {
          setEventStats([])
          setUserStats([])
          setPaymentStats(null)
          setRegistrationStats(null)
          showError(err.message || t('admin.statsError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authFetch, isAdmin, isAuthenticated, monthKey, t, showError])

  const eventRows = useMemo(() => {
    return (eventStats || []).map((event) => {
      const confirmedCount = Number(event.confirmed_count || 0)
      const maxParticipants = event.max_participants ?? null
      const fillPercentValue = maxParticipants
        ? (confirmedCount / maxParticipants) * 100
        : parsePercent(event.fill_percent)
      return {
        event_id: event.event_id,
        title: event.title,
        event_type: event.event_type,
        start_date: event.start_date,
        start_date_value: Date.parse(event.start_date) || 0,
        city: event.city,
        attendance_label: maxParticipants ? `${confirmedCount}/${maxParticipants}` : `${confirmedCount}/∞`,
        attendance_value: confirmedCount,
        fill_percent_label: maxParticipants ? formatPercent(fillPercentValue, 0) : '—',
        fill_percent_value: maxParticipants ? fillPercentValue : -1,
        total_paid: event.total_paid,
        revenue_value: parseAmount(event.total_paid),
      }
    })
  }, [eventStats])

  const userRows = useMemo(() => {
    return (userStats || []).map((row) => ({
      user_id: row.user_id,
      user_label: row.full_name || '—',
      email: row.email,
      role: row.role,
      role_label: t(`admin.userRoles.${row.role}`),
      status: row.account_status,
      status_label: t(`admin.userStatuses.${row.account_status}`),
      event_count: Number(row.event_count || 0),
      total_paid: row.total_paid,
      total_paid_value: parseAmount(row.total_paid),
      points: Number(row.points || 0),
    }))
  }, [userStats, t])

  const paymentRows = useMemo(() => {
    const totalCount = Number(paymentStats?.total_count || 0)
    const totalAmount = parseAmount(paymentStats?.total_amount || '0')

    return (paymentStats?.by_status || []).map((row) => {
      const count = Number(row.count || 0)
      const rowTotal = parseAmount(row.total_amount)
      const average = count > 0 ? rowTotal / count : 0
      const countShare = totalCount > 0 ? (count / totalCount) * 100 : 0
      const amountShare = totalAmount > 0 ? (rowTotal / totalAmount) * 100 : 0
      return {
        status: row.status,
        status_label: t(`admin.paymentStatuses.${row.status}`),
        count,
        count_share_label: formatPercent(countShare, 1),
        count_share_value: countShare,
        total_amount_label: row.total_amount,
        total_amount_value: rowTotal,
        average_amount_label: formatAmount(average),
        average_amount_value: average,
        amount_share_label: formatPercent(amountShare, 1),
        amount_share_value: amountShare,
      }
    })
  }, [paymentStats, t])

  const registrationRows = useMemo(() => {
    const totalConfirmed = Number(registrationStats?.confirmed_count || 0)
    return (registrationStats?.top_events || []).map((row) => {
      const confirmedCount = Number(row.confirmed_count || 0)
      const maxParticipants = row.max_participants ?? null
      const fillPercentValue = maxParticipants
        ? (confirmedCount / maxParticipants) * 100
        : parsePercent(row.fill_percent)
      const shareValue = totalConfirmed > 0 ? (confirmedCount / totalConfirmed) * 100 : 0

      return {
        event_id: row.event_id,
        title: row.title,
        city: row.city,
        confirmed_count: confirmedCount,
        limit_label: maxParticipants ?? '∞',
        limit_value: maxParticipants ?? Number.MAX_SAFE_INTEGER,
        fill_label: maxParticipants ? formatPercent(fillPercentValue, 0) : '—',
        fill_value: maxParticipants ? fillPercentValue : -1,
        share_label: formatPercent(shareValue, 1),
        share_value: shareValue,
      }
    })
  }, [registrationStats])

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.paymentsTitle')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/payments' })}
      />
    )
  }

  if (!isAdmin) {
    return (
      <AuthGateCard
        title={t('admin.notAuthorizedTitle')}
        message={t('admin.notAuthorized')}
        actionLabel={t('admin.backToDashboard')}
        actionTo="/admin"
      />
    )
  }

  const months = t('calendar.months')
  const monthLabel = `${months[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`

  const shiftMonth = (delta) => {
    const next = new Date(monthCursor)
    next.setDate(1)
    next.setMonth(next.getMonth() + delta)
    setMonthCursor(next)
  }

  const eventColumns = [
    {
      key: 'title',
      label: t('admin.tables.event'),
      sortValue: (row) => row.title,
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-navy dark:text-cream">{row.title}</div>
          <div className="truncate text-[11px] text-navy/60 dark:text-cream/60">{t(`eventTypes.${row.event_type}`)}</div>
        </div>
      ),
    },
    {
      key: 'start_date_value',
      label: t('admin.fields.startDate'),
      sortValue: (row) => row.start_date_value,
      render: (row) => <span className="whitespace-nowrap text-navy/75 dark:text-cream/75">{row.start_date}</span>,
    },
    {
      key: 'city',
      label: t('admin.fields.city'),
      sortValue: (row) => row.city,
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.city}</span>,
    },
    {
      key: 'attendance_value',
      label: t('admin.tables.attendance'),
      sortValue: (row) => row.attendance_value,
      align: 'right',
      render: (row) => <span className="font-semibold text-navy/80 dark:text-cream/80">{row.attendance_label}</span>,
    },
    {
      key: 'fill_percent_value',
      label: t('admin.stats.fill'),
      sortValue: (row) => row.fill_percent_value,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.fill_percent_label}</span>,
    },
    {
      key: 'revenue_value',
      label: t('admin.stats.totalPaid'),
      sortValue: (row) => row.revenue_value,
      align: 'right',
      render: (row) => <span className="font-semibold text-navy/80 dark:text-cream/80">{row.total_paid}</span>,
    },
  ]

  const userColumns = [
    {
      key: 'user_label',
      label: t('admin.tables.user'),
      sortValue: (row) => `${row.user_label} ${row.email}`,
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-navy dark:text-cream">{row.user_label}</div>
          <div className="truncate text-[11px] text-navy/60 dark:text-cream/60">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'role_label',
      label: t('admin.userStats.role'),
      sortValue: (row) => row.role_label,
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.role_label}</span>,
    },
    {
      key: 'status_label',
      label: t('admin.userStats.status'),
      sortValue: (row) => row.status_label,
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.status_label}</span>,
    },
    {
      key: 'event_count',
      label: t('admin.userStats.events'),
      sortValue: (row) => row.event_count,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.event_count}</span>,
    },
    {
      key: 'total_paid_value',
      label: t('admin.userStats.totalPaid'),
      sortValue: (row) => row.total_paid_value,
      align: 'right',
      render: (row) => <span className="font-semibold text-navy/80 dark:text-cream/80">{row.total_paid}</span>,
    },
    {
      key: 'points',
      label: t('admin.userStats.points'),
      sortValue: (row) => row.points,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.points}</span>,
    },
  ]

  const paymentColumns = [
    {
      key: 'status_label',
      label: t('account.status'),
      sortValue: (row) => row.status_label,
      render: (row) => <span className="font-semibold text-navy dark:text-cream">{row.status_label}</span>,
    },
    {
      key: 'count',
      label: t('admin.tables.count'),
      sortValue: (row) => row.count,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.count}</span>,
    },
    {
      key: 'count_share_value',
      label: t('admin.tables.countShare'),
      sortValue: (row) => row.count_share_value,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.count_share_label}</span>,
    },
    {
      key: 'total_amount_value',
      label: t('admin.tables.amount'),
      sortValue: (row) => row.total_amount_value,
      align: 'right',
      render: (row) => <span className="font-semibold text-navy/80 dark:text-cream/80">{row.total_amount_label}</span>,
    },
    {
      key: 'average_amount_value',
      label: t('admin.tables.averageAmount'),
      sortValue: (row) => row.average_amount_value,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.average_amount_label}</span>,
    },
    {
      key: 'amount_share_value',
      label: t('admin.tables.amountShare'),
      sortValue: (row) => row.amount_share_value,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.amount_share_label}</span>,
    },
  ]

  const registrationColumns = [
    {
      key: 'title',
      label: t('admin.tables.event'),
      sortValue: (row) => row.title,
      render: (row) => <span className="font-semibold text-navy dark:text-cream">{row.title}</span>,
    },
    {
      key: 'city',
      label: t('admin.fields.city'),
      sortValue: (row) => row.city,
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.city}</span>,
    },
    {
      key: 'confirmed_count',
      label: t('admin.tables.confirmed'),
      sortValue: (row) => row.confirmed_count,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.confirmed_count}</span>,
    },
    {
      key: 'limit_value',
      label: t('admin.tables.limit'),
      sortValue: (row) => row.limit_value,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.limit_label}</span>,
    },
    {
      key: 'fill_value',
      label: t('admin.stats.fill'),
      sortValue: (row) => row.fill_value,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.fill_label}</span>,
    },
    {
      key: 'share_value',
      label: t('admin.tables.share'),
      sortValue: (row) => row.share_value,
      align: 'right',
      render: (row) => <span className="text-navy/75 dark:text-cream/75">{row.share_label}</span>,
    },
  ]

  return (
    <div className="page-shell space-y-8">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70"
        >
          <span>←</span>
          {t('admin.backToDashboard')}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream mt-3">
          {t('admin.paymentsTitle')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60">
          {t('admin.paymentsSubtitle')}
        </p>
      </div>

      {loading ? (
        <p className="text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ViewCard
              title={t('admin.statsCards.eventsTitle')}
              description={t('admin.statsCards.eventsDesc')}
              onClick={() => switchView('events')}
              isActive={activeView === 'events'}
            />
            <ViewCard
              title={t('admin.statsCards.usersTitle')}
              description={t('admin.statsCards.usersDesc')}
              onClick={() => switchView('users')}
              isActive={activeView === 'users'}
            />
            <ViewCard
              title={t('admin.statsCards.paymentsTitle')}
              description={t('admin.statsCards.paymentsDesc')}
              onClick={() => switchView('payments')}
              isActive={activeView === 'payments'}
            />
            <ViewCard
              title={t('admin.statsCards.registrationsTitle')}
              description={t('admin.statsCards.registrationsDesc')}
              onClick={() => switchView('registrations')}
              isActive={activeView === 'registrations'}
            />
          </section>

          {!activeView && (
            <div className="page-card text-center text-sm text-navy/70 dark:text-cream/70">
              {t('admin.statsCards.pickView')}
            </div>
          )}

          {activeView && showMonthScope && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-navy dark:text-cream">
                {
                  activeView === 'events'
                    ? t('admin.eventStatsTitle')
                    : activeView === 'payments'
                      ? t('admin.paymentStatsTitle')
                      : t('admin.registrationStatsTitle')
                }
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="btn-secondary px-3 py-2 text-sm"
                >
                  {t('admin.stats.prevMonth')}
                </button>
                <div className="px-4 py-2 rounded-full text-sm font-semibold bg-navy/5 dark:bg-cream/10 text-navy dark:text-cream">
                  {monthLabel}
                </div>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="btn-secondary px-3 py-2 text-sm"
                >
                  {t('admin.stats.nextMonth')}
                </button>
              </div>
            </div>
          )}

          {activeView === 'events' && (
            <SortableDataTable
              columns={eventColumns}
              rows={eventRows}
              sort={sortByView.events}
              onSort={(key) => toggleSort('events', key)}
              rowKey={(row) => row.event_id}
              emptyText={t('admin.stats.empty')}
              t={t}
            />
          )}

          {activeView === 'users' && (
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-navy dark:text-cream">
                {t('admin.userStatsTitle')}
              </h2>
              <SortableDataTable
                columns={userColumns}
                rows={userRows}
                sort={sortByView.users}
                onSort={(key) => toggleSort('users', key)}
                rowKey={(row) => row.user_id}
                emptyText={t('admin.stats.empty')}
                t={t}
              />
            </section>
          )}

          {activeView === 'payments' && (
            <SortableDataTable
              columns={paymentColumns}
              rows={paymentRows}
              sort={sortByView.payments}
              onSort={(key) => toggleSort('payments', key)}
              rowKey={(row) => row.status}
              emptyText={t('admin.stats.empty')}
              t={t}
            />
          )}

          {activeView === 'registrations' && (
            <SortableDataTable
              columns={registrationColumns}
              rows={registrationRows}
              sort={sortByView.registrations}
              onSort={(key) => toggleSort('registrations', key)}
              rowKey={(row) => row.event_id}
              emptyText={t('admin.stats.empty')}
              t={t}
            />
          )}
        </>
      )}
    </div>
  )
}

export default AdminPayments
