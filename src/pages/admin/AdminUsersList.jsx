import { Link } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { fetchAllUsers, blockUser, unblockUser } from '../../api/admin'
import AuthGateCard from '../../components/ui/AuthGateCard'

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function StatusBadge({ status, t }) {
  const map = {
    active:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    banned:  'bg-[#EB4731]/10 text-[#EB4731] dark:bg-[#EB4731]/20 dark:text-[#EB4731]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${map[status] || map.pending}`}>
      {t(`admin.usersList.status.${status}`)}
    </span>
  )
}

function RoleBadge({ role, t }) {
  const map = {
    admin:  'bg-navy/10 text-navy dark:bg-cream/10 dark:text-cream',
    member: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    guest:  'bg-navy/5 text-navy/50 dark:bg-cream/5 dark:text-cream/50',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${map[role] || map.guest}`}>
      {t(`admin.usersList.role.${role}`)}
    </span>
  )
}

function AdminUsersList() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [subscriberFilter, setSubscriberFilter] = useState('all')
  const [pendingId, setPendingId] = useState(null)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchAllUsers(authFetch)
        if (!cancelled) setUsers(data)
      } catch (err) {
        if (!cancelled) showError(err.message || t('admin.usersList.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authFetch, isAdmin, isAuthenticated, t, showError])

  const now = useMemo(() => new Date(), [])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      const matchesQuery = !q
        || (u.full_name || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || u.account_status === statusFilter
      const isSubscriber = u.subscription_end_date && new Date(u.subscription_end_date) > now
      const matchesSubscriber = subscriberFilter === 'all'
        || (subscriberFilter === 'subscriber' && isSubscriber)
        || (subscriberFilter === 'non-subscriber' && !isSubscriber)
      return matchesQuery && matchesStatus && matchesSubscriber
    })
  }, [users, query, statusFilter, subscriberFilter, now])

  const handleBlock = async (userId) => {
    setPendingId(userId)
    try {
      const updated = await blockUser(authFetch, userId)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, account_status: updated.account_status } : u))
      showSuccess(t('admin.usersList.blockSuccess'))
    } catch (err) {
      showError(err.message || t('admin.usersList.blockError'))
    } finally {
      setPendingId(null)
    }
  }

  const handleUnblock = async (userId) => {
    setPendingId(userId)
    try {
      const updated = await unblockUser(authFetch, userId)
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, account_status: updated.account_status } : u))
      showSuccess(t('admin.usersList.unblockSuccess'))
    } catch (err) {
      showError(err.message || t('admin.usersList.unblockError'))
    } finally {
      setPendingId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.usersList.title')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/all-users' })}
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
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70">
        <span>←</span> {t('admin.backToDashboard')}
      </Link>

      <div className="mt-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
          {t('admin.usersList.title')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60 mt-1">
          {t('admin.usersList.subtitle')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.usersList.searchPlaceholder')}
          className="ui-input ui-input-compact flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ui-input ui-input-compact sm:w-44"
        >
          <option value="all">{t('admin.usersList.filterAll')}</option>
          <option value="active">{t('admin.usersList.status.active')}</option>
          <option value="pending">{t('admin.usersList.status.pending')}</option>
          <option value="banned">{t('admin.usersList.status.banned')}</option>
        </select>
        <select
          value={subscriberFilter}
          onChange={(e) => setSubscriberFilter(e.target.value)}
          className="ui-input ui-input-compact sm:w-48"
        >
          <option value="all">Wszyscy</option>
          <option value="subscriber">Subskrybenci</option>
          <option value="non-subscriber">Bez subskrypcji</option>
        </select>
      </div>

      {loading ? (
        <p className="text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-navy/20 dark:border-cream/20">
          <p className="text-navy/70 dark:text-cream/70">{t('admin.usersList.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const isSelf = u.id === user?.id
            const isBlocked = u.account_status === 'banned'
            const isActive = u.account_status === 'active'
            const busy = pendingId === u.id
            return (
              <div key={u.id} className="page-card flex items-center gap-3">
                {/* Avatar + Info — clickable link to profile */}
                <Link to={`/people/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                  <div className="shrink-0">
                    {u.picture_url ? (
                      <img src={u.picture_url} alt={u.full_name || ''} className="w-10 h-10 rounded-full object-cover border border-navy/10 dark:border-cream/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-navy/10 dark:bg-cream/10 flex items-center justify-center text-sm font-bold text-navy/50 dark:text-cream/50">
                        {initials(u.full_name)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-navy dark:text-cream text-sm truncate">
                        {u.full_name || t('admin.usersList.noName')}
                      </span>
                      <RoleBadge role={u.role} t={t} />
                      <StatusBadge status={u.account_status} t={t} />
                    </div>
                    <p className="text-xs text-navy/50 dark:text-cream/50 truncate">{u.email}</p>
                  </div>
                </Link>

                {/* Action */}
                {!isSelf && u.role !== 'admin' && (
                  <div className="shrink-0">
                    {isBlocked ? (
                      <button
                        onClick={() => handleUnblock(u.id)}
                        disabled={busy}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold bg-navy/10 text-navy dark:bg-cream/10 dark:text-cream hover:bg-navy/20 dark:hover:bg-cream/20 transition disabled:opacity-40"
                      >
                        {busy ? '…' : t('admin.usersList.unblockButton')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBlock(u.id)}
                        disabled={busy}
                        className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#EB4731]/10 text-[#EB4731] hover:bg-[#EB4731]/20 transition disabled:opacity-40"
                      >
                        {busy ? '…' : t('admin.usersList.blockButton')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-navy/40 dark:text-cream/40">
        {t('admin.usersList.count', { count: filtered.length })}
      </p>
    </div>
  )
}

export default AdminUsersList
