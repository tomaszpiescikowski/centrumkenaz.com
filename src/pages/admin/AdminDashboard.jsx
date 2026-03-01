import { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import AuthGateCard from '../../components/ui/AuthGateCard'
import ViewCard from '../../components/ui/ViewCard'
import { sendTestPush } from '../../api/push'

function AdminDashboard() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showSuccess, showError } = useNotification()
  const [sending, setSending] = useState(false)

  const handleTestPush = useCallback(async () => {
    setSending(true)
    try {
      const result = await sendTestPush(authFetch)
      if (result.status === 'no_subscriptions') {
        showError(result.message)
      } else {
        showSuccess(`🔔 ${result.message} Sprawdź powiadomienie systemowe.`)
      }
    } catch (err) {
      showError('Nie udało się wysłać testu: ' + (err?.message || String(err)))
    } finally {
      setSending(false)
    }
  }, [authFetch, showSuccess, showError])

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
    <div className="page-shell">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
          {t('admin.dashboardTitle')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60">
          {t('admin.dashboardSubtitle')}
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleTestPush}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-xl border border-navy/20 dark:border-cream/20 bg-navy/5 dark:bg-cream/5 px-4 py-2.5 text-sm font-semibold text-navy dark:text-cream hover:bg-navy/10 dark:hover:bg-cream/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>{sending ? '⏳' : '🔔'}</span>
          {sending ? 'Wysyłanie…' : 'Wyślij testowe powiadomienie push'}
        </button>
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
        <ViewCard
          title={t('admin.cards.icons.title')}
          description={t('admin.cards.icons.description')}
          to="/admin/icons"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.donations.title')}
          description={t('admin.cards.donations.description')}
          to="/admin/donations"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.promote.title')}
          description={t('admin.cards.promote.description')}
          to="/admin/promote"
          className="p-6"
        />
        <ViewCard
          title={t('admin.cards.usersList.title')}
          description={t('admin.cards.usersList.description')}
          to="/admin/all-users"
          className="p-6"
        />
      </div>
    </div>
  )
}

export default AdminDashboard
