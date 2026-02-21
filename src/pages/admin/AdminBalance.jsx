import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { fetchAdminBalance } from '../../api/admin'
import SortableDataTable from '../../components/ui/SortableDataTable'
import AuthGateCard from '../../components/ui/AuthGateCard'
import useViewSorts from '../../hooks/useViewSorts'
import { parseAmount, formatAmount } from '../../utils/numberFormat'

const PERIOD_TYPES = ['month', 'quarter', 'year']

function periodKey(type, cursor) {
  const y = cursor.getFullYear()
  const m = cursor.getMonth() + 1
  if (type === 'month') return `${y}-${String(m).padStart(2, '0')}`
  if (type === 'quarter') return `${y}-Q${Math.ceil(m / 3)}`
  return `${y}`
}

function periodLabel(type, cursor, t) {
  const y = cursor.getFullYear()
  const m = cursor.getMonth() + 1
  if (type === 'month') return `${y}-${String(m).padStart(2, '0')}`
  if (type === 'quarter') return `${y} Q${Math.ceil(m / 3)}`
  return `${y}`
}

function shiftCursor(type, cursor, delta) {
  const d = new Date(cursor)
  if (type === 'month') d.setMonth(d.getMonth() + delta)
  else if (type === 'quarter') d.setMonth(d.getMonth() + delta * 3)
  else d.setFullYear(d.getFullYear() + delta)
  return d
}

const createDefaultSorts = () => ({
  months: [],
  events: [],
  subscriptions: [],
})

