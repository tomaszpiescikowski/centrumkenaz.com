import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { confirmPasswordReset } from '../../api/auth'

function ResetPassword() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const authInputClass = 'ui-input ui-input-auth'

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    setErrorMessage('')

    if (password !== confirmPassword) {
      setErrorMessage(t('auth.passwordMismatch'))
      return
    }

    if (!token) {
      setErrorMessage(t('auth.resetPasswordInvalidToken'))
      return
    }

    setSubmitting(true)
    try {
      await confirmPasswordReset(token, password)
      setSuccess(true)
    } catch {
      setErrorMessage(t('auth.resetPasswordInvalidToken'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-shell flex min-h-[calc(100vh-4rem)] flex-col items-center pt-[calc(38.2svh-8rem)] lg:pt-[calc(23svh-8rem)] px-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:pb-10">
      <div className="page-card w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-navy dark:text-cream">
            {t('auth.resetPasswordTitle')}
          </h1>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
              {t('auth.resetPasswordSuccess')}
            </div>
            <Link
              to="/login"
              className="inline-block rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-cream transition hover:bg-navy/90 dark:bg-cream dark:text-navy dark:hover:bg-cream/90"
            >
              {t('auth.openLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">
                {t('auth.resetPasswordLabel')}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authInputClass}
                placeholder={t('auth.passwordPlaceholder')}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">
                {t('auth.resetPasswordConfirmLabel')}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={authInputClass}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>

            {errorMessage && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-cream transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cream dark:text-navy dark:hover:bg-cream/90"
            >
              {submitting ? t('auth.submitting') : t('auth.resetPasswordSubmit')}
            </button>

            <p className="text-center text-xs text-navy/50 dark:text-cream/50">
              <Link to="/login" className="underline underline-offset-2 hover:text-navy dark:hover:text-cream transition">
                {t('auth.openLogin')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
