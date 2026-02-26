import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'

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

function SupportHeartIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

function NavItem({ to, label, icon, active, colorClass }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={ITEM_BASE}
    >
      <span className={colorClass ?? (active ? ICON_ACTIVE : ICON_IDLE)}>{icon}</span>
      <span className={`truncate ${colorClass ?? (active ? ICON_ACTIVE : ICON_IDLE)}`}>{label}</span>
    </Link>
  )
}

function MobileBottomNav() {
  const { t } = useLanguage()
  const { user, isAuthenticated, login } = useAuth()
  const { totalUnread } = useChat()
  const location = useLocation()
  const navigate = useNavigate()
  const navRef = useRef(null)

  // Shared ref so both effects can read/write prevKbOpen state.
  // Using a ref instead of a closure variable lets the route-change
  // effect reset it without recreating the vv.resize listener.
  const prevKbOpenRef = useRef(false)

  // On every route change, force-clear any lingering keyboard state.
  //
  // Problem this solves: when the user submits the login form and React
  // navigates to a new page, the soft keyboard is dismissed by the OS
  // before the SPA's vv.resize listener can fire. prevKbOpen stays `true`
  // in the old closure, so the nav remains stuck with translateY(110%)
  // (hidden off-screen) until the next keyboard open/close cycle.
  //
  // Fix: on every pathname change we know the keyboard is gone — reset
  // the shared ref and immediately undo any lingering transform/class.
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    prevKbOpenRef.current = false
    document.documentElement.classList.remove('kb-open')
    el.style.transform = ''
  }, [location.pathname])

  // Single owner of keyboard-state for the whole PWA:
  // - Toggles html.kb-open so ChatPage can react (cp-root layout).
  // - Animates the nav slide-out/in via JS style.transform.
  //
  // Platform difference:
  // - iOS Safari: window.innerHeight stays fixed when keyboard opens;
  //   only visualViewport.height shrinks. So vv.height < window.innerHeight works.
  // - Android Chrome: BOTH window.innerHeight AND vv.height shrink together
  //   when the keyboard opens. Their difference stays near 0, so comparing
  //   the two is useless. Fix: capture the full height at mount time (before
  //   any keyboard can appear) and always compare vv.height against that.
  useEffect(() => {
    const vv = window.visualViewport
    const el = navRef.current
    if (!vv || !el) return

    el.style.transition = 'transform 0.3s ease'

    // Capture the full-screen height before any keyboard opens.
    // Math.max handles the case where this fires slightly after a soft
    // keyboard is already up (e.g. hot-reload during development).
    const fullHeight = Math.max(vv.height, window.innerHeight)

    let rafId = null

    const apply = () => {
      // Keyboard is open when the visual viewport is significantly shorter
      // than the original full-screen height. 120px threshold avoids false
      // positives from browser chrome resize (address bar hide/show).
      const kbOpen = vv.height < fullHeight - 120

      if (kbOpen === prevKbOpenRef.current) return  // nothing changed, don't interrupt ongoing animation
      prevKbOpenRef.current = kbOpen

      document.documentElement.classList.toggle('kb-open', kbOpen)

      // Cancel any pending frame from a previous rapid event
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        el.style.transform = kbOpen ? 'translateY(110%)' : ''
      })
    }

    vv.addEventListener('resize', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.documentElement.classList.remove('kb-open')
      el.style.transition = ''
      el.style.transform = ''
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
      key: 'support',
      to: '/support',
      label: t('nav.support'),
      active: location.pathname === '/support',
      icon: <SupportHeartIcon />,
      colorClass: location.pathname === '/support' ? 'text-rose-500 dark:text-rose-400' : 'text-rose-400/60 dark:text-rose-300/40',
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
    <nav
      ref={navRef}
      data-kb-hide
      className="fixed inset-x-0 bottom-0 z-50 border-t border-navy/10 bg-cream dark:border-cream/10 dark:bg-navy sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end">
        {navItems.map((item) => (
          <NavItem
            key={item.key}
            to={item.to}
            label={item.label}
            icon={item.icon}
            active={item.active}
            colorClass={item.colorClass}
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
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#EB4731] px-0.5 text-[9px] font-bold text-white">
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
    </>
  )
}

export default MobileBottomNav
