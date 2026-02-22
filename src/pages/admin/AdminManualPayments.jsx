import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import {
  approveManualPayment,
  approveSubscriptionPurchase,
  fetchManualRefundTasks,
  fetchPendingManualPayments,
  fetchPendingSubscriptionPurchases,
  fetchWaitlistPromotions,
  updateManualRefundTask,
  updateWaitlistPromotion,
} from '../../api/admin'
import SortableDataTable from '../../components/ui/SortableDataTable'
import ViewCard from '../../components/ui/ViewCard'
import AuthGateCard from '../../components/ui/AuthGateCard'
import ConfirmActionModal from '../../components/ui/ConfirmActionModal'
import usePreserveScrollSearchSwitch from '../../hooks/usePreserveScrollSearchSwitch'
import useViewSorts from '../../hooks/useViewSorts'
import { parseAmount } from '../../utils/numberFormat'

/* ────────────── constants ────────────── */

const ALLOWED_VIEWS = ['pending', 'refunds', 'promotions', 'subscriptions']
const createDefaultSorts = () => ({
  pending: [],
  refunds: [],
  promotions: [],
  subscriptions: [],
})

/**
 * Recommendation code enum – mirrors backend RefundRecommendationCode.
 * Each code maps to a badge colour and tooltip translation key.
 */
const RECOMMENDATION_CODES = {
  REFUND_CANCELLED_BEFORE_CUTOFF: { color: 'emerald', icon: '✓', shouldRefund: true },
  NO_REFUND_CANCELLED_AFTER_CUTOFF: { color: 'red', icon: '✗', shouldRefund: false },
  NO_REFUND_NO_PAYMENT: { color: 'slate', icon: '—', shouldRefund: false },
  REFUND_ADMIN_OVERRIDE: { color: 'amber', icon: '⚙', shouldRefund: true },
  NO_REFUND_ADMIN_OVERRIDE: { color: 'amber', icon: '⚙', shouldRefund: false },
  REFUND_COMPLETED: { color: 'blue', icon: '✓✓', shouldRefund: true },
}

/* ────────────── small presentational helpers ────────────── */

function RecommendationBadge({ code, t }) {
  const meta = RECOMMENDATION_CODES[code]
  if (!meta) return <span className="text-xs text-navy/50 dark:text-cream/50">—</span>

  const colorMap = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
    red: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
    slate: 'bg-navy/5 text-navy/60 border-navy/15 dark:bg-cream/5 dark:text-cream/60 dark:border-cream/15',
    amber: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
    blue: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  }

  const label = t(`admin.manualPayments.recCode.${code}`)
  const tooltip = t(`admin.manualPayments.recTooltip.${code}`)

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-tight cursor-help whitespace-nowrap ${colorMap[meta.color] || colorMap.slate}`}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {label}
    </span>
  )
}

function RefundDecisionSelect({ value, onChange, disabled, t }) {
  return (
    <select
      value={value ? 'refund' : 'no_refund'}
      onChange={(e) => onChange(e.target.value === 'refund')}
      disabled={disabled}
      className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
        disabled
          ? 'cursor-not-allowed bg-navy/5 text-navy/40 border-navy/10 dark:bg-cream/5 dark:text-cream/40 dark:border-cream/10'
          : 'bg-cream/70 text-navy border-navy/20 dark:bg-navy/70 dark:text-cream dark:border-cream/20'
      }`}
    >
      <option value="refund">{t('admin.manualPayments.decisionRefund')}</option>
      <option value="no_refund">{t('admin.manualPayments.decisionNoRefund')}</option>
    </select>
  )
}

