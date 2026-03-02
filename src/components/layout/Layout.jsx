import { useLocation } from 'react-router-dom'
import Navbar from '../navigation/Navbar'
import Footer from '../navigation/Footer'
import NotificationBanner from '../common/NotificationBanner'
import MobileBottomNav from '../navigation/MobileBottomNav'
import PwaInstallBanner from '../common/PwaInstallBanner'
import PendingApprovalOverlay from '../common/PendingApprovalOverlay'
import ChatModal from '../ui/ChatModal'
import DraggableFeedbackButton from '../common/DraggableFeedbackButton'

function Layout({ children, darkMode, setDarkMode }) {
  const location = useLocation()
  const isMobileHomeRoute = location.pathname === '/'

  const mainClassName =
    'sm:pt-16 pb-[calc(env(safe-area-inset-bottom)+3.5rem+40px)] sm:pb-10 sm:min-h-[calc(100vh-4rem)] flex-1'

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
      <ChatModal />
      <PendingApprovalOverlay />
      {isMobileHomeRoute && <DraggableFeedbackButton />}
    </div>
  )
}

export default Layout
