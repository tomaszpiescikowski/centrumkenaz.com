import { useLocation } from 'react-router-dom'
import Navbar from '../navigation/Navbar'
import Footer from '../navigation/Footer'
import NotificationBanner from '../common/NotificationBanner'
import MobileBottomNav from '../navigation/MobileBottomNav'
import PwaInstallBanner from '../common/PwaInstallBanner'

const MOBILE_APP_SHELL_PATHS = new Set([
  '/',
  '/calendar',
  '/shop',
  '/me',
  '/plans',
  '/pending-approval',
])

function Layout({ children, darkMode, setDarkMode }) {
  const location = useLocation()
  const isMobileAppShellRoute = MOBILE_APP_SHELL_PATHS.has(location.pathname)
  const isMobileHomeRoute = location.pathname === '/'

  const mainClassName = isMobileAppShellRoute
    ? `pt-16 h-[calc(100svh-4rem)] overflow-hidden overscroll-none ${
      isMobileHomeRoute ? 'pb-0' : 'pb-[calc(env(safe-area-inset-bottom)+6.25rem)]'
    } sm:h-auto sm:overflow-visible sm:pb-0 sm:min-h-[calc(100vh-4rem)] flex-1`
    : 'pt-16 pb-24 sm:pb-0 sm:min-h-[calc(100vh-4rem)] flex-1'

  return (
    <div className="app-shell theme-transition min-h-[100svh] flex flex-col bg-cream text-navy transition-colors duration-300 dark:bg-navy dark:text-cream sm:min-h-screen">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <NotificationBanner />
      <main className={`app-main ${mainClassName}`}>
        {children}
      </main>
      <div className="hidden sm:block">
        <Footer />
      </div>
      <PwaInstallBanner />
      <MobileBottomNav />
    </div>
  )
}

export default Layout
