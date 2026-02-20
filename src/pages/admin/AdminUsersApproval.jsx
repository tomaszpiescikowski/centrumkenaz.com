import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { approveUser, fetchPendingUsers } from '../../api/admin'
import AuthGateCard from '../../components/ui/AuthGateCard'
import EventIcon from '../../components/common/EventIcon'
import { TAG_COLORS } from '../../constants/interestTags'

function formatDate(isoString) {
  const d = new Date(isoString)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

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
                className="page-card flex flex-col sm:flex-row gap-4"
              >
                {/* Avatar */}
                <div className="shrink-0 flex sm:flex-col items-center gap-3 sm:gap-2">
                  {pending.picture_url ? (
                    <img
                      src={pending.picture_url}
                      alt={pending.full_name || ''}
                      className="w-16 h-16 rounded-full object-cover border-2 border-navy/10 dark:border-cream/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-navy/10 dark:bg-cream/10 flex items-center justify-center text-2xl font-bold text-navy/40 dark:text-cream/40">
                      {(pending.full_name || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-navy dark:text-cream">
                        {pending.full_name || t('admin.pendingUserNoName')}
                      </p>
                      <p className="text-sm text-navy/60 dark:text-cream/60">
                        {pending.email}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApprove(pending.user_id)}
                      className="px-5 py-2 rounded-full font-semibold btn-primary shrink-0"
                    >
                      {t('admin.approveButton')}
                    </button>
                  </div>

                  {/* About me */}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50 mb-0.5">
                      {t('admin.pendingUserAboutMe')}
                    </p>
                    <p className="text-sm text-navy/80 dark:text-cream/80 whitespace-pre-line">
                      {pending.about_me || t('admin.pendingUserNoAboutMe')}
                    </p>
                  </div>

                  {/* Interests */}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50 mb-0.5">
                      {t('admin.pendingUserInterests')}
                    </p>
                    {pending.interest_tags && pending.interest_tags.length > 0 ? (
                      <div className="ui-tag-list">
                        {pending.interest_tags.map((tag) => (
                          <span
                            key={tag}
                            className="ui-tag-chip ui-tag-chip-active"
                          >
                            <span className={TAG_COLORS[tag] || ''}>
                              <EventIcon type={tag} size="xs" />
                            </span>
                            <span>{t(`eventTypes.${tag}`)}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-navy/50 dark:text-cream/50">
                        {t('admin.pendingUserNoInterests')}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50 mb-0.5">
                      {t('admin.pendingUserPhone')}
                    </p>
                    <p className="text-sm text-navy/80 dark:text-cream/80">
                      {pending.phone_number
                        ? `${pending.phone_country_code || '+48'} ${pending.phone_number}`
                        : t('admin.pendingUserNoPhone')}
                    </p>
                  </div>

                  {/* Admin message */}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50 mb-0.5">
                      {t('admin.pendingUserAdminMessage')}
                    </p>
                    <p className="text-sm text-navy/80 dark:text-cream/80 whitespace-pre-line">
                      {pending.admin_message || t('admin.pendingUserNoAdminMessage')}
                    </p>
                  </div>

                  {pending.created_at && (
                    <p className="text-xs text-navy/50 dark:text-cream/50">
                      {t('admin.pendingUserCreated', { date: formatDate(pending.created_at) })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminUsersApproval
