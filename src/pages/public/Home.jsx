import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

// Images used by /about — prefetch them while user is on the home page
const ABOUT_IMAGES = [
  '/static/DSC03468-2.jpg',
  '/static/DSC03257-2.jpg',
  '/static/DSC03721-2.jpg',
  '/static/DSC03635-2.jpg',
  '/static/about1.jpg',
  '/static/about7.jpg',
]

function Home() {
  const { t } = useLanguage()

  useEffect(() => {
    // Schedule prefetch after a short idle period so it doesn't compete
    // with the home page's own rendering
    const id = setTimeout(() => {
      ABOUT_IMAGES.forEach((src) => {
        const img = new Image()
        img.src = src
      })
    }, 800)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="page-shell flex flex-col items-center [min-height:calc(100svh_-_env(safe-area-inset-bottom,0px)_-_5.25rem)] sm:min-h-[calc(100vh-4rem)] sm:pb-12">
      {/* Golden-ratio spacer — logo sits at ~38% from top */}
      <div className="flex-[0.38]" />

      {/* Logo */}
      <div
        role="img"
        aria-label="Kenaz Centrum"
        className="h-36 w-36 flex-none bg-navy transition-colors duration-300 dark:bg-cream sm:h-56 sm:w-56
          [mask-image:url('/static/render.png')] [mask-repeat:no-repeat]
          [mask-position:center] [mask-size:contain]
          [-webkit-mask-image:url('/static/render.png')] [-webkit-mask-repeat:no-repeat]
          [-webkit-mask-position:center] [-webkit-mask-size:contain]"
      />

      {/* Gap between logo and buttons */}
      <div className="flex-[0.18] min-h-8" />

      {/* Action buttons */}
      <div className="w-full max-w-xs flex-none space-y-4 px-8">
        <Link
          to="/login"
          className="block w-full rounded-full bg-navy px-6 py-3 text-center text-sm font-black text-cream shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-cream dark:text-navy"
        >
          {t('auth.openLogin')}
        </Link>
        <Link
          to="/about"
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-black text-cream shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-cream dark:text-navy"
        >
          <span>{t('home.aboutCta')}</span>
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          to="/support"
          className="group flex w-full items-center justify-center gap-2 rounded-full border-2 border-navy px-6 py-3 text-sm font-black text-navy shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-cream dark:text-cream"
        >
          <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span>{t('support.label')}</span>
        </Link>
      </div>

      {/* Bottom spacer — slightly larger than top for golden ratio feel */}
      <div className="flex-[0.44]" />
    </div>
  )
}

export default Home
