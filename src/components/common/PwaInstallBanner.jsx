import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function PwaInstallBanner() {
  const { t } = useLanguage()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)

  const isInstalled = useMemo(() => isStandaloneMode(), [])
  const ios = useMemo(() => isIos(), [])

  // Only show on home page
  if (location.pathname !== '/') return null
  if (isInstalled || dismissed) return null

  const hint = ios ? t('pwa.installHintIos') : t('pwa.installHintAndroid')

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 px-4 sm:hidden">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-navy/20 bg-cream/95 p-3 shadow-lg backdrop-blur dark:border-cream/25 dark:bg-navy/95">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy dark:text-cream">
              {t('pwa.installCta')}
            </p>
            <p className="mt-1 text-xs text-navy/70 dark:text-cream/70">
              {hint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t('common.close')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy/20 text-navy dark:border-cream/30 dark:text-cream"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default PwaInstallBanner
