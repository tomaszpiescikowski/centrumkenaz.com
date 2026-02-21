import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { API_URL } from '../../api/config'

/**
 * Temporary feedback modal for early-access testing.
 * Shows a friendly form explaining what kind of feedback is useful,
 * targeting non-technical users.
 *
 * ⚠️  This entire component is temporary and should be removed
 *     once the feedback campaign is over.
 */
function FeedbackModal({ open, onClose }) {
  const { t } = useLanguage()
  const { user } = useAuth()

  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)
  const textareaRef = useRef(null)

  // Focus textarea when modal opens
  useEffect(() => {
    if (open && !sent) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 120)
      return () => clearTimeout(timer)
    }
  }, [open, sent])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  const reset = () => {
    setComment('')
    setError(false)
    setSent(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError(false)

    try {
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email || null, comment }),
      })
      if (!res.ok) throw new Error('submit failed')
      setSent(true)
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  const examples = t('feedback.examples') || []

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/40 dark:bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={t('feedback.title')}
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-400/40 dark:border-amber-400/30 bg-cream dark:bg-navy p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* ---------- SUCCESS STATE ---------- */}
        {sent ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <svg className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-black text-navy dark:text-cream mb-2">
              {t('feedback.successTitle')}
            </h2>
            <p className="text-sm text-navy/70 dark:text-cream/70 leading-relaxed mb-6">
              {t('feedback.successMessage')}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="btn-accent rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              {t('feedback.close')}
            </button>
          </div>
        ) : (
          /* ---------- FORM STATE ---------- */
          <>
            <h2 className="text-lg font-black text-navy dark:text-cream mb-1">
              {t('feedback.title')}
            </h2>

            {/* Amber "early testing" badge */}
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300/40 dark:border-amber-500/20 p-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
              <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/80">
                {t('feedback.subtitle')}
              </p>
            </div>

            {/* Hint + examples */}
            <p className="text-xs font-semibold text-navy/60 dark:text-cream/60 mb-1.5">
              {t('feedback.hint')}
            </p>
            <ul className="mb-4 space-y-1 pl-4">
              {Array.isArray(examples) && examples.map((ex, i) => (
                <li key={i} className="text-xs text-navy/55 dark:text-cream/55 list-disc leading-relaxed">
                  {ex}
                </li>
              ))}
            </ul>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Comment */}
              <div>
                <label htmlFor="fb-comment" className="block text-xs font-semibold text-navy/70 dark:text-cream/70 mb-1">
                  {t('feedback.commentLabel')}
                </label>
                <textarea
                  ref={textareaRef}
                  id="fb-comment"
                  required
                  minLength={3}
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('feedback.commentPlaceholder')}
                  className="w-full rounded-xl border border-navy/15 dark:border-cream/15 bg-white dark:bg-navy/60 px-3 py-2 text-sm text-navy dark:text-cream placeholder:text-navy/30 dark:placeholder:text-cream/30 outline-none focus:ring-2 focus:ring-amber-400/50 resize-y"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {t('feedback.errorMessage')}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={sending}
                  className="btn-secondary text-xs"
                >
                  {t('feedback.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={sending || !comment.trim()}
                  className="rounded-full bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-navy px-5 py-2.5 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? '...' : t('feedback.send')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default FeedbackModal
