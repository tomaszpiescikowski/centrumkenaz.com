import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
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

function Plans() {
  const { t, currentLanguage } = useLanguage()
  const { user, isAuthenticated, authFetch, fetchUser, accessToken } = useAuth()
  const { showError, showInfo, showSuccess } = useNotification()
  const [searchParams, setSearchParams] = useSearchParams()

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlanCode, setSelectedPlanCode] = useState('free')
  const [processingPlanCode, setProcessingPlanCode] = useState(null)

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
      if (data.redirect_url) {
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

  return (
    <div className="page-shell flex h-full min-h-0 flex-col">
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
        <p className="mt-3 text-sm font-semibold text-navy/75 dark:text-cream/75">
          {activePlanMessage}
        </p>
      </div>

      {loading ? (
        <p className="mt-6 text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
      ) : (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto pb-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {cards.map((plan) => {
              const code = plan.code
              const isSelected = selectedPlanCode === code
              const isCurrentPlan = currentPlanCode === code
              const isPurchasable = plan.is_purchasable
              const isProcessing = processingPlanCode === code
              const featureRows = t(`plans.plan.${code}.features`)
              const title = t(`plans.plan.${code}.title`)
              const summary = t(`plans.plan.${code}.summary`)
              const monthlyLabel = t('plans.monthlyLabel')

              return (
                <article
                  key={code}
                  className={
                    `relative flex h-full flex-col overflow-hidden rounded-2xl border p-4 transition-all ` +
                    `${isSelected
                      ? 'border-navy/55 bg-transparent dark:border-cream/50 dark:bg-transparent'
                      : 'border-navy/15 bg-transparent dark:border-cream/20 dark:bg-transparent hover:border-navy/35 dark:hover:border-cream/40'
                    }`
                  }
                >
                  <div className="relative z-10 mb-3 flex min-h-6 flex-wrap justify-end gap-1">
                    {code === 'pro' && (
                      <span className="rounded-full border border-navy/30 bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-navy dark:border-cream/35 dark:text-cream">
                        {t('plans.mostPopular')}
                      </span>
                    )}
                    {isCurrentPlan && (
                      <span className="rounded-full border border-navy/30 bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-navy dark:border-cream/35 dark:text-cream">
                        {t('plans.currentPlan')}
                      </span>
                    )}
                  </div>
                  {code === 'pro' && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-20 -bottom-20 h-52 w-52 rounded-full bg-gradient-to-tr from-rose-400/50 via-lime-300/40 to-cyan-300/40 blur-2xl"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPlanCode(code)}
                    className="relative z-10 w-full text-left"
                    aria-pressed={isSelected}
                  >
                    <p className="text-sm font-semibold text-navy/70 dark:text-cream/70">
                      {summary}
                    </p>
                    <h2 className="mt-1 text-3xl font-black text-navy dark:text-cream">
                      {title}
                    </h2>
                    <div className="mt-2 flex items-end gap-2">
                      <p className="text-4xl font-black text-navy dark:text-cream">
                        {formatAmount(plan.amount, plan.currency, t)}
                      </p>
                      <span className="pb-1 text-xs uppercase tracking-wide text-navy/55 dark:text-cream/55">
                        {monthlyLabel}
                      </span>
                    </div>
                    <div className="mt-4 h-px bg-navy/10 dark:bg-cream/20" />
                  </button>

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

                  <div className="relative z-10 mt-6">
                    {isPurchasable || code === 'free' ? (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleCheckout(code)}
                        className={
                          `inline-flex h-11 w-full items-center justify-center rounded-2xl border px-4 text-sm font-bold transition ` +
                          `${isSelected
                            ? 'border-navy/45 bg-transparent text-navy dark:border-cream/45 dark:text-cream'
                            : 'border-navy/25 bg-transparent text-navy/80 dark:border-cream/30 dark:text-cream/85'
                          } ${isProcessing ? 'cursor-not-allowed opacity-60' : ''}`
                        }
                      >
                        {isProcessing
                          ? t('plans.processing')
                          : code === 'free'
                            ? (isCurrentPlan ? t('plans.freePlanCurrent') : t('plans.freePlanSwitch'))
                            : t('plans.buyPlan', { plan: title })}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-navy/20 bg-navy/5 px-4 text-sm font-semibold text-navy/65 dark:border-cream/25 dark:bg-cream/10 dark:text-cream/65"
                      >
                        {t('plans.freePlanCta')}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default Plans
