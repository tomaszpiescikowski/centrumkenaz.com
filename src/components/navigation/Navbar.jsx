import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
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
  const { openChat, totalUnread } = useChat()
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
              to="/panel"
              label={t('nav.panel')}
              active={isActive('/panel')}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="hidden lg:inline">{t('feedback.button')}</span>
            </button>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => openChat()}
                className="btn-nav h-10 px-3 lg:px-4 transition-colors text-indigo-600 dark:text-indigo-400 border-indigo-400/40 dark:border-indigo-400/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-semibold text-xs"
                aria-label={t('comments.chatTitle')}
              >
                <span className="relative">
                  <svg className="h-4 w-4 lg:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  {totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#EB4731] px-0.5 text-[9px] font-bold text-white">
                      {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                  )}
                </span>
                <span className="hidden lg:inline">{t('comments.chatTitle')}</span>
              </button>
            )}
            <Link
              to="/support"
              className="btn-nav h-10 px-3 lg:px-4 transition-colors text-rose-600 dark:text-rose-400 border-rose-400/40 dark:border-rose-400/30 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-semibold text-xs"
              aria-label={t('nav.support')}
            >
              <svg className="h-4 w-4 lg:mr-1.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="hidden lg:inline">{t('nav.support')}</span>
            </Link>
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
