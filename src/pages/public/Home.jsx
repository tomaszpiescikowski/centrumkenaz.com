import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

function Home() {
  const { t } = useLanguage()
  const [shaHover, setShaHover] = useState(false)

  return (
    <div className="page-shell flex h-full min-h-0 flex-col items-center justify-center pt-[12vh] sm:pt-0 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] text-center sm:min-h-[calc(100vh-4rem)] sm:pb-12">
      <div
        role="img"
        aria-label="Kenaz Centrum"
        className="h-28 w-28 bg-navy transition-colors duration-300 dark:bg-cream sm:h-44 sm:w-44
          [mask-image:url('/static/render.png')] [mask-repeat:no-repeat]
          [mask-position:center] [mask-size:contain]
          [-webkit-mask-image:url('/static/render.png')] [-webkit-mask-repeat:no-repeat]
          [-webkit-mask-position:center] [-webkit-mask-size:contain]"
      />

      <h1 className="mt-2 text-4xl font-black tracking-tight text-navy dark:text-cream sm:mt-3 sm:text-6xl">
        {t('common.appName')}
      </h1>
      <p className="mt-1 text-base font-semibold text-navy/70 dark:text-cream/70 sm:text-xl">
        {t('common.appSubtitle')}
      </p>
      <p className="mx-auto mt-3 max-w-xl text-sm text-navy/80 dark:text-cream/80 sm:text-base">
        {t('home.tagline')}
      </p>
      {__COMMIT_SHA__ && (
        <div className="relative mt-2 inline-block">
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

      <Link
        to="/about"
        className="group mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-navy px-8 py-3 text-base font-black text-cream shadow-lg shadow-navy/25 transition hover:-translate-y-0.5 hover:bg-navy/90 hover:shadow-xl dark:bg-cream dark:text-navy dark:shadow-cream/15 dark:hover:bg-cream/90 sm:mt-10 sm:px-10 sm:py-3.5 sm:text-lg"
      >
        <span>{t('home.aboutCta')}</span>
        <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}

export default Home
