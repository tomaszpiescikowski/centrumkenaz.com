import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import AuthGateCard from '../../components/ui/AuthGateCard'
import { fetchAnnouncements, createAnnouncement, deleteAnnouncement } from '../../api/announcements'

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

function AdminAnnouncements() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = user?.role === 'admin'

  const loadItems = async () => {
    setLoading(true)
    try {
      const data = await fetchAnnouncements()
      setItems(data)
    } catch (err) {
      setItems([])
      showError(err.message || t('admin.announcements.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchAnnouncements()
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) {
          setItems([])
          showError(err.message || t('admin.announcements.loadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isAuthenticated, isAdmin, t, showError])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    try {
      await createAnnouncement(authFetch, { title: title.trim(), content: content.trim() })
      showSuccess(t('admin.announcements.createSuccess'))
      setTitle('')
      setContent('')
      await loadItems()
    } catch (err) {
      showError(err.message || t('admin.announcements.createError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.announcements.deleteConfirm'))) return
    try {
      await deleteAnnouncement(authFetch, id)
      showSuccess(t('admin.announcements.deleteSuccess'))
      await loadItems()
    } catch (err) {
      showError(err.message || t('admin.announcements.deleteError'))
    }
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.announcements.title')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/announcements' })}
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
        {t('admin.announcements.title')}
      </h1>
      <p className="text-navy/60 dark:text-cream/60 mt-2 mb-6">
        {t('admin.announcements.subtitle')}
      </p>

      {/* Create form */}
      <form onSubmit={handleSubmit} className="mb-8 space-y-4 rounded-2xl border border-navy/10 dark:border-cream/10 bg-white/60 dark:bg-cream/5 p-4 sm:p-5">
        <div>
          <label className="block text-sm font-semibold text-navy dark:text-cream mb-1">
            {t('admin.announcements.titleLabel')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            className="w-full rounded-xl border border-navy/15 dark:border-cream/15 bg-white dark:bg-cream/5 px-4 py-2.5 text-sm text-navy dark:text-cream placeholder:text-navy/40 dark:placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-navy/20 dark:focus:ring-cream/20"
            placeholder={t('admin.announcements.titleLabel')}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy dark:text-cream mb-1">
            {t('admin.announcements.contentLabel')}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-navy/15 dark:border-cream/15 bg-white dark:bg-cream/5 px-4 py-2.5 text-sm text-navy dark:text-cream placeholder:text-navy/40 dark:placeholder:text-cream/40 focus:outline-none focus:ring-2 focus:ring-navy/20 dark:focus:ring-cream/20 resize-y"
            placeholder={t('admin.announcements.contentLabel')}
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !title.trim() || !content.trim()}
          className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {submitting ? t('common.loading') : t('admin.announcements.publishButton')}
        </button>
      </form>

      {/* List */}
      {loading && (
        <p className="text-sm text-navy/50 dark:text-cream/50 animate-pulse">
          {t('common.loading')}
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-navy/10 dark:border-cream/10 p-8 text-center">
          <p className="text-navy/50 dark:text-cream/50">
            {t('admin.announcements.empty')}
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-navy/10 dark:border-cream/10 bg-white/60 dark:bg-cream/5 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {item.author?.picture_url ? (
                    <img
                      src={item.author.picture_url}
                      alt={item.author.full_name || ''}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy dark:bg-cream/15 dark:text-cream">
                      {(item.author?.full_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-bold text-navy dark:text-cream">
                        {item.author?.full_name || t('announcements.unknownAuthor')}
                      </span>
                      <span className="text-xs text-navy/40 dark:text-cream/40">
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-bold text-navy dark:text-cream leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-navy/70 dark:text-cream/70 leading-relaxed whitespace-pre-wrap break-words">
                      {item.content}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminAnnouncements
