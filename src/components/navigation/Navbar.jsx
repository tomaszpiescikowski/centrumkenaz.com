import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../controls/ThemeToggle'
import LoginButton from '../forms/LoginButton'

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
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-navy/20 bg-cream/95 backdrop-blur-sm transition-colors duration-300 dark:border-cream/20 dark:bg-navy/95">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <Link to="/" className="flex shrink-0 items-center pr-1" aria-label={t('common.appName')}>
            <BrandMark />
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            {isAuthenticated && user && (
              <button
                onClick={handleAccountClick}
                className="btn-nav h-10 w-10 p-0 overflow-hidden"
                aria-label={t('nav.myAccount')}
              >
                {user.picture_url ? (
                  <img
                    src={user.picture_url}
                    alt={user.full_name}
                    className="h-full w-full object-cover border-2 border-navy/20 dark:border-cream/30 rounded-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy dark:bg-cream/15 dark:text-cream border-2 border-navy/20 dark:border-cream/30">
                    {user.full_name?.charAt(0) || '?'}
                  </div>
                )}
              </button>
            )}
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} compact />
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="btn-nav h-10 w-10"
                aria-label={t('account.logout')}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="hidden items-center justify-between gap-4 sm:flex">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
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
              to="/shop"
              label={t('nav.shop')}
              active={isActive('/shop')}
              desktopButtonClass={desktopButtonClass}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14l-1 12H6L5 8zm3 0a4 4 0 118 0" />
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
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            <LoginButton />
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
