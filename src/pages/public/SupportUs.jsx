import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { createDonation, fetchDonationSettings } from '../../api/donations'

/* ────────────────────────────── icons ────────────────────────────── */

function HeartIcon({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

/* ────────────────────────────── helpers ───────────────────────────── */

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  const { showError } = useNotification()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showError('Nie można skopiować')
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-navy/15 dark:border-cream/15 bg-navy/5 dark:bg-cream/5 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-navy/40 dark:text-cream/40">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-navy dark:text-cream break-all">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          copied
            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-navy/10 dark:bg-cream/10 text-navy/60 dark:text-cream/60 hover:bg-navy/20 dark:hover:bg-cream/20'
        }`}
        aria-label="Kopiuj"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  )
}

/* ────────────────────────────── main component ─────────────────────── */

function SupportUs() {
  const { user, isAuthenticated, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError } = useNotification()

  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)

  // Form state
  const [amount, setAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Success state
  const [donated, setDonated] = useState(null) // donation response object

  const isSubscriber = isAuthenticated && user?.account_status === 'active'

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchDonationSettings()
        if (!cancelled) setSettings(data)
      } catch (err) {
        if (!cancelled) showError(err.message || t('support.loadError'))
      } finally {
        if (!cancelled) setLoadingSettings(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [showError, t])

  const suggestedAmounts = settings?.suggested_amounts ?? [10, 20, 50, 100]
  const minAmount = settings?.min_amount ?? 5
  const pointsPerZloty = settings?.points_per_zloty ?? 1
  const isEnabled = settings?.is_enabled ?? true

  const numericAmount = parseFloat(amount) || 0
  const estimatedPoints = isSubscriber && numericAmount > 0
    ? Math.floor(numericAmount * pointsPerZloty)
    : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || numericAmount < minAmount) {
      showError(t('support.minAmountError', { min: minAmount }))
      return
    }
    try {
      setSubmitting(true)
      const payload = {
        amount: numericAmount,
        donor_name: donorName.trim() || null,
        donor_email: donorEmail.trim() || null,
      }
      const result = await createDonation(payload, isAuthenticated ? authFetch : null)
      setDonated(result)
    } catch (err) {
      showError(err.message || t('support.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  /* Disabled state */
  if (!loadingSettings && settings && !isEnabled) {
    return (
      <div className="page-shell">
        <div className="page-card text-center py-12">
          <HeartIcon className="h-12 w-12 mx-auto mb-4 text-navy/20 dark:text-cream/20" />
          <p className="text-navy/60 dark:text-cream/60">{t('support.disabled')}</p>
          <Link to="/" className="mt-6 hidden sm:inline-flex text-sm font-semibold text-navy dark:text-cream">
            ← {t('common.backToHome')}
          </Link>
        </div>
      </div>
    )
  }

  /* Success state */
  if (donated) {
    return (
      <div className="page-shell">
        <div className="mx-auto w-full max-w-lg">
          <div className="page-card text-center py-8 sm:py-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-navy dark:text-cream">{t('support.successTitle')}</h1>
            <p className="mt-3 text-sm text-navy/70 dark:text-cream/70 max-w-sm mx-auto">
              {t('support.successBody')}
            </p>

            <div className="mt-8 text-left space-y-3 rounded-2xl border border-navy/10 dark:border-cream/10 bg-navy/3 dark:bg-cream/3 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-navy/50 dark:text-cream/50 mb-4">
                {t('support.transferDetails')}
              </p>
              {settings?.account_number && (
                <CopyField label={t('support.accountNumber')} value={settings.account_number} />
              )}
              <CopyField label={t('support.transferReference')} value={donated.transfer_reference} />
              <CopyField label={t('support.amount')} value={`${donated.amount} PLN`} />
              {settings?.bank_owner_name && (
                <CopyField label={t('support.recipient')} value={settings.bank_owner_name} />
              )}
            </div>

            {isSubscriber && estimatedPoints > 0 && (
              <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-5 py-4 text-sm text-amber-900 dark:text-amber-200">
                <strong>{t('support.pointsInfo', { points: Math.floor(numericAmount * pointsPerZloty) })}</strong>
              </div>
            )}

            <p className="mt-6 text-xs text-navy/50 dark:text-cream/50">
              {t('support.referenceHint')}
            </p>
            {settings?.payment_url && (
              <a
                href={settings.payment_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy text-cream dark:bg-cream dark:text-navy px-6 py-3 text-sm font-bold"
              >
                {t('support.openTransfer')}
              </a>
            )}
            <Link
              to="/"
              className="mt-4 hidden sm:inline-flex items-center gap-2 rounded-xl border border-navy/20 dark:border-cream/20 px-6 py-3 text-sm font-semibold text-navy dark:text-cream"
            >
              {t('common.backToHome')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-2xl">

        {/* ── Hero ── */}
        <section className="mb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 dark:bg-rose-900/30 px-4 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 mb-4">
            <HeartIcon className="h-3.5 w-3.5" />
            {t('support.label')}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-navy dark:text-cream">
            {t('support.title')}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-navy/70 dark:text-cream/70 max-w-xl">
            {t('support.subtitle')}
          </p>
          {settings?.message && (
            <div className="mt-5 rounded-xl border border-green-200 dark:border-green-700/40 bg-green-50/60 dark:bg-green-900/15 px-5 py-4 text-sm text-navy/80 dark:text-cream/80">
              {settings.message}
            </div>
          )}
        </section>

        {/* ── Member points info ── */}
        {isSubscriber && pointsPerZloty > 0 && (
          <p className="mb-6 text-sm text-accent-red dark:text-amber-400">
            {t('support.memberPointsInfo', { rate: pointsPerZloty })}
          </p>
        )}

        {/* ── Donation form ── */}
        <div className="page-card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount picker */}
            <div>
              <label className="block text-sm font-semibold text-navy dark:text-cream mb-3">
                {t('support.chooseAmount')}
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {suggestedAmounts.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold border transition-all ${
                      amount === String(preset)
                        ? 'bg-navy text-cream dark:bg-cream dark:text-navy border-navy dark:border-cream'
                        : 'border-navy/20 dark:border-cream/20 text-navy dark:text-cream hover:border-navy/50 dark:hover:border-cream/50'
                    }`}
                  >
                    {preset} zł
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={minAmount}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t('support.customAmount', { min: minAmount })}
                  className="w-full rounded-xl border border-navy/20 dark:border-cream/20 bg-transparent px-4 py-3 pr-14 text-sm text-navy dark:text-cream placeholder-navy/40 dark:placeholder-cream/40 focus:outline-none focus:ring-2 focus:ring-navy/30 dark:focus:ring-cream/30"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-navy/50 dark:text-cream/50">
                  PLN
                </span>
              </div>
              {isSubscriber && numericAmount >= minAmount && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  +{estimatedPoints} {t('support.pointsLabel')}
                </p>
              )}
            </div>

            {/* Optional donor info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-navy/50 dark:text-cream/50">
                {t('support.optionalInfo')}
              </p>
              <input
                type="text"
                maxLength={100}
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder={t('support.donorName')}
                className="w-full rounded-xl border border-navy/20 dark:border-cream/20 bg-transparent px-4 py-3 text-sm text-navy dark:text-cream placeholder-navy/40 dark:placeholder-cream/40 focus:outline-none focus:ring-2 focus:ring-navy/30 dark:focus:ring-cream/30"
              />
              <input
                type="email"
                maxLength={255}
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                placeholder={t('support.donorEmail')}
                className="w-full rounded-xl border border-navy/20 dark:border-cream/20 bg-transparent px-4 py-3 text-sm text-navy dark:text-cream placeholder-navy/40 dark:placeholder-cream/40 focus:outline-none focus:ring-2 focus:ring-navy/30 dark:focus:ring-cream/30"
              />
              {isAuthenticated && (
                <p className="text-xs text-navy/50 dark:text-cream/50">
                  {t('support.loggedInHint')}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !amount || numericAmount < minAmount}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3.5 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <HeartIcon className="h-5 w-5" />
              {submitting ? t('common.loading') : t('support.submitButton')}
            </button>

            <p className="text-center text-xs text-navy/40 dark:text-cream/40">
              {t('support.manualNote')}
            </p>
          </form>
        </div>

        {/* ── Bank transfer card ── */}
        {(settings?.account_number || settings?.bank_owner_name) && (
          <div className="mt-6 page-card">
            <p className="text-xs font-bold uppercase tracking-widest text-navy/50 dark:text-cream/50 mb-4">
              {t('support.bankDetails')}
            </p>
            <div className="space-y-3">
              {settings.bank_owner_name && (
                <CopyField label={t('support.recipient')} value={settings.bank_owner_name} />
              )}
              {settings.account_number && (
                <CopyField label={t('support.accountNumber')} value={settings.account_number} />
              )}
              {settings.payment_title && (
                <CopyField label={t('support.paymentTitle')} value={settings.payment_title} />
              )}
              {settings.bank_owner_address && (
                <div className="px-4 py-3 rounded-xl border border-navy/15 dark:border-cream/15 bg-navy/5 dark:bg-cream/5">
                  <p className="text-[10px] uppercase tracking-widest text-navy/40 dark:text-cream/40">{t('support.bankAddress')}</p>
                  <p className="mt-0.5 text-sm text-navy dark:text-cream whitespace-pre-line">{settings.bank_owner_address}</p>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-navy/50 dark:text-cream/50">
              {t('support.referenceHint')}
            </p>
            {settings?.payment_url && (
              <a
                href={settings.payment_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-navy text-cream dark:bg-cream dark:text-navy px-4 py-3 text-sm font-bold"
              >
                {t('support.openTransfer')}
              </a>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link to="/" className="hidden sm:inline text-sm text-navy/60 dark:text-cream/60 hover:text-navy dark:hover:text-cream">
            ← {t('common.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SupportUs
