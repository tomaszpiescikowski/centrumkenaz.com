import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isSecureInstallContext() {
  if (typeof window === 'undefined') return true
  return window.isSecureContext === true
}

function PwaInstallBanner() {
  const { t } = useLanguage()
  const { showWarning } = useNotification()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(isStandaloneMode())
  const [dismissed, setDismissed] = useState(false)
  const secureContext = isSecureInstallContext()

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      setDismissed(false)
    }
    const onAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const canShow = useMemo(
    () => !isInstalled && !dismissed,
    [dismissed, isInstalled],
  )
  const inlineHint = useMemo(
    () => (secureContext ? t('pwa.installManualHint') : t('pwa.installRequiresHttps')),
    [secureContext, t],
  )

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      showWarning(inlineHint, { title: t('pwa.installManualTitle') })
      return
    }
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }, [deferredPrompt, inlineHint, showWarning, t])

  if (!canShow) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 px-4 sm:hidden">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-navy/20 bg-cream/95 p-3 shadow-lg backdrop-blur dark:border-cream/25 dark:bg-navy/95">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold text-navy dark:text-cream">
            {t('pwa.installCta')}
          </p>
          <button
            type="button"
            onClick={handleInstall}
            className="btn-primary h-9 shrink-0 px-3 text-xs"
          >
            {t('pwa.installButton')}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t('common.close')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-navy/20 text-navy dark:border-cream/30 dark:text-cream"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {!deferredPrompt && (
          <p className="mt-2 text-xs text-navy/70 dark:text-cream/70">
            {inlineHint}
          </p>
        )}
      </div>
    </div>
  )
}

export default PwaInstallBanner
