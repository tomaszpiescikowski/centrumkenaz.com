import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { confirmSubscriptionManualPayment, fetchSubscriptionPurchaseDetails } from '../../api/user'
import AuthGateCard from '../../components/ui/AuthGateCard'

function SubscriptionManualPaymentPage() {
  const { purchaseId } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [details, setDetails] = useState(null)

  const isPendingVerification = details?.status === 'manual_payment_verification'
  const isPaid = details?.status === 'confirmed'
  const canConfirm = Boolean(details?.can_confirm)

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    if (!purchaseId) {
      setLoading(false)
      setDetails(null)
      return
    }
    if (user?.account_status !== 'active') {
      navigate('/pending-approval', { replace: true })
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const payload = await fetchSubscriptionPurchaseDetails(authFetch, purchaseId)
        if (!cancelled) {
          setDetails(payload)
        }
      } catch (err) {
        if (!cancelled) {
          setDetails(null)
          showError(err.message || t('subscriptionManualPayment.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authFetch, isAuthenticated, navigate, purchaseId, showError, t, user?.account_status])

  const copyReference = async () => {
    if (!details?.transfer_reference) return
    try {
      await navigator.clipboard.writeText(details.transfer_reference)
      showSuccess(t('subscriptionManualPayment.copySuccess'))
    } catch (_err) {
      showError(t('subscriptionManualPayment.copyError'))
    }
  }

  const handleConfirm = async () => {
    if (!canConfirm || !purchaseId) return
    try {
      setConfirming(true)
      const payload = await confirmSubscriptionManualPayment(authFetch, purchaseId)
      setDetails(payload)
      showSuccess(t('subscriptionManualPayment.confirmSuccess'))
    } catch (err) {
      showError(err.message || t('subscriptionManualPayment.confirmError'))
    } finally {
      setConfirming(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('subscriptionManualPayment.title')}
        message={t('subscriptionManualPayment.loginRequired')}
        actionLabel={t('subscriptionManualPayment.loginButton')}
        onAction={() => login({ returnTo: `/subscription-purchases/${purchaseId}/manual-payment` })}
      />
    )
  }

  if (loading) {
    return (
      <div className="page-shell flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-navy/70 dark:text-cream/70">{t('common.loading')}</p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="page-shell">
        <div className="page-card">
          <h1 className="mb-2 text-2xl font-black text-navy dark:text-cream">
            {t('subscriptionManualPayment.notFoundTitle')}
          </h1>
          <p className="mb-6 text-navy/70 dark:text-cream/70">
            {t('subscriptionManualPayment.notFoundBody')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell max-w-3xl">
      <div className="mb-6">
        <Link
          to="/plans"
          className="inline-flex items-center gap-2 text-sm font-semibold text-navy/70 hover:text-navy dark:text-cream/70 dark:hover:text-cream"
        >
          <span aria-hidden="true">←</span>
          <span>{t('subscriptionManualPayment.backToPlans')}</span>
        </Link>
        <h1 className="mt-3 text-3xl font-black text-navy dark:text-cream">
          {t('subscriptionManualPayment.title')}
        </h1>
        <p className="text-navy/70 dark:text-cream/70">
          {t('subscriptionManualPayment.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-navy/10 bg-cream/70 p-5 dark:border-cream/10 dark:bg-navy/70">
          <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
            {t('subscriptionManualPayment.planLabel')}
          </p>
          <p className="text-xl font-bold text-navy dark:text-cream">{details.plan_label}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-navy/80 dark:text-cream/80">
            <span>{t('subscriptionManualPayment.periodsLabel')}: {details.periods}</span>
            <span>{t('subscriptionManualPayment.amountLabel')}: {details.total_amount} {details.currency}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-navy/10 bg-cream/70 p-5 dark:border-cream/10 dark:bg-navy/70">
          <p className="text-sm text-navy/80 dark:text-cream/80">{t('subscriptionManualPayment.stepsIntro')}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-navy dark:text-cream">
            <li>
              {t('subscriptionManualPayment.stepOpenTransfer')}{' '}
              {details.manual_payment_url ? (
                <a
                  href={details.manual_payment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  {t('subscriptionManualPayment.openTransferLink')}
                </a>
              ) : (
                <span className="font-semibold">{t('subscriptionManualPayment.missingTransferLink')}</span>
              )}
            </li>
            <li>{t('subscriptionManualPayment.stepPasteReference')}</li>
            <li>{t('subscriptionManualPayment.stepConfirm')}</li>
          </ol>

          <div className="mt-4 rounded-xl border border-dashed border-navy/30 bg-cream/80 p-3 dark:border-cream/30 dark:bg-navy/80">
            <p className="mb-1 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
              {t('subscriptionManualPayment.referenceLabel')}
            </p>
            <code className="break-all text-sm font-semibold text-navy dark:text-cream">{details.transfer_reference}</code>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyReference}
              className="btn-secondary px-4 py-2 text-sm"
            >
              {t('subscriptionManualPayment.copyButton')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || confirming || isPaid}
              className={`px-4 py-2 text-sm font-semibold rounded-full ${
                !canConfirm || confirming || isPaid
                  ? 'cursor-not-allowed bg-navy/20 text-navy/50 dark:bg-cream/20 dark:text-cream/50'
                  : 'btn-primary'
              }`}
            >
              {confirming ? t('subscriptionManualPayment.confirming') : t('subscriptionManualPayment.confirmButton')}
            </button>
          </div>
        </section>

        {isPendingVerification && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-100/60 p-4 text-sm text-blue-900 dark:border-blue-300/40 dark:bg-blue-900/30 dark:text-blue-100">
            {t('subscriptionManualPayment.waitingVerification')}
          </div>
        )}
        {isPaid && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-100/60 p-4 text-sm text-emerald-900 dark:border-emerald-300/40 dark:bg-emerald-900/30 dark:text-emerald-100">
            {t('subscriptionManualPayment.alreadyPaid')}
          </div>
        )}
      </div>
    </div>
  )
}

export default SubscriptionManualPaymentPage
