import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { promoteUserToAdmin } from '../../api/admin'

function generateChallenge() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function ConfirmPromoteDialog({ email, challenge, onConfirm, onCancel, submitting, t }) {
  const [input, setInput] = useState('')
  const isMatch = input.toUpperCase() === challenge

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-300 bg-cream p-6 shadow-2xl dark:border-red-700 dark:bg-navy">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
            {t('admin.promote.confirmTitle')}
          </h2>
        </div>

        <div className="mb-4 space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <p className="font-semibold">{t('admin.promote.warning1')}</p>
          <p>{t('admin.promote.warning2')}</p>
          <p>{t('admin.promote.warning3')}</p>
        </div>

        <p className="mb-2 text-sm text-navy/70 dark:text-cream/70">
          {t('admin.promote.confirmInstruction')}
        </p>
        <p className="mb-1 text-sm text-navy/60 dark:text-cream/60">
          {t('admin.promote.targetEmail')}: <strong className="text-navy dark:text-cream">{email}</strong>
        </p>

        <div className="mb-4 flex items-center justify-center rounded-xl bg-navy/5 py-3 dark:bg-cream/5">
          <span className="font-mono text-2xl font-black tracking-[0.3em] text-navy dark:text-cream select-none">
            {challenge}
          </span>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder={t('admin.promote.typePlaceholder')}
          className="ui-input mb-4 text-center font-mono text-lg tracking-widest"
          autoFocus
          maxLength={6}
          autoComplete="off"
          spellCheck="false"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-nav flex-1 h-10 px-4 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isMatch || submitting}
            className="flex-1 h-10 rounded-xl bg-[#EB4731] px-4 text-sm font-semibold text-white transition hover:bg-[#C83C2A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? t('admin.promote.promoting') : t('admin.promote.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminPromote() {
  const { authFetch } = useAuth()
  const { t } = useLanguage()
  const { showSuccess, showError } = useNotification()

  const [email, setEmail] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const challenge = useMemo(() => generateChallenge(), [showDialog]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenDialog = useCallback((e) => {
    e.preventDefault()
    if (!email.trim()) return
    setShowDialog(true)
  }, [email])

  const handleCancel = useCallback(() => {
    setShowDialog(false)
  }, [])

  const handleConfirm = useCallback(async () => {
    setSubmitting(true)
    try {
      const result = await promoteUserToAdmin(authFetch, email.trim())
      showSuccess(result.message || t('admin.promote.success'))
      setEmail('')
      setShowDialog(false)
    } catch (err) {
      showError(err.message || t('admin.promote.error'))
    } finally {
      setSubmitting(false)
    }
  }, [authFetch, email, showSuccess, showError, t])

  return (
    <div className="page-shell max-w-2xl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70"
      >
        <span>←</span> {t('admin.backToDashboard')}
      </Link>

      <h1 className="mt-3 text-2xl sm:text-3xl font-black text-navy dark:text-cream">
        {t('admin.promote.title')}
      </h1>
      <p className="mt-1 text-navy/60 dark:text-cream/60 text-sm">
        {t('admin.promote.subtitle')}
      </p>

      <form onSubmit={handleOpenDialog} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/65 dark:text-cream/65">
            {t('admin.promote.emailLabel')}
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('admin.promote.emailPlaceholder')}
            className="ui-input"
            required
          />
        </label>

        <button
          type="submit"
          disabled={!email.trim()}
          className="btn-nav h-10 px-6 text-sm font-semibold bg-[#EB4731] text-white border-[#EB4731] hover:bg-[#C83C2A] disabled:opacity-40"
        >
          {t('admin.promote.submitButton')}
        </button>
      </form>

      {showDialog && (
        <ConfirmPromoteDialog
          email={email.trim()}
          challenge={challenge}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          submitting={submitting}
          t={t}
        />
      )}
    </div>
  )
}

export default AdminPromote