function LegendPanel({ t }) {
  const items = Object.keys(RECOMMENDATION_CODES)
  return (
    <details className="page-subcard text-xs" data-no-hover="true">
      <summary className="cursor-pointer font-semibold text-navy dark:text-cream select-none">
        {t('admin.manualPayments.legendTitle')}
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((code) => (
          <div
            key={code}
            className="flex flex-col gap-1.5 rounded-xl border border-navy/10 dark:border-cream/10 bg-[rgba(255,251,235,0.82)] dark:bg-[rgba(15,23,74,0.68)] p-2.5 overflow-hidden"
          >
            <RecommendationBadge code={code} t={t} />
            <span className="text-[11px] text-navy/70 dark:text-cream/70 leading-snug">
              {t(`admin.manualPayments.recTooltip.${code}`)}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

/* ────────────── main component ────────────── */

function AdminManualPayments() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const { sortByView, toggleSort } = useViewSorts(createDefaultSorts)
  /* ── data ── */
  const [pendingPayments, setPendingPayments] = useState([])
  const [refundTasks, setRefundTasks] = useState([])
  const [promotionTasks, setPromotionTasks] = useState([])
  const [subscriptionPurchases, setSubscriptionPurchases] = useState([])

  /* ── loading states ── */
  const [approvingId, setApprovingId] = useState(null)
  const [savingRefundId, setSavingRefundId] = useState(null)
  const [savingPromotionId, setSavingPromotionId] = useState(null)
  const [approvingSubId, setApprovingSubId] = useState(null)

  /* ── refund draft edits ── */
  const [refundDrafts, setRefundDrafts] = useState({})

  /* ── confirmation modal ── */
  const [confirmModal, setConfirmModal] = useState(null)

  const isAdmin = user?.role === 'admin'
  const requestedView = searchParams.get('view')
  const activeView = ALLOWED_VIEWS.includes(requestedView) ? requestedView : null
  const switchView = usePreserveScrollSearchSwitch(setSearchParams, 'view')

  const loadData = async () => {
    setLoading(true)
    try {
      const [pending, refunds, promotions, subPurchases] = await Promise.all([
        fetchPendingManualPayments(authFetch),
        fetchManualRefundTasks(authFetch),
        fetchWaitlistPromotions(authFetch),
        fetchPendingSubscriptionPurchases(authFetch),
      ])
      setPendingPayments(Array.isArray(pending) ? pending : [])
      setRefundTasks(Array.isArray(refunds) ? refunds : [])
      setPromotionTasks(Array.isArray(promotions) ? promotions : [])
      setSubscriptionPurchases(Array.isArray(subPurchases) ? subPurchases : [])
      const drafts = {}
      for (const row of (Array.isArray(refunds) ? refunds : [])) {
        drafts[row.task_id] = {
          should_refund: Boolean(row.should_refund),
          refund_marked_paid: Boolean(row.refund_marked_paid),
          override_reason: row.override_reason || '',
        }
      }
      setRefundDrafts(drafts)
    } catch (err) {
      showError(err.message || t('admin.manualPayments.loadError'))
      setPendingPayments([])
      setRefundTasks([])
      setPromotionTasks([])
      setSubscriptionPurchases([])
      setRefundDrafts({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (requestedView && !ALLOWED_VIEWS.includes(requestedView)) {
      setSearchParams({ view: 'pending' }, { replace: true })
    }
  }, [requestedView, setSearchParams])

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      setLoading(false)
      return
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin, authFetch])

  /* ── helpers ── */
  const openConfirm = (opts) => setConfirmModal(opts)
  const closeConfirm = () => setConfirmModal(null)

  const refundSummary = useMemo(() => {
    const total = refundTasks.length
    const toRefund = refundTasks.filter((r) => r.should_refund && !r.refund_marked_paid).length
    const refunded = refundTasks.filter((r) => r.refund_marked_paid).length
    const resolved = refundTasks.filter((r) => r.is_resolved).length
    return { total, toRefund, refunded, resolved }
  }, [refundTasks])

  const handleApprove = async (registrationId) => {
    try {
      setApprovingId(registrationId)
      await approveManualPayment(authFetch, registrationId)
      showSuccess(t('admin.manualPayments.approveSuccess'))
      await loadData()
    } catch (err) {
      showError(err.message || t('admin.manualPayments.approveError'))
    } finally {
      setApprovingId(null)
      closeConfirm()
    }
  }

  const updateRefundDraft = (taskId, patch) => {
    setRefundDrafts((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), ...patch },
    }))
  }

  /* ────────────── action handlers with confirmation ────────────── */

  const requestApprovePayment = (row) => {
    openConfirm({
      title: t('admin.manualPayments.confirmApproveTitle'),
      description: t('admin.manualPayments.confirmApproveDesc'),
      details: [
        { label: t('admin.tables.user'), value: row.user_name || row.user_email },
        { label: t('admin.tables.event'), value: row.event_title },
        { label: t('admin.tables.amount'), value: `${row.amount} ${row.currency}` },
        { label: t('admin.manualPayments.referenceColumn'), value: row.transfer_reference },
      ],
      variant: 'default',
      onConfirm: () => handleApprove(row.registration_id),
    })
  }

  const requestApproveSubscription = (row) => {
    openConfirm({
      title: t('admin.manualPayments.confirmSubApproveTitle'),
      description: t('admin.manualPayments.confirmSubApproveDesc'),
      details: [
        { label: t('admin.tables.user'), value: row.user_name || row.user_email },
        { label: t('admin.manualPayments.subscriptionPlanColumn'), value: row.plan_label || row.plan_code },
        { label: t('admin.tables.amount'), value: `${row.total_amount} ${row.currency}` },
      ],
      variant: 'default',
      onConfirm: () => handleApproveSubscription(row.purchase_id),
    })
  }

  const handleApproveSubscription = async (purchaseId) => {
    try {
      setApprovingSubId(purchaseId)
      await approveSubscriptionPurchase(authFetch, purchaseId)
      showSuccess(t('admin.manualPayments.subscriptionApproveSuccess'))
      await loadData()
    } catch (err) {
      showError(err.message || t('admin.manualPayments.subscriptionApproveError'))
    } finally {
      setApprovingSubId(null)
      closeConfirm()
    }
  }

  const requestSaveRefund = (row) => {
    const draft = refundDrafts[row.task_id] || {
      should_refund: row.should_refund,
      refund_marked_paid: row.refund_marked_paid,
      override_reason: row.override_reason || '',
    }
    const changedFromRecommendation = draft.should_refund !== Boolean(row.recommended_should_refund)
    if (changedFromRecommendation && (draft.override_reason || '').trim().length < 8) {
      showError(t('admin.manualPayments.overrideReasonRequired'))
      return
    }

    const actionSummary = draft.refund_marked_paid
      ? t('admin.manualPayments.confirmRefundMarkPaid')
      : draft.should_refund
        ? t('admin.manualPayments.confirmRefundApprove')
        : t('admin.manualPayments.confirmRefundReject')

    openConfirm({
      title: t('admin.manualPayments.confirmRefundTitle'),
      description: actionSummary,
      details: [
        { label: t('admin.tables.user'), value: row.user_name || row.user_email },
        { label: t('admin.tables.event'), value: row.event_title },
        { label: t('admin.manualPayments.decisionLabel'), value: draft.should_refund ? t('admin.manualPayments.decisionRefund') : t('admin.manualPayments.decisionNoRefund') },
        ...(draft.refund_marked_paid ? [{ label: t('admin.manualPayments.refundedColumn'), value: '✓' }] : []),
        ...(draft.override_reason ? [{ label: t('admin.manualPayments.overrideReasonColumn'), value: draft.override_reason }] : []),
      ],
      variant: draft.refund_marked_paid ? 'warning' : 'default',
      onConfirm: () => handleSaveRefundTask(row),
    })
  }

  const handleSaveRefundTask = async (row) => {
    const draft = refundDrafts[row.task_id] || {
      should_refund: row.should_refund,
      refund_marked_paid: row.refund_marked_paid,
      override_reason: row.override_reason || '',
    }
    const changedFromRecommendation = draft.should_refund !== Boolean(row.recommended_should_refund)
    if (changedFromRecommendation && (draft.override_reason || '').trim().length < 8) {
      showError(t('admin.manualPayments.overrideReasonRequired'))
      return
    }

    try {
      setSavingRefundId(row.task_id)
      const updated = await updateManualRefundTask(authFetch, row.task_id, {
        should_refund: draft.should_refund,
        refund_marked_paid: draft.refund_marked_paid,
        override_reason: draft.override_reason.trim() || null,
      })
      setRefundTasks((prev) => prev.map((item) => (item.task_id === updated.task_id ? updated : item)))
      setRefundDrafts((prev) => ({
        ...prev,
        [updated.task_id]: {
          should_refund: Boolean(updated.should_refund),
          refund_marked_paid: Boolean(updated.refund_marked_paid),
          override_reason: updated.override_reason || '',
        },
      }))
      showSuccess(t('admin.manualPayments.refundSaveSuccess'))
    } catch (err) {
      showError(err.message || t('admin.manualPayments.refundSaveError'))
    } finally {
      setSavingRefundId(null)
      closeConfirm()
    }
  }

  const requestTogglePromotion = (row, checked) => {
    const desc = checked
      ? t('admin.manualPayments.confirmPromotionNotified')
      : t('admin.manualPayments.confirmPromotionUnmark')

    openConfirm({
      title: t('admin.manualPayments.confirmPromotionTitle'),
      description: desc,
      details: [
        { label: t('admin.tables.user'), value: row.user_name || row.user_email },
        { label: t('admin.tables.event'), value: row.event_title },
      ],
      variant: 'default',
      onConfirm: () => handleTogglePromotion(row.registration_id, checked),
    })
  }

  const handleTogglePromotion = async (registrationId, checked) => {
    try {
      setSavingPromotionId(registrationId)
      const updated = await updateWaitlistPromotion(authFetch, registrationId, {
        waitlist_notification_sent: checked,
      })
      setPromotionTasks((prev) => prev.map((item) => (
        item.registration_id === updated.registration_id ? updated : item
      )))
      showSuccess(t('admin.manualPayments.promotionSaveSuccess'))
    } catch (err) {
      showError(err.message || t('admin.manualPayments.promotionSaveError'))
    } finally {
      setSavingPromotionId(null)
      closeConfirm()
    }
  }

  const pendingRows = useMemo(
    () => pendingPayments.map((row) => ({
      ...row,
      user_sort: `${row.user_name || ''} ${row.user_email || ''}`,
      event_sort: `${row.event_title || ''} ${row.occurrence_date || ''}`,
      amount_value: parseAmount(row.amount),
      status_label: t(`account.statuses.${row.status}`),
    })),
    [pendingPayments, t]
  )

  const refundRows = useMemo(
    () => refundTasks.map((row) => {
      const draft = refundDrafts[row.task_id] || {
        should_refund: row.should_refund,
        refund_marked_paid: row.refund_marked_paid,
        override_reason: row.override_reason || '',
      }
      return {
        ...row,
        ...draft,
        user_sort: `${row.user_name || ''} ${row.user_email || ''}`,
        event_sort: `${row.event_title || ''} ${row.occurrence_date || ''}`,
      }
    }),
    [refundTasks, refundDrafts]
  )

  const activeRefundRows = useMemo(() => refundRows.filter((r) => !r.is_resolved), [refundRows])
  const resolvedRefundRows = useMemo(() => refundRows.filter((r) => r.is_resolved), [refundRows])

  const promotionRows = useMemo(
    () => promotionTasks.map((row) => ({
      ...row,
      user_sort: `${row.user_name || ''} ${row.user_email || ''}`,
      event_sort: `${row.event_title || ''} ${row.occurrence_date || ''}`,
      status_label: t(`account.statuses.${row.status}`),
      deadline_sort: row.payment_deadline || '',
    })),
    [promotionTasks, t]
  )

  const pendingColumns = [
    {
      key: 'user_sort',
      label: t('admin.tables.user'),
      sortValue: (row) => row.user_sort,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.user_name || '—'}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">{row.user_email}</p>
        </div>
      ),
    },
    {
      key: 'event_sort',
      label: t('admin.tables.event'),
      sortValue: (row) => row.event_sort,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.event_title}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">{row.occurrence_date}</p>
        </div>
      ),
    },
    {
      key: 'amount_value',
      label: t('admin.tables.amount'),
      sortValue: (row) => row.amount_value,
      render: (row) => <span>{row.amount} {row.currency}</span>,
    },
    {
      key: 'transfer_reference',
      label: t('admin.manualPayments.referenceColumn'),
      sortValue: (row) => row.transfer_reference,
      render: (row) => <code className="text-[11px]">{row.transfer_reference}</code>,
    },
    {
      key: 'status_label',
      label: t('account.status'),
      sortValue: (row) => row.status_label,
      render: (row) => <span>{row.status_label}</span>,
    },
    {
      key: 'actions',
      label: t('admin.manualPayments.actionsColumn'),
      align: 'right',
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={() => requestApprovePayment(row)}
          disabled={approvingId === row.registration_id}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            approvingId === row.registration_id
              ? 'cursor-not-allowed bg-navy/20 text-navy/50 dark:bg-cream/20 dark:text-cream/50'
              : 'btn-primary'
          }`}
        >
          {approvingId === row.registration_id
            ? t('admin.manualPayments.approving')
            : t('admin.manualPayments.approveButton')}
        </button>
      ),
    },
  ]

  const makeRefundColumns = (resolved) => [
    {
      key: 'user_sort',
      label: t('admin.tables.user'),
      sortValue: (row) => row.user_sort,
      render: (row) => (
        <div className={resolved ? 'opacity-50' : ''}>
          <p className="font-semibold">{row.user_name || '—'}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">{row.user_email}</p>
        </div>
      ),
    },
    {
      key: 'event_sort',
      label: t('admin.tables.event'),
      sortValue: (row) => row.event_sort,
      render: (row) => (
        <div className={resolved ? 'opacity-50' : ''}>
          <p className="font-semibold">{row.event_title}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">{row.occurrence_date}</p>
        </div>
      ),
    },
    {
      key: 'recommendation_code',
      label: t('admin.manualPayments.recommendedColumn'),
      sortValue: (row) => row.recommendation_code || '',
      render: (row) => <RecommendationBadge code={row.recommendation_code} t={t} />,
    },
    {
      key: 'should_refund',
      label: t('admin.manualPayments.decisionLabel'),
      sortValue: (row) => Number(Boolean(row.should_refund)),
      render: (row) =>
        resolved ? (
          <span className="text-xs font-semibold opacity-50">
            {row.should_refund
              ? t('admin.manualPayments.decisionRefund')
              : t('admin.manualPayments.decisionNoRefund')}
          </span>
        ) : (
          <RefundDecisionSelect
            value={row.should_refund}
            onChange={(val) => updateRefundDraft(row.task_id, { should_refund: val })}
            disabled={false}
            t={t}
          />
        ),
    },
    ...(resolved ? [] : [{
      key: 'refund_marked_paid',
      label: t('admin.manualPayments.refundedColumn'),
      sortValue: (row) => Number(Boolean(row.refund_marked_paid)),
      render: (row) => (
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={Boolean(row.refund_marked_paid)}
            onChange={(e) => updateRefundDraft(row.task_id, { refund_marked_paid: e.target.checked })}
            disabled={!row.should_refund}
          />
          <span className="text-xs">{t('admin.manualPayments.refundedLabel')}</span>
        </label>
      ),
    }]),
    ...(resolved ? [] : [{
      key: 'override_reason',
      label: t('admin.manualPayments.overrideReasonColumn'),
      sortValue: (row) => row.override_reason || '',
      render: (row) => {
        const requiresReason = row.should_refund !== Boolean(row.recommended_should_refund)
        return (
          <input
            type="text"
            className={`w-full rounded-lg border bg-cream/70 px-2 py-1 text-xs dark:bg-navy/70 ${
              requiresReason ? 'border-red-500 dark:border-red-400' : 'border-navy/20 dark:border-cream/20'
            }`}
            value={row.override_reason || ''}
            onChange={(e) => updateRefundDraft(row.task_id, { override_reason: e.target.value })}
            placeholder={requiresReason ? t('admin.manualPayments.overrideRequiredPlaceholder') : '—'}
          />
        )
      },
    }]),
    ...(resolved ? [{
      key: 'reviewed_at',
      label: t('admin.manualPayments.resolvedAtColumn'),
      sortValue: (row) => row.reviewed_at || '',
      render: (row) => <span className="text-xs opacity-50">{row.reviewed_at || '—'}</span>,
    }] : [{
      key: 'actions',
      label: t('admin.manualPayments.actionsColumn'),
      align: 'right',
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={() => requestSaveRefund(row)}
          disabled={savingRefundId === row.task_id}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            savingRefundId === row.task_id
              ? 'cursor-not-allowed bg-navy/20 text-navy/50 dark:bg-cream/20 dark:text-cream/50'
              : 'btn-primary'
          }`}
        >
          {savingRefundId === row.task_id
            ? t('admin.manualPayments.saving')
            : t('admin.manualPayments.saveButton')}
        </button>
      ),
    }]),
  ]

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeRefundColumns = useMemo(() => makeRefundColumns(false), [t, savingRefundId, refundDrafts])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolvedRefundColumns = useMemo(() => makeRefundColumns(true), [t])

  const promotionColumns = [
    {
      key: 'user_sort',
      label: t('admin.tables.user'),
      sortValue: (row) => row.user_sort,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.user_name || '—'}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">{row.user_email}</p>
        </div>
      ),
    },
    {
      key: 'event_sort',
      label: t('admin.tables.event'),
      sortValue: (row) => row.event_sort,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.event_title}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">{row.occurrence_date}</p>
        </div>
      ),
    },
    {
      key: 'status_label',
      label: t('account.status'),
      sortValue: (row) => row.status_label,
      render: (row) => <span>{row.status_label}</span>,
    },
    {
      key: 'deadline_sort',
      label: t('admin.manualPayments.deadlineColumn'),
      sortValue: (row) => row.deadline_sort,
      render: (row) => <span>{row.payment_deadline || '—'}</span>,
    },
    {
      key: 'notification',
      label: t('admin.manualPayments.notificationColumn'),
      align: 'right',
      sortValue: (row) => Number(Boolean(row.waitlist_notification_sent)),
      render: (row) => (
        <button
          type="button"
          onClick={() => requestTogglePromotion(row, !row.waitlist_notification_sent)}
          disabled={savingPromotionId === row.registration_id}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            row.waitlist_notification_sent
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
              : 'btn-primary'
          } ${savingPromotionId === row.registration_id ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {row.waitlist_notification_sent
            ? `✓ ${t('admin.manualPayments.notifiedLabel')}`
            : t('admin.manualPayments.markNotifiedButton')}
        </button>
      ),
    },
  ]

  const subscriptionRows = useMemo(
    () => subscriptionPurchases.map((row) => ({
      ...row,
      user_sort: `${row.user_name || ''} ${row.user_email || ''}`,
      amount_value: parseAmount(row.total_amount),
    })),
    [subscriptionPurchases]
  )

  const subscriptionColumns = [
    {
      key: 'user_sort',
      label: t('admin.tables.user'),
      sortValue: (row) => row.user_sort,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.user_name || '—'}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">{row.user_email}</p>
        </div>
      ),
    },
    {
      key: 'plan_code',
      label: t('admin.manualPayments.subscriptionPlanColumn'),
      sortValue: (row) => row.plan_code,
      render: (row) => (
        <div>
          <p className="font-semibold">{row.plan_label || row.plan_code}</p>
          <p className="text-[11px] text-navy/60 dark:text-cream/60">
            {row.periods} {row.periods === 1 ? t('admin.manualPayments.period') : t('admin.manualPayments.periods')}
          </p>
        </div>
      ),
    },
    {
      key: 'amount_value',
      label: t('admin.tables.amount'),
      sortValue: (row) => row.amount_value,
      render: (row) => <span>{row.total_amount} {row.currency}</span>,
    },
    {
      key: 'status',
      label: t('account.status'),
      sortValue: (row) => row.status,
      render: (row) => <span>{row.status}</span>,
    },
    {
      key: 'created_at',
      label: t('admin.manualPayments.createdColumn'),
      sortValue: (row) => row.created_at || '',
      render: (row) => <span>{row.created_at || '—'}</span>,
    },
    {
      key: 'actions',
      label: t('admin.manualPayments.actionsColumn'),
      align: 'right',
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={() => requestApproveSubscription(row)}
          disabled={approvingSubId === row.purchase_id}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            approvingSubId === row.purchase_id
              ? 'cursor-not-allowed bg-navy/20 text-navy/50 dark:bg-cream/20 dark:text-cream/50'
              : 'btn-primary'
          }`}
        >
          {approvingSubId === row.purchase_id
            ? t('admin.manualPayments.approving')
            : t('admin.manualPayments.approveButton')}
        </button>
      ),
    },
  ]

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.manualPayments.title')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/manual-payments' })}
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
        <h1 className="mt-3 text-2xl font-black text-navy dark:text-cream sm:text-3xl">
          {t('admin.manualPayments.title')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60">
          {t('admin.manualPayments.subtitle')}
        </p>
      </div>

      {loading ? (
        <p className="text-navy/70 dark:text-cream/70">{t('common.loading')}</p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ViewCard
              title={t('admin.manualPayments.pendingTitle')}
              description={t('admin.manualPayments.pendingSubtitle')}
              onClick={() => switchView('pending')}
              isActive={activeView === 'pending'}
            />
            <ViewCard
              title={t('admin.manualPayments.refundsTitle')}
              description={t('admin.manualPayments.refundsSubtitle')}
              onClick={() => switchView('refunds')}
              isActive={activeView === 'refunds'}
            />
            <ViewCard
              title={t('admin.manualPayments.promotionsTitle')}
              description={t('admin.manualPayments.promotionsSubtitle')}
              onClick={() => switchView('promotions')}
              isActive={activeView === 'promotions'}
            />
            <ViewCard
              title={t('admin.manualPayments.subscriptionsTitle')}
              description={t('admin.manualPayments.subscriptionsSubtitle')}
              onClick={() => switchView('subscriptions')}
              isActive={activeView === 'subscriptions'}
            />
          </section>

          {!activeView && (
            <div className="page-card text-center text-sm text-navy/70 dark:text-cream/70">
              {t('admin.statsCards.pickView')}
            </div>
          )}

          {activeView === 'pending' && (
            <SortableDataTable
              columns={pendingColumns}
              rows={pendingRows}
              sort={sortByView.pending}
              onSort={(key) => toggleSort('pending', key)}
              rowKey={(row) => row.registration_id}
              emptyText={t('admin.manualPayments.pendingEmpty')}
              t={t}
            />
          )}

          {activeView === 'refunds' && (
            <section className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-navy/60 dark:text-cream/60">
                <span>
                  {t('admin.manualPayments.refundsSummary')
                    .replace('{total}', String(refundSummary.total))
                    .replace('{to_refund}', String(refundSummary.toRefund))
                    .replace('{refunded}', String(refundSummary.refunded))}
                </span>
                {refundSummary.resolved > 0 && (
                  <span className="ml-auto font-medium text-navy/40 dark:text-cream/40">
                    {t('admin.manualPayments.resolvedCount', { count: refundSummary.resolved })
                      || `${refundSummary.resolved} resolved`}
                  </span>
                )}
              </div>

              {/* Legend */}
              <LegendPanel t={t} />

              {/* Active tasks */}
              {activeRefundRows.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-navy dark:text-cream mb-2">
                    {t('admin.manualPayments.activeTasksHeading') || 'Active tasks'}
                  </h3>
                  <SortableDataTable
                    columns={activeRefundColumns}
                    rows={activeRefundRows}
                    sort={sortByView.refunds}
                    onSort={(key) => toggleSort('refunds', key)}
                    rowKey={(row) => row.task_id}
                    emptyText={t('admin.manualPayments.refundsEmpty')}
                    t={t}
                  />
                </div>
              )}

              {/* Resolved tasks (collapsed) */}
              {resolvedRefundRows.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-semibold text-navy/50 dark:text-cream/50 hover:text-navy dark:hover:text-cream transition-colors select-none">
                    {t('admin.manualPayments.resolvedTasksHeading') || 'Resolved tasks'}
                    {' '}({resolvedRefundRows.length})
                  </summary>
                  <div className="mt-2 opacity-60">
                    <SortableDataTable
                      columns={resolvedRefundColumns}
                      rows={resolvedRefundRows}
                      sort={sortByView.refunds}
                      onSort={(key) => toggleSort('refunds', key)}
                      rowKey={(row) => row.task_id}
                      emptyText=""
                      t={t}
                    />
                  </div>
                </details>
              )}

              {activeRefundRows.length === 0 && resolvedRefundRows.length === 0 && (
                <p className="text-sm text-navy/40 dark:text-cream/40 text-center py-8">
                  {t('admin.manualPayments.refundsEmpty')}
                </p>
              )}
            </section>
          )}

          {activeView === 'promotions' && (
            <SortableDataTable
              columns={promotionColumns}
              rows={promotionRows}
              sort={sortByView.promotions}
              onSort={(key) => toggleSort('promotions', key)}
              rowKey={(row) => row.registration_id}
              emptyText={t('admin.manualPayments.promotionsEmpty')}
              t={t}
            />
          )}

          {activeView === 'subscriptions' && (
            <SortableDataTable
              columns={subscriptionColumns}
              rows={subscriptionRows}
              sort={sortByView.subscriptions}
              onSort={(key) => toggleSort('subscriptions', key)}
              rowKey={(row) => row.purchase_id}
              emptyText={t('admin.manualPayments.subscriptionsEmpty')}
              t={t}
            />
          )}
        </>
      )}

      <ConfirmActionModal
        open={Boolean(confirmModal)}
        title={confirmModal?.title || ''}
        description={confirmModal?.description || ''}
        details={confirmModal?.details}
        confirmLabel={confirmModal?.confirmLabel || t('admin.manualPayments.confirmButton')}
        cancelLabel={t('admin.manualPayments.cancelButton')}
        variant={confirmModal?.variant || 'default'}
        loading={approvingId != null || savingRefundId != null || savingPromotionId != null || approvingSubId != null}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        onCancel={closeConfirm}
      />
    </div>
  )
}

export default AdminManualPayments
