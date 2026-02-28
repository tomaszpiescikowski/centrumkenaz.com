import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useState, useEffect, useLayoutEffect } from 'react'
import { LanguageProvider } from './context/LanguageContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CityProvider } from './context/CityContext'
import { NotificationProvider } from './context/NotificationContext'
import { ChatProvider } from './context/ChatContext'
import Layout from './components/layout/Layout'
import Home from './pages/public/Home'
import CalendarPage from './pages/public/CalendarPage'
import EventDetail from './pages/public/EventDetail'
import AuthCallback from './pages/auth/AuthCallback'

// Safety net: if nginx is not proxying /auth/google/callback → backend,
// the SPA receives the raw Google OAuth params here. Re-route them straight
// to /api/auth/google/callback which nginx always proxies via the /api/ block.
function GoogleCallbackRedirect() {
  const search = window.location.search
  window.location.replace('/api/auth/google/callback' + search)
  return null
}
import AdminEventCreate from './pages/admin/AdminEventCreate'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPayments from './pages/admin/AdminPayments'
import AdminManualPayments from './pages/admin/AdminManualPayments'
import AdminFeedback from './pages/admin/AdminFeedback'
import AdminUsersApproval from './pages/admin/AdminUsersApproval'
import AdminUsersList from './pages/admin/AdminUsersList'
import AdminBalance from './pages/admin/AdminBalance'
import AdminIconManager from './pages/admin/AdminIconManager'
import AdminDonations from './pages/admin/AdminDonations'
import AdminPromote from './pages/admin/AdminPromote'
import SupportUs from './pages/public/SupportUs'
import Account from './pages/account/Account'
import Plans from './pages/account/Plans'
import AboutSection from './pages/public/AboutSection'
import Privacy from './pages/public/Privacy'
import Terms from './pages/public/Terms'
import PendingApproval from './pages/account/PendingApproval'
import UserProfile from './pages/account/UserProfile'
import ManualPaymentPage from './pages/account/ManualPaymentPage'
import SubscriptionManualPaymentPage from './pages/account/SubscriptionManualPaymentPage'
import Panel from './pages/account/Panel'
import Login from './pages/auth/Login'
import ResetPassword from './pages/auth/ResetPassword'
import ChatPage from './pages/chat/ChatPage'
import ChatWSClient from './components/ChatWSClient'
import PushNotificationManager from './components/PushNotificationManager'

function RequireAuth() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/" replace />
  if (user?.account_status !== 'active' || user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

function ScrollToTop() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    // Immediate scroll attempt
    const performScroll = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTo(0, 0)
      document.body.scrollTo(0, 0)

      const appMain = document.querySelector('.app-main')
      if (appMain) {
        appMain.scrollTo(0, 0)
      }

      // Also try to scroll any scrollable containers
      const scrollableContainers = document.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]')
      scrollableContainers.forEach(container => {
        container.scrollTo(0, 0)
      })
    }

    // Execute immediately
    performScroll()

    // Also execute after a small delay to catch any late-rendering elements
    const timeoutId = setTimeout(performScroll, 0)
    
    return () => clearTimeout(timeoutId)
  }, [pathname])

  return null
}

function App() {
  const location = useLocation()
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('kenaz.theme')
    if (stored === 'dark') return true
    if (stored === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('kenaz.theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return (
    <AuthProvider>
      <LanguageProvider>
        <NotificationProvider>
          <CityProvider>
            <ChatProvider>
            <ChatWSClient />
            <PushNotificationManager />
            <Layout darkMode={darkMode} setDarkMode={setDarkMode}>
              <ScrollToTop />
              <div
                key={location.pathname}
                className="route-transition h-full"
              >
                <Routes location={location}>
                  <Route path="/" element={<Home />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/panel" element={<Panel />} />
                  <Route path="/about" element={<AboutSection />} />
                  <Route path="/support" element={<SupportUs />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/event/:id" element={<EventDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route element={<RequireAdmin />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/events/new" element={<AdminEventCreate />} />
                    <Route path="/admin/users" element={<AdminUsersApproval />} />
                    <Route path="/admin/all-users" element={<AdminUsersList />} />
                    <Route path="/admin/payments" element={<AdminPayments />} />
                    <Route path="/admin/manual-payments" element={<AdminManualPayments />} />
                    <Route path="/admin/feedback" element={<AdminFeedback />} />
                    <Route path="/admin/balance" element={<AdminBalance />} />
                    <Route path="/admin/icons" element={<AdminIconManager />} />
                    <Route path="/admin/donations" element={<AdminDonations />} />
                    <Route path="/admin/promote" element={<AdminPromote />} />
                  </Route>
                  <Route element={<RequireAuth />}>
                    <Route path="/me" element={<Account darkMode={darkMode} setDarkMode={setDarkMode} />} />
                    <Route path="/plans" element={<Plans />} />
                    <Route path="/pending-approval" element={<PendingApproval />} />
                    <Route path="/people/:userId" element={<UserProfile />} />
                    <Route path="/manual-payment/:registrationId" element={<ManualPaymentPage />} />
                    <Route path="/subscription-purchases/:purchaseId/manual-payment" element={<SubscriptionManualPaymentPage />} />
                  </Route>
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/auth/error" element={<AuthCallback />} />
                  <Route path="/auth/google/callback" element={<GoogleCallbackRedirect />} />
                </Routes>
              </div>
            </Layout>
            </ChatProvider>
          </CityProvider>
        </NotificationProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App
