import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import {
  approveManualPayment,
  fetchManualRefundTasks,
  fetchPendingManualPayments,
  fetchWaitlistPromotions,
  updateManualRefundTask,
  updateWaitlistPromotion,
} from '../../api/admin'
import SortableDataTable from '../../components/ui/SortableDataTable'
import ViewCard from '../../components/ui/ViewCard'
import AuthGateCard from '../../components/ui/AuthGateCard'
import usePreserveScrollSearchSwitch from '../../hooks/usePreserveScrollSearchSwitch'
import useViewSorts from '../../hooks/useViewSorts'
import { parseAmount } from '../../utils/numberFormat'

const ALLOWED_VIEWS = ['pending', 'refunds', 'promotions']
const createDefaultSorts = () => ({
  pending: [],
  refunds: [],
  promotions: [],
})

function AdminManualPayments() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const { sortByView, toggleSort } = useViewSorts(createDefaultSorts)
  const [pendingPayments, setPendingPayments] = useState([])
  const [refundTasks, setRefundTasks] = useState([])
  const [promotionTasks, setPromotionTasks] = useState([])
  const [approvingId, setApprovingId] = useState(null)
  const [savingRefundId, setSavingRefundId] = useState(null)
  const [savingPromotionId, setSavingPromotionId] = useState(null)
  const [refundDrafts, setRefundDrafts] = useState({})

  const isAdmin = user?.role === 'admin'
  const requestedView = searchParams.get('view')
  const activeView = ALLOWED_VIEWS.includes(requestedView) ? requestedView : null
  const switchView = usePreserveScrollSearchSwitch(setSearchParams, 'view')

  const loadData = async () => {
    setLoading(true)
    try {
      const [pending, refunds, promotions] = await Promise.all([
        fetchPendingManualPayments(authFetch),
        fetchManualRefundTasks(authFetch),
        fetchWaitlistPromotions(authFetch),
      ])
      setPendingPayments(Array.isArray(pending) ? pending : [])
      setRefundTasks(Array.isArray(refunds) ? refunds : [])
      setPromotionTasks(Array.isArray(promotions) ? promotions : [])
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

  const refundSummary = useMemo(() => {
    const total = refundTasks.length
    const toRefund = refundTasks.filter((row) => row.should_refund).length
    const refunded = refundTasks.filter((row) => row.refund_marked_paid).length
    return { total, toRefund, refunded }
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
    }
  }

  const updateRefundDraft = (taskId, patch) => {
    setRefundDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        ...patch,
      },
    }))
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
    }
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
        recommended_label: row.recommended_should_refund
          ? t('admin.manualPayments.recommendRefund')
          : t('admin.manualPayments.recommendNoRefund'),
      }
    }),
    [refundTasks, refundDrafts, t]
  )

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
      render: (row) => <code>{row.transfer_reference}</code>,
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
          onClick={() => handleApprove(row.registration_id)}
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

  const refundColumns = [
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
      key: 'recommended_should_refund',
      label: t('admin.manualPayments.recommendedColumn'),
      sortValue: (row) => Number(Boolean(row.recommended_should_refund)),
      render: (row) => <span>{row.recommended_label}</span>,
    },
    {
      key: 'should_refund',
      label: t('admin.manualPayments.shouldRefundColumn'),
      sortValue: (row) => Number(Boolean(row.should_refund)),
      render: (row) => (
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(row.should_refund)}
            onChange={(e) => updateRefundDraft(row.task_id, { should_refund: e.target.checked })}
          />
          <span>{t('admin.manualPayments.shouldRefundLabel')}</span>
        </label>
      ),
    },
    {
      key: 'refund_marked_paid',
      label: t('admin.manualPayments.refundedColumn'),
      sortValue: (row) => Number(Boolean(row.refund_marked_paid)),
      render: (row) => (
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(row.refund_marked_paid)}
            onChange={(e) => updateRefundDraft(row.task_id, { refund_marked_paid: e.target.checked })}
            disabled={!row.should_refund}
          />
          <span>{t('admin.manualPayments.refundedLabel')}</span>
        </label>
      ),
    },
    {
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
    },
    {
      key: 'actions',
      label: t('admin.manualPayments.actionsColumn'),
      align: 'right',
      sortable: false,
      render: (row) => (
        <button
          type="button"
          onClick={() => handleSaveRefundTask(row)}
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
    },
  ]

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
        <label className="inline-flex items-center gap-2 text-navy dark:text-cream">
          <input
            type="checkbox"
            checked={Boolean(row.waitlist_notification_sent)}
            onChange={(e) => handleTogglePromotion(row.registration_id, e.target.checked)}
            disabled={savingPromotionId === row.registration_id}
          />
          <span>{t('admin.manualPayments.notifiedLabel')}</span>
        </label>
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
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            <section className="space-y-2">
              <p className="text-xs text-navy/60 dark:text-cream/60">
                {t('admin.manualPayments.refundsSummary')
                  .replace('{total}', String(refundSummary.total))
                  .replace('{to_refund}', String(refundSummary.toRefund))
                  .replace('{refunded}', String(refundSummary.refunded))}
              </p>
              <SortableDataTable
                columns={refundColumns}
                rows={refundRows}
                sort={sortByView.refunds}
                onSort={(key) => toggleSort('refunds', key)}
                rowKey={(row) => row.task_id}
                emptyText={t('admin.manualPayments.refundsEmpty')}
                t={t}
              />
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
        </>
      )}
    </div>
  )
}

export default AdminManualPayments
