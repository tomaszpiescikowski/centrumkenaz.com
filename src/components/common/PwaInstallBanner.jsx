import { useEffect, useMemo, useState } from 'react'
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

function CloseButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy/20 text-navy dark:border-cream/30 dark:text-cream"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}

function PwaInstallBanner() {
  const { t } = useLanguage()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  const isInstalled = useMemo(() => isStandaloneMode(), [])
  const ios = useMemo(() => isIos(), [])

  // Capture the beforeinstallprompt event (Chrome / Edge on Android)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => setDismissed(true)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  // Only show on home page
  if (location.pathname !== '/') return null
  if (isInstalled || dismissed) return null

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDismissed(true)
      }
    } catch {
      // prompt failed – fall through to manual instructions
    }
    setDeferredPrompt(null)
  }

  // ── iOS: step-by-step Safari instructions ──
  if (ios) {
    const hint = t('pwa.installHintIos')
    return (
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 px-4 sm:hidden">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-navy/20 bg-cream/95 p-3 shadow-lg backdrop-blur dark:border-cream/25 dark:bg-navy/95">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy dark:text-cream">
                {t('pwa.installCta')}
              </p>
              <p className="mt-1 text-xs text-navy/70 dark:text-cream/70">
                {t('pwa.installDesc')}
              </p>
              <div className="mt-2 space-y-0.5">
                {hint.split('\n').map((line, i) => (
                  <p key={i} className="text-xs leading-relaxed text-navy/70 dark:text-cream/70">
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <CloseButton onClick={() => setDismissed(true)} label={t('common.close')} />
          </div>
        </div>
      </div>
    )
  }

  // ── Android / other: Install button + manual Chrome fallback ──
  const showManual = !deferredPrompt
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 px-4 sm:hidden">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-navy/20 bg-cream/95 p-3 shadow-lg backdrop-blur dark:border-cream/25 dark:bg-navy/95">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy dark:text-cream">
              {t('pwa.installCta')}
            </p>
            <p className="mt-1 text-xs text-navy/70 dark:text-cream/70">
              {t('pwa.installDesc')}
            </p>

            {/* Automatic install button – shown when browser supports it */}
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-1.5 text-xs font-semibold text-cream shadow-sm active:scale-95 dark:bg-cream dark:text-navy"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
                </svg>
                {t('pwa.installBtn')}
              </button>
            )}

            {/* Manual Chrome instructions – fallback */}
            {showManual && (
              <p className="mt-1.5 text-xs text-navy/70 dark:text-cream/70">
                {t('pwa.installHintAndroid')}
              </p>
            )}
          </div>
          <CloseButton onClick={() => setDismissed(true)} label={t('common.close')} />
        </div>
      </div>
    </div>
  )
}

export default PwaInstallBanner
