import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import AuthGateCard from '../../components/ui/AuthGateCard'
import ViewCard from '../../components/ui/ViewCard'

function AdminDashboard() {
  const { user, isAuthenticated, login } = useAuth()
  const { t } = useLanguage()

  const isAdmin = user?.role === 'admin'

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.dashboardTitle')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin' })}
      />
    )
  }

  if (!isAdmin) {
    return (
      <AuthGateCard
        title={t('admin.notAuthorizedTitle')}
        message={t('admin.notAuthorized')}
        actionLabel={t('common.backToCalendar')}
        actionTo="/calendar"
      />
    )
  }

  return (
    <div className="page-shell max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
          {t('admin.dashboardTitle')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60">
          {t('admin.dashboardSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ViewCard
          title={t('admin.cards.createEvent.title')}
          description={t('admin.cards.createEvent.description')}
          to="/admin/events/new"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.approveUsers.title')}
          description={t('admin.cards.approveUsers.description')}
          to="/admin/users"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.payments.title')}
          description={t('admin.cards.payments.description')}
          to="/admin/payments"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.manualPayments.title')}
          description={t('admin.cards.manualPayments.description')}
          to="/admin/manual-payments"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.feedback.title')}
          description={t('admin.cards.feedback.description')}
          to="/admin/feedback"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.balance.title')}
          description={t('admin.cards.balance.description')}
          to="/admin/balance"
          className="p-6"
        />
      </div>
    </div>
  )
}

export default AdminDashboard
