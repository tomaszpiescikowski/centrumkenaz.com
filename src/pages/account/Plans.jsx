import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { fetchSubscriptionPlans, startSubscriptionCheckout, switchToFreePlan } from '../../api/user'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'

const PLAN_ORDER = ['free', 'pro', 'ultimate']

function formatAmount(amount, currency, t) {
  const numeric = Number(amount)
  if (Number.isNaN(numeric) || numeric <= 0) {
    return t('common.free')
  }
  const price = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2)
  return `${price} ${currency}`
}

function formatDateLabel(dateValue, currentLanguage) {
  if (!dateValue) return null
  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return null
  const locale = currentLanguage === 'pl' ? 'pl-PL' : 'en-GB'
  return parsed.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/* ── Welcome modal (shown after admin approval via ?welcome=1) ── */
function WelcomeModal({ t, onChoosePlan, onBackToAccount }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className={
          'flex w-[calc(100%-2rem)] max-w-[420px] flex-col rounded-2xl border border-navy/10 bg-cream p-8 text-center dark:border-cream/15 dark:bg-navy ' +
          'max-sm:h-[100dvh] max-sm:max-w-full max-sm:justify-between max-sm:rounded-none'
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            ✓
          </span>
          <h2 className="text-2xl font-black text-navy dark:text-cream">
            {t('plans.welcomeModalTitle')}
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-navy/70 dark:text-cream/70">
            {t('plans.welcomeModalBody')}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onChoosePlan}
            className="btn-accent inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold"
          >
            {t('plans.welcomeModalChoosePlan')}
            <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            onClick={onBackToAccount}
            className="btn-secondary inline-flex h-11 items-center justify-center rounded-2xl text-sm font-semibold"
          >
            {t('plans.welcomeModalBackToAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Plans() {
  const { t, currentLanguage } = useLanguage()
  const { user, isAuthenticated, authFetch, fetchUser, accessToken } = useAuth()
  const { showError, showInfo, showSuccess } = useNotification()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlanCode, setSelectedPlanCode] = useState('free')
  const [processingPlanCode, setProcessingPlanCode] = useState(null)
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get('welcome') === '1')

  const hasActiveSubscription = useMemo(() => {
    if (!user?.subscription_end_date) return false
    return new Date(user.subscription_end_date) >= new Date()
  }, [user])

  const currentPlanCode = hasActiveSubscription
    ? (user?.subscription_plan_code || 'pro')
    : 'free'

  useEffect(() => {
    const paymentStatus = searchParams.get('payment')
    if (!paymentStatus) return

    if (paymentStatus === 'success') {
      showSuccess(t('plans.paymentSuccessBody'), { title: t('plans.paymentSuccessTitle') })
      if (accessToken) {
        fetchUser(accessToken).catch(() => {})
      }
    } else if (paymentStatus === 'cancelled') {
      showInfo(t('plans.paymentCancelled'))
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('payment')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams, showSuccess, showInfo, t, fetchUser, accessToken])

  useEffect(() => {
    let cancelled = false

    const loadPlans = async () => {
      setLoading(true)
      try {
        const data = await fetchSubscriptionPlans(authFetch)
        if (cancelled) return
        setPlans(data)
        const defaultPlan = data.find((plan) => plan.is_default) || data.find((plan) => plan.code === 'free')
        const currentPlan = data.find((plan) => plan.code === currentPlanCode)
        setSelectedPlanCode(currentPlan?.code || defaultPlan?.code || 'free')
      } catch (_error) {
        if (!cancelled) {
          setPlans([])
          showError(t('plans.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPlans()
    return () => {
      cancelled = true
    }
  }, [authFetch, showError, t])

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (user?.account_status !== 'active') {
    return <Navigate to="/pending-approval" replace />
  }

  const activeUntilLabel = formatDateLabel(user?.subscription_end_date, currentLanguage)
  const cards = PLAN_ORDER.map((code) => plans.find((plan) => plan.code === code)).filter(Boolean)
  const activePlanMessage = activeUntilLabel
    ? t('plans.subscriptionActiveUntil', { date: activeUntilLabel })
    : t('plans.subscriptionInactive')

  const handleDismissWelcome = () => {
    setShowWelcome(false)
    window.history.replaceState(null, '', '/plans')
  }

  const handleCheckout = async (planCode) => {
    const plan = plans.find((item) => item.code === planCode)
    if (!plan) return

    setProcessingPlanCode(planCode)
    try {
      if (planCode === 'free') {
        await switchToFreePlan(authFetch)
        showSuccess(t('plans.switchedToFree'))
        if (accessToken) {
          await fetchUser(accessToken)
        }
        return
      }

      if (!plan.is_purchasable) return
      const basePath = `${window.location.origin}/plans`
      const payload = {
        plan_code: planCode,
        return_url: `${basePath}?payment=success`,
        cancel_url: `${basePath}?payment=cancelled`,
      }
      const data = await startSubscriptionCheckout(authFetch, payload)
      if (data.redirect_url && data.status !== 'completed') {
        window.location.href = data.redirect_url
        return
      }
      showSuccess(t('plans.paymentSuccessBody'), { title: t('plans.paymentSuccessTitle') })
      if (accessToken) {
        await fetchUser(accessToken)
      }
    } catch (error) {
      const message = error?.message || ''
      if (message.toLowerCase().includes('pending admin approval')) {
        showError(t('plans.pendingApproval'))
      } else {
        showError(t('plans.checkoutError'))
      }
    } finally {
      setProcessingPlanCode(null)
    }
  }

  const renderCtaButton = (plan) => {
    const code = plan.code
    const isCurrentPlan = currentPlanCode === code
    const isPurchasable = plan.is_purchasable
    const isProcessing = processingPlanCode === code
    const title = t(`plans.plan.${code}.title`)

    if (code === 'free') {
      if (isCurrentPlan) {
        return (
          <button
            type="button"
            disabled
            className="inline-flex h-11 w-full cursor-default items-center justify-center rounded-2xl border border-navy/25 bg-transparent px-4 text-sm font-bold text-navy opacity-50 dark:border-cream/30 dark:text-cream"
            style={{ pointerEvents: 'none' }}
            aria-label={t('plans.plan.free.ctaCurrent')}
          >
            {t('plans.plan.free.ctaCurrent')}
          </button>
        )
      }
      return (
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => handleCheckout('free')}
          className={`inline-flex h-11 w-full items-center justify-center rounded-2xl border border-navy/45 bg-transparent px-4 text-sm font-bold text-navy transition dark:border-cream/45 dark:text-cream ${isProcessing ? 'cursor-not-allowed opacity-60' : ''}`}
          aria-label={t('plans.plan.free.ctaSwitch')}
        >
          {isProcessing ? t('plans.processing') : t('plans.plan.free.ctaSwitch')}
        </button>
      )
    }

    const ctaKey = `plans.plan.${code}.cta`
    const ariaKey = `plans.plan.${code}.ctaAriaLabel`

    if (isCurrentPlan) {
      return (
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-2xl border border-navy/30 bg-navy/30 px-4 text-sm font-bold text-cream/50 dark:border-cream/30 dark:bg-cream/20 dark:text-cream/40"
        >
          {t('plans.currentPlanCta')}
        </button>
      )
    }

    if (!isPurchasable && code !== 'free') {
      return (
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-navy/20 bg-navy/5 px-4 text-sm font-semibold text-navy/65 dark:border-cream/25 dark:bg-cream/10 dark:text-cream/65"
        >
          {t('plans.freePlanCta')}
        </button>
      )
    }

    return (
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => handleCheckout(code)}
        className={
          `inline-flex h-11 w-full items-center justify-center rounded-2xl border px-4 text-sm font-bold transition ` +
          'border-navy/45 bg-transparent text-navy dark:border-cream/45 dark:text-cream' +
          (isProcessing ? ' cursor-not-allowed opacity-60' : '')
        }
        aria-label={t(ariaKey)}
      >
        {isProcessing ? t('plans.processing') : t(ctaKey)}
      </button>
    )
  }

  return (
    <>
      {showWelcome && (
        <WelcomeModal
          t={t}
          onChoosePlan={handleDismissWelcome}
          onBackToAccount={() => navigate('/me')}
        />
      )}

      <div className="page-shell flex h-full min-h-0 flex-col pt-2">
        <div className="shrink-0">
          <Link
            to="/me"
            className="inline-flex items-center gap-2 text-sm font-semibold text-navy/70 hover:text-navy dark:text-cream/70 dark:hover:text-cream"
          >
            <span aria-hidden="true">←</span>
            <span>{t('plans.backToAccount')}</span>
          </Link>
          <h1 className="mt-3 text-3xl font-black text-navy dark:text-cream md:text-4xl">
            {t('plans.title')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-navy/70 dark:text-cream/70 md:text-base">
            {t('plans.subtitle')}
          </p>

          {activeUntilLabel ? (
            <p className="mt-3 text-sm font-semibold text-navy/75 dark:text-cream/75">
              {activePlanMessage}
            </p>
          ) : (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-3 py-1 text-xs font-medium text-navy/60 dark:border-cream/20 dark:text-cream/60">
              {activePlanMessage}
            </span>
          )}
        </div>

        {loading ? (
          <p className="mt-6 text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
        ) : (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pb-2">
            <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-stretch md:py-4">
              {cards.map((plan) => {
                const code = plan.code
                const isCurrentPlan = currentPlanCode === code
                const featureRows = t(`plans.plan.${code}.features`)
                const title = t(`plans.plan.${code}.title`)
                const summary = t(`plans.plan.${code}.summary`)
                const isFree = code === 'free'

                return (
                  <article
                    key={code}
                    className={
                      'relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all ' +
                      (isCurrentPlan
                        ? 'border-2 border-emerald-500 dark:border-emerald-400'
                        : 'border-navy/15 dark:border-cream/20')
                    }
                  >
                    {/* Header section — fixed min-height so features align across cards */}
                    <div className="relative z-10 min-h-[200px] text-left">
                      <p className="text-sm font-semibold text-navy/70 dark:text-cream/70">
                        {summary}
                      </p>
                      <h2 className="mt-1 text-[2rem] font-black leading-tight text-navy dark:text-cream">
                        {title}
                      </h2>

                      {/* Price */}
                      {isFree ? (
                        <div className="mt-3">
                          <span className="inline-block rounded-full border border-navy/20 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-navy dark:border-cream/25 dark:text-cream">
                            {t('plans.freeBadge')}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <div className="flex items-end gap-2">
                            <p className="text-4xl font-black text-navy dark:text-cream">
                              {formatAmount(plan.amount, plan.currency, t)}
                            </p>
                            <span className="pb-1 text-xs uppercase tracking-wide text-navy/55 dark:text-cream/55">
                              {code === 'ultimate' ? t('plans.yearlyLabel') : t('plans.monthlyLabel')}
                            </span>
                          </div>
                          {code === 'ultimate' && (
                            <p className="mt-1 text-[0.85rem] font-normal text-navy/60 dark:text-cream/60">
                              {t('plans.yearlyEquivalent')}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-4 h-px bg-navy/10 dark:bg-cream/20" />
                    </div>

                    {/* Features */}
                    <div className="relative z-10 mt-4 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-navy/55 dark:text-cream/55">
                        {t('plans.includes')}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {Array.isArray(featureRows) && featureRows.map((feature) => (
                          <li key={`${code}-${feature}`} className="flex items-start gap-2 text-sm text-navy/85 dark:text-cream/85">
                            <span className="mt-0.5 text-emerald-600 dark:text-emerald-300">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA */}
                    <div className="relative z-10 mt-6">
                      {renderCtaButton(plan)}
                    </div>
                  </article>
                )
              })}
            </div>

            {/* Trust / payment info bar */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-navy/50 dark:text-cream/50">
              <span className="inline-flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                {t('plans.securePayment')}
              </span>
              <span aria-hidden="true" className="text-navy/20 dark:text-cream/20">·</span>
              <span>Blik</span>
              <span aria-hidden="true" className="text-navy/20 dark:text-cream/20">·</span>
              <span>Visa</span>
              <span aria-hidden="true" className="text-navy/20 dark:text-cream/20">·</span>
              <span>Mastercard</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default Plans
