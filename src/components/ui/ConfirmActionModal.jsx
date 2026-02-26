import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-screen confirmation modal for destructive/important admin actions.
 *
 * Props:
 *  - open        {boolean}   Whether the modal is visible
 *  - title       {string}    Dialog heading
 *  - description {string}    Detailed explanation of what will happen
 *  - details     {Array}     Optional [{label, value}] pairs shown in a summary card
 *  - confirmLabel {string}   Text for the primary button
 *  - cancelLabel  {string}   Text for the cancel button
 *  - variant     {'danger'|'warning'|'default'}  Colour accent
 *  - loading     {boolean}   Disables buttons while processing
 *  - onConfirm   {function}  Called when admin confirms
 *  - onCancel    {function}  Called when admin cancels or presses Escape
 */
function ConfirmActionModal({
  open,
  title,
  description,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const confirmBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    document.addEventListener('keydown', handleKey)
    confirmBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  const accentClasses = {
    danger: 'border-[#EB4731]/40 dark:border-[#EB4731]/40',
    warning: 'border-amber-500/40 dark:border-amber-400/40',
    default: 'border-navy/20 dark:border-cream/20',
  }

  const confirmBtnClasses = {
    danger:
      'bg-[#EB4731] text-white hover:bg-[#C83C2A] dark:bg-[#EB4731] dark:hover:bg-[#C83C2A]',
    warning:
      'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600',
    default: 'btn-accent',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-navy/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={dialogRef}
        className={`mx-4 w-full max-w-md rounded-2xl border bg-cream dark:bg-navy p-6 shadow-xl ${accentClasses[variant] || accentClasses.default}`}
      >
        <h2 className="text-lg font-black text-navy dark:text-cream mb-2">
          {title}
        </h2>

        <p className="text-sm text-navy/70 dark:text-cream/70 mb-4 leading-relaxed">
          {description}
        </p>

        {details && details.length > 0 && (
          <div className="mb-5 rounded-xl border border-navy/10 dark:border-cream/10 bg-navy/5 dark:bg-cream/5 p-3 space-y-1.5">
            {details.map((d, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-navy/60 dark:text-cream/60">{d.label}</span>
                <span className="font-semibold text-navy dark:text-cream">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-full px-5 py-2.5 text-xs font-semibold transition ${
              loading
                ? 'cursor-not-allowed opacity-50'
                : confirmBtnClasses[variant] || confirmBtnClasses.default
            }`}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ConfirmActionModal
