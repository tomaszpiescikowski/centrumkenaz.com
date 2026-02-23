import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import FeedbackModal from '../ui/FeedbackModal'

const ICON_CLASS = 'h-6 w-6'
const ITEM_BASE = 'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium'
const ICON_ACTIVE = 'text-navy dark:text-cream'
const ICON_IDLE = 'text-navy/35 dark:text-cream/35'

function HomeIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10.5l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
    </svg>
  )
}

function PanelIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function NavItem({ to, label, icon, active }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={ITEM_BASE}
    >
      <span className={active ? ICON_ACTIVE : ICON_IDLE}>{icon}</span>
      <span className={`truncate ${active ? ICON_ACTIVE : ICON_IDLE}`}>{label}</span>
    </Link>
  )
}

function MobileBottomNav() {
  const { t } = useLanguage()
  const { user, isAuthenticated, login } = useAuth()
  const { totalUnread } = useChat()
  const location = useLocation()
  const navigate = useNavigate()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const navRef = useRef(null)

  // Belt-and-suspenders fix for iOS Safari: when overflow-x is `hidden` on
  // <html> (Safari < 16 fallback), iOS treats <html> as a scroll container
  // and anchors position:fixed elements to it. Keyboard open/close can leave
  // the html.scrollTop at a non-zero value, making the nav appear shifted up.
  // We listen to visualViewport changes and correct style.bottom so the nav
  // always sits at the true visual viewport bottom.
  useEffect(() => {
    const vv = window.visualViewport
    const el = navRef.current
    if (!vv || !el) return

    const correct = () => {
      const kbOpen = vv.height < window.innerHeight - 100

      // Toggle global kb-open class so CSS reacts on every page, not just ChatPage.
      document.documentElement.classList.toggle('kb-open', kbOpen)

      if (kbOpen) {
        // Keyboard is open — CSS will slide the nav out via transform.
        // Clear any bottom correction so they don't fight each other.
        el.style.bottom = ''
      } else {
        // Keyboard closed — apply bottom correction for older Safari where
        // html.scrollTop can be left at a non-zero value after keyboard dismiss.
        const surplus = window.innerHeight - vv.offsetTop - vv.height
        el.style.bottom = surplus > 0 ? `${surplus}px` : ''
      }
    }

    vv.addEventListener('resize', correct)
    vv.addEventListener('scroll', correct)
    return () => {
      vv.removeEventListener('resize', correct)
      vv.removeEventListener('scroll', correct)
      document.documentElement.classList.remove('kb-open')
      if (el) el.style.bottom = ''
    }
  }, [])

  if (location.pathname.startsWith('/auth/')) return null

  const isAdmin = user?.role === 'admin' && user?.account_status === 'active'
  const accountActive = (
    location.pathname === '/me'
    || location.pathname.startsWith('/plans')
    || location.pathname.startsWith('/pending-approval')
    || location.pathname === '/login'
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
  ]

  const navItemsRight = [
    {
      key: 'panel',
      to: '/panel',
      label: t('nav.panel'),
      active: location.pathname.startsWith('/panel'),
      icon: <PanelIcon />,
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
  ]

  return (
    <>
    {/* Temporary feedback floating button */}
    <button
      type="button"
      onClick={() => setFeedbackOpen(true)}
      className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 sm:hidden flex items-center justify-center rounded-full bg-amber-500 text-white shadow-lg p-2.5 transition hover:bg-amber-600 active:scale-95"
      aria-label={t('feedback.button')}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    </button>
    <nav
      ref={navRef}
      data-kb-hide
      className="fixed inset-x-0 bottom-0 z-50 border-t border-navy/10 bg-cream dark:border-cream/10 dark:bg-navy sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', transition: 'transform 0.25s ease, bottom 0.25s ease' }}
    >
      <div className="flex items-end">
        {navItems.map((item) => (
          <NavItem
            key={item.key}
            to={item.to}
            label={item.label}
            icon={item.icon}
            active={item.active}
          />
        ))}

        {/* ── Central chat button ── */}
        <Link
          to="/chat"
          aria-label={t('comments.chatTitle')}
          className={ITEM_BASE}
        >
          <span className={`relative ${location.pathname === '/chat' ? 'text-indigo-500 dark:text-indigo-400' : 'text-navy/35 dark:text-cream/35'}`}>
            <ChatIcon />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </span>
          <span className={`truncate ${location.pathname === '/chat' ? 'text-indigo-500 dark:text-indigo-400' : 'text-navy/35 dark:text-cream/35'}`}>{t('comments.chatTitle')}</span>
        </Link>

        {navItemsRight.map((item) => (
          <NavItem
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
          className={ITEM_BASE}
        >
          <span className={accountActive ? ICON_ACTIVE : ICON_IDLE}><AccountIcon /></span>
          <span className={`truncate ${accountActive ? ICON_ACTIVE : ICON_IDLE}`}>{t('nav.myAccount')}</span>
        </button>
      </div>
    </nav>
    <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  )
}

export default MobileBottomNav
