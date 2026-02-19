import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const ITEM_BASE_CLASS = 'flex flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition'
const ITEM_ACTIVE_CLASS = 'text-navy dark:text-cream'
const ITEM_IDLE_CLASS = 'text-navy/55 hover:text-navy dark:text-cream/55 dark:hover:text-cream'
const ICON_CLASS = 'h-5 w-5'

function HomeIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10.5l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
    </svg>
  )
}

function ShopIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14l-1 12H6L5 8zm3 0a4 4 0 118 0" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" />
    </svg>
  )
}

function BottomItem({ to, label, icon, active }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={`${ITEM_BASE_CLASS} ${active ? ITEM_ACTIVE_CLASS : ITEM_IDLE_CLASS}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  )
}

function MobileBottomNav() {
  const { t } = useLanguage()
  const { user, isAuthenticated, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (location.pathname.startsWith('/auth/') || location.pathname === '/login') return null

  const isAdmin = user?.role === 'admin' && user?.account_status === 'active'
  const accountActive = (
    location.pathname.startsWith('/me')
    || location.pathname.startsWith('/plans')
    || location.pathname.startsWith('/pending-approval')
  )

  const handleAccountClick = () => {
    if (isAuthenticated) {
      if (user?.account_status === 'active') {
        navigate('/me')
      } else {
        navigate('/pending-approval')
      }
      return
    }

    login({ returnTo: `${location.pathname}${location.search}` })
  }

  const navItems = [
    {
      key: 'home',
      to: '/',
      label: t('nav.home'),
      active: location.pathname === '/',
      icon: <HomeIcon />,
    },
    {
      key: 'calendar',
      to: '/calendar',
      label: t('nav.calendar'),
      active: location.pathname.startsWith('/calendar') || location.pathname.startsWith('/event/'),
      icon: <CalendarIcon />,
    },
    ...(isAdmin
      ? [{
        key: 'admin',
        to: '/admin',
        label: t('nav.admin'),
        active: location.pathname.startsWith('/admin'),
        icon: <AdminIcon />,
      }]
      : []),
    {
      key: 'shop',
      to: '/shop',
      label: t('nav.shop'),
      active: location.pathname.startsWith('/shop'),
      icon: <ShopIcon />,
    },
  ]

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 sm:hidden">
      <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        <div className="rounded-2xl border border-navy/15 bg-cream/95 shadow-lg backdrop-blur dark:border-cream/20 dark:bg-navy/95">
          <div className={`grid items-end ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {navItems.map((item) => (
              <BottomItem
                key={item.key}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={item.active}
              />
            ))}

            <button
              type="button"
              onClick={handleAccountClick}
              aria-label={t('nav.myAccount')}
              className={`${ITEM_BASE_CLASS} ${accountActive ? ITEM_ACTIVE_CLASS : ITEM_IDLE_CLASS}`}
            >
              <AccountIcon />
              <span>{t('nav.myAccount')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileBottomNav
