import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../controls/ThemeToggle'
import LoginButton from '../forms/LoginButton'
import FeedbackModal from '../ui/FeedbackModal'

const BRAND_MARK_CLASS = `h-10 w-10 rounded-full bg-navy transition-colors duration-300 dark:bg-cream
  [mask-image:url('/static/render.png')] [mask-repeat:no-repeat]
  [mask-position:center] [mask-size:cover]
  [-webkit-mask-image:url('/static/render.png')] [-webkit-mask-repeat:no-repeat]
  [-webkit-mask-position:center] [-webkit-mask-size:cover]`

function BrandMark() {
  return (
    <div
      role="img"
      aria-label="Kenaz"
      className={BRAND_MARK_CLASS}
    />
  )
}

function DesktopNavLink({ to, label, active, children, desktopButtonClass }) {
  return (
    <Link to={to} className={desktopButtonClass(active)} aria-label={label}>
      {children}
      <span className="hidden lg:inline">{label}</span>
    </Link>
  )
}

function Navbar({ darkMode, setDarkMode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user, isAuthenticated, logout } = useAuth()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const isActive = (path) => (
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  )

  const desktopButtonClass = (active) => `
    btn-nav h-10 w-10 lg:w-auto transition-colors
    ${active ? 'border-navy/40 text-navy dark:border-cream/45 dark:text-cream' : 'opacity-90'}
  `

  const isAdmin = user?.role === 'admin' && user?.account_status === 'active'

  const handleAccountClick = () => {
    if (!isAuthenticated) return
    if (user?.account_status === 'active') {
      navigate('/me')
    } else {
      navigate('/pending-approval')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <>
    <nav className="hidden sm:block fixed left-0 right-0 top-0 z-50 border-b border-navy/20 bg-cream/95 backdrop-blur-sm transition-colors duration-300 dark:border-cream/20 dark:bg-navy/95">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex items-center gap-3" data-no-hover="true">
              <BrandMark />
              <span className="hidden text-xl font-bold text-navy dark:text-cream lg:inline">{t('common.appName')}</span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-3">
            <DesktopNavLink
              to="/calendar"
              label={t('nav.calendar')}
              active={isActive('/calendar')}
              desktopButtonClass={desktopButtonClass}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
              </svg>
            </DesktopNavLink>
            <DesktopNavLink
              to="/my-events"
              label={t('nav.events')}
              active={isActive('/my-events')}
              desktopButtonClass={desktopButtonClass}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </DesktopNavLink>
            {isAdmin && (
              <DesktopNavLink
                to="/admin"
                label={t('nav.admin')}
                active={isActive('/admin')}
                desktopButtonClass={desktopButtonClass}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
                </svg>
              </DesktopNavLink>
            )}
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="btn-nav h-10 px-3 lg:px-4 transition-colors text-amber-600 dark:text-amber-400 border-amber-400/40 dark:border-amber-400/30 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-semibold text-xs"
              aria-label={t('feedback.button')}
            >
              <svg className="h-4 w-4 lg:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="hidden lg:inline">{t('feedback.button')}</span>
            </button>
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            <LoginButton />
          </div>
        </div>
      </div>
    </nav>
    <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  )
}

export default Navbar
