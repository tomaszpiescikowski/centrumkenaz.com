import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { confirmManualPayment, fetchManualPaymentDetails } from '../../api/user'
import AuthGateCard from '../../components/ui/AuthGateCard'

function ManualPaymentPage() {
  const { registrationId } = useParams()
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

  const deadlineLabel = useMemo(() => {
    if (!details?.payment_deadline) return null
    const date = new Date(details.payment_deadline)
    if (Number.isNaN(date.getTime())) return details.payment_deadline
    return date.toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [details])

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    if (!registrationId) {
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
        const payload = await fetchManualPaymentDetails(authFetch, registrationId)
        if (!cancelled) {
          setDetails(payload)
        }
      } catch (err) {
        if (!cancelled) {
          setDetails(null)
          showError(err.message || t('manualPayment.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authFetch, isAuthenticated, navigate, registrationId, showError, t, user?.account_status])

  const copyReference = async () => {
    if (!details?.transfer_reference) return
    try {
      await navigator.clipboard.writeText(details.transfer_reference)
      showSuccess(t('manualPayment.copySuccess'))
    } catch (_err) {
      showError(t('manualPayment.copyError'))
    }
  }

  const handleConfirm = async () => {
    if (!canConfirm || !registrationId) return
    try {
      setConfirming(true)
      const payload = await confirmManualPayment(authFetch, registrationId)
      setDetails(payload)
      showSuccess(t('manualPayment.confirmSuccess'))
    } catch (err) {
      showError(err.message || t('manualPayment.confirmError'))
    } finally {
      setConfirming(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('manualPayment.title')}
        message={t('manualPayment.loginRequired')}
        actionLabel={t('manualPayment.loginButton')}
        onAction={() => login({ returnTo: `/manual-payment/${registrationId}` })}
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
            {t('manualPayment.notFoundTitle')}
          </h1>
          <p className="mb-6 text-navy/70 dark:text-cream/70">
            {t('manualPayment.notFoundBody')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell max-w-3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-navy dark:text-cream">
          {t('manualPayment.title')}
        </h1>
        <p className="text-navy/70 dark:text-cream/70">
          {t('manualPayment.subtitle')}
        </p>
      </div>

      <div className="space-y-4">
        {details.promoted_from_waitlist && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-100/70 p-4 text-sm text-amber-900 dark:border-amber-300/40 dark:bg-amber-900/30 dark:text-amber-100">
            <p className="font-semibold">{t('manualPayment.promotedNoticeTitle')}</p>
            <p>{t('manualPayment.promotedNoticeBody')}</p>
          </div>
        )}

        <section className="rounded-2xl border border-navy/10 bg-cream/70 p-5 dark:border-cream/10 dark:bg-navy/70">
          <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
            {t('manualPayment.eventLabel')}
          </p>
          <p className="text-xl font-bold text-navy dark:text-cream">{details.event_title}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-navy/80 dark:text-cream/80">
            <span>{t('manualPayment.amountLabel')}: {details.amount} {details.currency}</span>
            {deadlineLabel && <span>{t('manualPayment.deadlineLabel')}: {deadlineLabel}</span>}
          </div>
        </section>

        <section className="rounded-2xl border border-navy/10 bg-cream/70 p-5 dark:border-cream/10 dark:bg-navy/70">
          <p className="text-sm text-navy/80 dark:text-cream/80">{t('manualPayment.stepsIntro')}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-navy dark:text-cream">
            <li>
              {t('manualPayment.stepOpenTransfer')}{' '}
              {details.manual_payment_url ? (
                <a
                  href={details.manual_payment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  {t('manualPayment.openTransferLink')}
                </a>
              ) : (
                <span className="font-semibold">{t('manualPayment.missingTransferLink')}</span>
              )}
            </li>
            <li>{t('manualPayment.stepPasteReference')}</li>
            <li>{t('manualPayment.stepConfirm')}</li>
          </ol>

          <div className="mt-4 rounded-xl border border-dashed border-navy/30 bg-cream/80 p-3 dark:border-cream/30 dark:bg-navy/80">
            <p className="mb-1 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
              {t('manualPayment.referenceLabel')}
            </p>
            <code className="break-all text-sm font-semibold text-navy dark:text-cream">{details.transfer_reference}</code>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyReference}
              className="btn-secondary px-4 py-2 text-sm"
            >
              {t('manualPayment.copyButton')}
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
              {confirming ? t('manualPayment.confirming') : t('manualPayment.confirmButton')}
            </button>
          </div>
        </section>

        {isPendingVerification && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-100/60 p-4 text-sm text-blue-900 dark:border-blue-300/40 dark:bg-blue-900/30 dark:text-blue-100">
            {t('manualPayment.waitingVerification')}
          </div>
        )}
        {isPaid && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-100/60 p-4 text-sm text-emerald-900 dark:border-emerald-300/40 dark:bg-emerald-900/30 dark:text-emerald-100">
            {t('manualPayment.alreadyPaid')}
          </div>
        )}

      </div>
    </div>
  )
}

export default ManualPaymentPage
