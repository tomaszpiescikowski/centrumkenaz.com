import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { requestPasswordReset } from '../../api/auth'

const MODE_LOGIN = 'login'
const MODE_REGISTER = 'register'

function Login() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const {
    isAuthenticated,
    loading,
    user,
    loginWithGoogle,
    loginWithPassword,
    registerWithPassword,
    consumePostLoginRedirect,
  } = useAuth()

  const [mode, setMode] = useState(MODE_LOGIN)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [forgotState, setForgotState] = useState(null) // null | 'form' | 'sent'
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [form, setForm] = useState({
    login: '',
    password: '',
    email: '',
    fullName: '',
    confirmPassword: '',
    termsAccepted: false,
  })

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) return

    if (user?.account_status === 'pending') {
      navigate('/pending-approval', { replace: true })
      return
    }

    navigate('/me', { replace: true })
  }, [loading, isAuthenticated, user, navigate])

  const authInputClass = 'ui-input ui-input-auth'

  const completeLogin = (userData) => {
    if (userData?.account_status === 'pending') {
      navigate('/pending-approval', { replace: true })
      return
    }

    const nextManualPayment = userData?.next_action_manual_payment
    if (nextManualPayment?.registration_id) {
      navigate(`/manual-payment/${nextManualPayment.registration_id}?from=waitlist`, { replace: true })
      return
    }

    const returnTo = consumePostLoginRedirect()
    navigate(returnTo || '/', { replace: true })
  }

  const handleGoogleLogin = () => {
    loginWithGoogle()
  }

  const handleForgotPassword = async () => {
    if (forgotSubmitting || !forgotEmail) return
    setForgotSubmitting(true)
    try {
      await requestPasswordReset(forgotEmail.trim())
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setForgotSubmitting(false)
      setForgotState('sent')
    }
  }

  const handleChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }))
  }

  const handleCheckbox = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.checked,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (submitting) return

    setErrorMessage('')

    if (mode === MODE_REGISTER && form.password !== form.confirmPassword) {
      setErrorMessage(t('auth.passwordMismatch'))
      return
    }

    if (mode === MODE_REGISTER && !form.termsAccepted) {
      setErrorMessage(t('auth.termsRequired') || 'Musisz zaakceptować regulamin.')
      return
    }

    setSubmitting(true)
    try {
      const userData = mode === MODE_LOGIN
        ? await loginWithPassword({
          login: form.login.trim(),
          password: form.password,
        })
        : await registerWithPassword({
          email: form.email.trim(),
          full_name: form.fullName.trim(),
          password: form.password,
        })

      completeLogin(userData)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('auth.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-shell flex min-h-[calc(100vh-4rem)] flex-col items-center pt-[calc(38.2svh-8rem)] lg:pt-[calc(23svh-8rem)] px-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:pb-10">
      <div className="page-card w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-navy dark:text-cream">{t('auth.title')}</h1>
          <p className="mt-2 text-sm text-navy/70 dark:text-cream/70">{t('auth.subtitle')}</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-navy/10 bg-navy/5 p-1 dark:border-cream/15 dark:bg-cream/10">
          <button
            type="button"
            onClick={() => {
              setMode(MODE_LOGIN)
              setErrorMessage('')
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${mode === MODE_LOGIN ? 'bg-navy text-cream dark:bg-cream dark:text-navy' : 'text-navy/70 hover:bg-navy/10 dark:text-cream/70 dark:hover:bg-cream/10'}`}
          >
            {t('auth.modeLogin')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(MODE_REGISTER)
              setErrorMessage('')
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${mode === MODE_REGISTER ? 'bg-navy text-cream dark:bg-cream dark:text-navy' : 'text-navy/70 hover:bg-navy/10 dark:text-cream/70 dark:hover:bg-cream/10'}`}
          >
            {t('auth.modeRegister')}
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-navy/20 bg-cream/80 px-4 py-3 text-sm font-semibold text-navy transition hover:bg-navy/5 focus:outline-none focus:ring-2 focus:ring-navy/20 dark:border-cream/20 dark:bg-navy/70 dark:text-cream dark:hover:bg-cream/10 dark:focus:ring-cream/20"
          disabled={submitting}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5L18.6 4C16.9 2.4 14.7 1.5 12 1.5A10.5 10.5 0 001.5 12 10.5 10.5 0 0012 22.5c6 0 10-4.2 10-10.1 0-.7-.1-1.3-.2-1.9H12z" />
            <path fill="#34A853" d="M3.2 7.1l3.2 2.3C7.3 7.3 9.5 5.8 12 5.8c1.9 0 3.2.8 3.9 1.5L18.6 4C16.9 2.4 14.7 1.5 12 1.5c-4.1 0-7.7 2.3-9.5 5.6z" />
            <path fill="#4285F4" d="M12 22.5c2.7 0 5-1 6.7-2.6l-3.1-2.6c-.8.6-2 1.1-3.6 1.1-3.7 0-5.2-2.6-5.5-3.9L3.2 16.9A10.5 10.5 0 0012 22.5z" />
            <path fill="#FBBC05" d="M1.5 12c0 1.7.4 3.4 1.2 4.9l3.7-2.9c-.2-.5-.4-1.3-.4-2s.1-1.4.4-2L2.7 7.1A10.5 10.5 0 001.5 12z" />
          </svg>
          {t('auth.loginWithGoogle')}
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === MODE_LOGIN ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">{t('auth.loginLabel')}</span>
              <input
                value={form.login}
                onChange={handleChange('login')}
                className={authInputClass}
                placeholder={t('auth.loginPlaceholder')}
                autoComplete="username"
                minLength={3}
                maxLength={255}
                required
              />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">{t('auth.emailLabel')}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  className={authInputClass}
                  placeholder={t('auth.emailPlaceholder')}
                  autoComplete="email"
                  maxLength={255}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">{t('auth.fullNameLabel')}</span>
                <input
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  className={authInputClass}
                  placeholder={t('auth.fullNamePlaceholder')}
                  autoComplete="name"
                  maxLength={255}
                  required
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">{t('auth.passwordLabel')}</span>
            <input
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              className={authInputClass}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete={mode === MODE_LOGIN ? 'current-password' : 'new-password'}
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          {mode === MODE_LOGIN && (
            <>
              {forgotState === null && (
                <div className="text-right -mt-2">
                  <button
                    type="button"
                    className="text-xs text-navy/50 dark:text-cream/50 hover:text-navy dark:hover:text-cream underline underline-offset-2 transition"
                    onClick={() => { setForgotState('form'); setErrorMessage('') }}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
              )}

              {forgotState === 'form' && (
                <div className="rounded-xl border border-navy/10 bg-navy/5 dark:border-cream/10 dark:bg-cream/5 p-3 space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">
                      {t('auth.forgotPasswordEmailLabel')}
                    </span>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className={authInputClass}
                      placeholder={t('auth.forgotPasswordEmailPlaceholder')}
                      autoComplete="email"
                      maxLength={255}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotSubmitting || !forgotEmail}
                      className="flex-1 rounded-xl bg-accent-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-red/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {forgotSubmitting ? t('auth.forgotPasswordSendingLabel') : t('auth.forgotPasswordSend')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForgotState(null); setForgotEmail('') }}
                      className="rounded-xl border border-navy/20 px-3 py-2 text-sm text-navy/60 hover:text-navy dark:border-cream/20 dark:text-cream/60 dark:hover:text-cream transition"
                      aria-label="Zamknij"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {forgotState === 'sent' && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                  <p className="font-semibold">{t('auth.forgotPasswordSentTitle')}</p>
                  <p>{t('auth.forgotPasswordSentBody')}</p>
                </div>
              )}
            </>
          )}

          {mode === MODE_REGISTER && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">{t('auth.confirmPasswordLabel')}</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={handleChange('confirmPassword')}
                className={authInputClass}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>
          )}

          {mode === MODE_REGISTER && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={handleCheckbox('termsAccepted')}
                className="mt-0.5 h-4 w-4 shrink-0 accent-navy dark:accent-cream"
                required
              />
              <span className="text-sm text-navy/80 dark:text-cream/80">
                {t('auth.termsCheckbox').split('regulamin')[0]}
                <Link to="/terms" className="font-semibold underline underline-offset-2 hover:text-navy dark:hover:text-cream" target="_blank">
                  regulamin Centrum Kenaz
                </Link>
              </span>
            </label>
          )}

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
            {submitting ? t('auth.submitting') : mode === MODE_LOGIN ? t('auth.submitLogin') : t('auth.submitRegister')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
