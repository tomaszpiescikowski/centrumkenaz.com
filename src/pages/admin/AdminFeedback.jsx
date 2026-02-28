import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import AuthGateCard from '../../components/ui/AuthGateCard'
import { API_URL } from '../../api/config'

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function AdminFeedback() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError } = useNotification()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await authFetch(`${API_URL}/feedback`)
        if (!res.ok) throw new Error('Failed to load feedback')
        const data = await res.json()
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) {
          setItems([])
          showError(err.message || t('admin.feedback.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [authFetch, isAdmin, isAuthenticated, t, showError])

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.feedback.title')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/feedback' })}
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
    <div className="page-shell max-w-4xl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70"
      >
        <span>←</span>
        {t('admin.backToDashboard')}
      </Link>

      <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream mt-3">
        {t('admin.feedback.title')}
      </h1>
      <p className="text-navy/60 dark:text-cream/60 mt-2 mb-6">
        {t('admin.feedback.subtitle')}
      </p>

      {loading && (
        <p className="text-sm text-navy/50 dark:text-cream/50 animate-pulse">
          {t('common.loading')}
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-navy/10 dark:border-cream/10 p-8 text-center">
          <p className="text-navy/50 dark:text-cream/50">
            {t('admin.feedback.empty')}
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs text-navy/50 dark:text-cream/50">
            {t('admin.feedback.count', { count: items.length })}
          </p>

          {items.map((fb) => (
            <div
              key={fb.id}
              className="rounded-2xl border border-navy/10 dark:border-cream/10 bg-[rgba(255,251,235,0.82)] dark:bg-[rgba(15,23,74,0.68)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                <span className="text-sm font-semibold text-navy dark:text-cream">
                  {fb.email}
                </span>
                <span className="text-xs text-navy/40 dark:text-cream/40">
                  {formatDateTime(fb.created_at)}
                </span>
              </div>
              <p className="text-sm text-navy/80 dark:text-cream/80 leading-relaxed whitespace-pre-wrap break-words">
                {fb.comment}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminFeedback
