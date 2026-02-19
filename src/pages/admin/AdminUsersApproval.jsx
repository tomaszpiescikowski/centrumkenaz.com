import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { approveUser, fetchPendingUsers } from '../../api/admin'
import AuthGateCard from '../../components/ui/AuthGateCard'

function AdminUsersApproval() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchPendingUsers(authFetch)
        if (!cancelled) setPendingUsers(data)
      } catch (err) {
        if (!cancelled) {
          setPendingUsers([])
          showError(err.message || t('admin.approvalLoadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authFetch, isAdmin, isAuthenticated, t, showError])

  const handleApprove = async (pendingUserId) => {
    try {
      await approveUser(authFetch, pendingUserId)
      setPendingUsers((prev) => prev.filter((u) => u.user_id !== pendingUserId))
      showSuccess(t('admin.approvalSuccess'))
    } catch (err) {
      showError(err.message || t('admin.approvalActionError'))
    }
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.approvalTitle')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/users' })}
      />
    )
  }

  if (!isAdmin) {
    return (
      <AuthGateCard
        title={t('admin.notAuthorizedTitle')}
        message={t('admin.notAuthorized')}
        actionLabel={t('admin.backToDashboard')}
        actionTo="/admin"
      />
    )
  }

  return (
    <div className="page-shell">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70"
      >
        <span>←</span>
        {t('admin.backToDashboard')}
      </Link>
      <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream mt-3">
        {t('admin.approvalTitle')}
      </h1>
      <p className="text-navy/60 dark:text-cream/60 mt-2">
        {t('admin.approvalSubtitle')}
      </p>
      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
        ) : pendingUsers.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-navy/20 dark:border-cream/20">
            <p className="text-navy/70 dark:text-cream/70">
              {t('admin.approvalEmpty')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((pending) => (
              <div
                key={pending.user_id}
                className="page-card flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <p className="text-lg font-bold text-navy dark:text-cream">
                    {pending.full_name || t('admin.pendingUserNoName')}
                  </p>
                  <p className="text-sm text-navy/60 dark:text-cream/60">
                    {pending.email}
                  </p>
                  {pending.created_at && (
                    <p className="text-xs text-navy/50 dark:text-cream/50 mt-1">
                      {t('admin.pendingUserCreated', { date: new Date(pending.created_at).toLocaleString() })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleApprove(pending.user_id)}
                  className="px-5 py-2 rounded-full font-semibold btn-primary"
                >
                  {t('admin.approveButton')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminUsersApproval
