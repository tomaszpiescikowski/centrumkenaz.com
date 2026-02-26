import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

function Home() {
  const { t } = useLanguage()
  const [shaHover, setShaHover] = useState(false)

  return (
    <div className="page-shell flex h-full min-h-0 flex-col items-center pb-[calc(env(safe-area-inset-bottom)+5.25rem)] sm:min-h-[calc(100vh-4rem)] sm:pb-12">
      {/* Logo centred in the remaining vertical space */}
      <div className="flex flex-1 items-center justify-center">
        <div
          role="img"
          aria-label="Kenaz Centrum"
          className="h-36 w-36 bg-navy transition-colors duration-300 dark:bg-cream sm:h-56 sm:w-56
            [mask-image:url('/static/render.png')] [mask-repeat:no-repeat]
            [mask-position:center] [mask-size:contain]
            [-webkit-mask-image:url('/static/render.png')] [-webkit-mask-repeat:no-repeat]
            [-webkit-mask-position:center] [-webkit-mask-size:contain]"
        />
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-xs space-y-4 px-8 sm:max-w-sm">
        <Link
          to="/login"
          className="block w-full rounded-full bg-cream px-8 py-4 text-center text-base font-black text-navy shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-navy dark:text-cream sm:text-lg"
        >
          {t('auth.openLogin')}
        </Link>
        <Link
          to="/about"
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-cream px-8 py-4 text-base font-black text-navy shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-navy dark:text-cream sm:text-lg"
        >
          <span>{t('home.aboutCta')}</span>
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Version badge */}
      {__COMMIT_SHA__ && (
        <div className="relative mt-4 inline-block">
          <p
            className="cursor-default text-[10px] font-light tracking-wider text-navy/30 dark:text-cream/30"
            onMouseEnter={() => setShaHover(true)}
            onMouseLeave={() => setShaHover(false)}
          >
            wersja: {__COMMIT_SHA__}
          </p>
          {shaHover && (__COMMIT_SUBJECT__ || __COMMIT_BODY__) && (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-xl bg-navy px-4 py-3 text-left shadow-xl dark:bg-cream">
              {__COMMIT_SUBJECT__ && (
                <p className="text-xs font-semibold leading-snug text-cream dark:text-navy">{__COMMIT_SUBJECT__}</p>
              )}
              {__COMMIT_BODY__ && (
                <p className="mt-1.5 text-[10px] leading-relaxed text-cream/70 dark:text-navy/70">{__COMMIT_BODY__.trim()}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Home
