import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

function Home() {
  const { t } = useLanguage()

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
          className="block w-full rounded-full bg-navy px-8 py-4 text-center text-base font-black text-cream shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-cream dark:text-navy sm:text-lg"
        >
          {t('auth.openLogin')}
        </Link>
        <Link
          to="/about"
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-navy px-8 py-4 text-base font-black text-cream shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-cream dark:text-navy sm:text-lg"
        >
          <span>{t('home.aboutCta')}</span>
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          to="/support"
          className="group flex w-full items-center justify-center gap-2 rounded-full border-2 border-navy px-8 py-4 text-base font-black text-navy shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-cream dark:text-cream sm:text-lg"
        >
          <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span>{t('support.label')}</span>
        </Link>
      </div>
    </div>
  )
}

export default Home