function AdminBalance() {
  const { user, isAuthenticated, authFetch, login } = useAuth()
  const { t } = useLanguage()
  const { showError } = useNotification()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodType, setPeriodType] = useState('month')
  const [cursor, setCursor] = useState(() => new Date())
  const { sortByView, toggleSort } = useViewSorts(createDefaultSorts)

  const isAdmin = user?.role === 'admin'
  const currentPeriodKey = periodKey(periodType, cursor)
  const currentPeriodLabel = periodLabel(periodType, cursor, t)

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await fetchAdminBalance(authFetch, currentPeriodKey)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setData(null)
          showError(err.message || t('admin.balance.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authFetch, isAdmin, isAuthenticated, currentPeriodKey, t, showError])

  // ---- Column definitions ----

  const monthColumns = useMemo(() => [
    { key: 'month', label: t('admin.balance.colMonth'), sortable: true },
    { key: 'income_event', label: t('admin.balance.colIncomeEvent'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.income_event) },
    { key: 'income_subscription', label: t('admin.balance.colIncomeSub'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.income_subscription) },
    { key: 'income_total', label: t('admin.balance.colIncomeTotal'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.income_total) },
    { key: 'refunds', label: t('admin.balance.colRefunds'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.refunds) },
    { key: 'net', label: t('admin.balance.colNet'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.net) },
    { key: 'tx_count', label: t('admin.balance.colTxCount'), align: 'right', sortable: true },
  ], [t])

  const eventColumns = useMemo(() => [
    { key: 'title', label: t('admin.balance.colEventTitle'), sortable: true },
    { key: 'start_date', label: t('admin.balance.colDate'), sortable: true },
    { key: 'city', label: t('admin.balance.colCity'), sortable: true },
    { key: 'income', label: t('admin.balance.colIncome'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.income) },
    { key: 'refunds', label: t('admin.balance.colRefunds'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.refunds) },
    { key: 'net', label: t('admin.balance.colNet'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.net) },
    { key: 'tx_count', label: t('admin.balance.colTxCount'), align: 'right', sortable: true },
  ], [t])

  const subColumns = useMemo(() => [
    { key: 'plan_code', label: t('admin.balance.colPlan'), sortable: true },
    { key: 'income', label: t('admin.balance.colIncome'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.income) },
    { key: 'refunds', label: t('admin.balance.colRefunds'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.refunds) },
    { key: 'net', label: t('admin.balance.colNet'), align: 'right', sortable: true, sortValue: (r) => parseAmount(r.net) },
    { key: 'tx_count', label: t('admin.balance.colTxCount'), align: 'right', sortable: true },
    { key: 'refund_count', label: t('admin.balance.colRefundCount'), align: 'right', sortable: true },
  ], [t])

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.balance.title')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/balance' })}
      />
    )
  }

  if (!isAdmin) {
    return (
      <AuthGateCard
        title={t('admin.notAuthorizedTitle')}
        message={t('admin.notAuthorized')}
        actionLabel={t('common.backToCalendar')}
        actionTo="/calendar"
      />
    )
  }

  const netAmount = data ? parseAmount(data.total_net) : 0
  const netColor = netAmount >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'

  return (
    <div className="page-shell space-y-8">
      {/* Header */}
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70"
        >
          <span>←</span>
          {t('admin.backToDashboard')}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream mt-3">
          {t('admin.balance.title')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60">
          {t('admin.balance.subtitle')}
        </p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {PERIOD_TYPES.map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setPeriodType(pt)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                periodType === pt
                  ? 'bg-navy text-cream dark:bg-cream dark:text-navy'
                  : 'bg-navy/5 dark:bg-cream/10 text-navy dark:text-cream hover:bg-navy/10 dark:hover:bg-cream/20'
              }`}
            >
              {t(`admin.balance.period_${pt}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor((c) => shiftCursor(periodType, c, -1))}
            className="btn-secondary px-3 py-2 text-sm"
          >
            ←
          </button>
          <div className="px-4 py-2 rounded-full text-sm font-semibold bg-navy/5 dark:bg-cream/10 text-navy dark:text-cream min-w-[120px] text-center">
            {currentPeriodLabel}
          </div>
          <button
            type="button"
            onClick={() => setCursor((c) => shiftCursor(periodType, c, 1))}
            className="btn-secondary px-3 py-2 text-sm"
          >
            →
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
      ) : !data ? (
        <p className="text-navy/60 dark:text-cream/60">{t('admin.balance.loadError')}</p>
      ) : (
        <>
          {/* Summary cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label={t('admin.balance.totalIncome')} value={data.total_income} variant="income" />
            <SummaryCard label={t('admin.balance.incomeEvent')} value={data.total_income_event} />
            <SummaryCard label={t('admin.balance.incomeSub')} value={data.total_income_subscription} />
            <SummaryCard label={t('admin.balance.totalRefunds')} value={data.total_refunds} variant="refund" />
            <SummaryCard label={t('admin.balance.totalNet')} value={data.total_net} variant={netAmount >= 0 ? 'income' : 'refund'} />
            <SummaryCard label={t('admin.balance.txCount')} value={String(data.total_tx_count)} />
            <SummaryCard label={t('admin.balance.refundCount')} value={String(data.total_refund_count)} />
            <SummaryCard label={t('admin.balance.pendingTotal')} value={data.pending.pending_total} variant="pending" />
          </section>

          {/* Pending breakdown */}
          {(data.pending.pending_event_count > 0 || data.pending.pending_subscription_count > 0) && (
            <section className="page-card p-4 space-y-2">
              <h2 className="text-lg font-bold text-navy dark:text-cream">{t('admin.balance.pendingTitle')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-navy/60 dark:text-cream/60">{t('admin.balance.pendingEvent')}:</span>{' '}
                  <span className="font-semibold text-navy dark:text-cream">{data.pending.pending_event}</span>
                  <span className="text-navy/40 dark:text-cream/40 ml-1">({data.pending.pending_event_count})</span>
                </div>
                <div>
                  <span className="text-navy/60 dark:text-cream/60">{t('admin.balance.pendingSub')}:</span>{' '}
                  <span className="font-semibold text-navy dark:text-cream">{data.pending.pending_subscription}</span>
                  <span className="text-navy/40 dark:text-cream/40 ml-1">({data.pending.pending_subscription_count})</span>
                </div>
              </div>
            </section>
          )}

          {/* Monthly breakdown */}
          {data.months.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-navy dark:text-cream">{t('admin.balance.monthlyTitle')}</h2>
              <SortableDataTable
                columns={monthColumns}
                rows={data.months}
                sort={sortByView.months}
                onSort={(key) => toggleSort('months', key)}
                rowKey={(row) => row.month}
                emptyText={t('admin.balance.noData')}
                t={t}
              />
            </section>
          )}

          {/* Per-event breakdown */}
          {data.events.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-navy dark:text-cream">{t('admin.balance.eventsTitle')}</h2>
              <SortableDataTable
                columns={eventColumns}
                rows={data.events}
                sort={sortByView.events}
                onSort={(key) => toggleSort('events', key)}
                rowKey={(row) => row.event_id}
                emptyText={t('admin.balance.noData')}
                t={t}
              />
            </section>
          )}

          {/* Subscription plan breakdown */}
          {data.subscriptions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-navy dark:text-cream">{t('admin.balance.subscriptionsTitle')}</h2>
              <SortableDataTable
                columns={subColumns}
                rows={data.subscriptions}
                sort={sortByView.subscriptions}
                onSort={(key) => toggleSort('subscriptions', key)}
                rowKey={(row) => row.plan_code}
                emptyText={t('admin.balance.noData')}
                t={t}
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, variant }) {
  let borderClass = 'border-navy/10 dark:border-cream/10'
  let valueClass = 'text-navy dark:text-cream'
  if (variant === 'income') {
    borderClass = 'border-green-400/30 dark:border-green-500/30'
    valueClass = 'text-green-600 dark:text-green-400'
  } else if (variant === 'refund') {
    borderClass = 'border-red-400/30 dark:border-red-500/30'
    valueClass = 'text-red-600 dark:text-red-400'
  } else if (variant === 'pending') {
    borderClass = 'border-amber-400/30 dark:border-amber-500/30'
    valueClass = 'text-amber-600 dark:text-amber-400'
  }

  return (
    <div className={`page-card p-4 border ${borderClass} rounded-xl`}>
      <p className="text-xs text-navy/50 dark:text-cream/50 mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

export default AdminBalance
