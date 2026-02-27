import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { fetchUserProfileById } from '../../api/user'
import { fetchAdminUserDetail } from '../../api/admin'
import { INTEREST_TAGS } from '../../constants/interestTags'
import EventIcon from '../../components/common/EventIcon'
import { TAG_COLORS } from '../../constants/interestTags'
import AuthGateCard from '../../components/ui/AuthGateCard'

function UserProfile() {
  const { userId } = useParams()
  const { authFetch, isAuthenticated, login, user } = useAuth()
  const { t } = useLanguage()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adminDetail, setAdminDetail] = useState(null)
  const [adminLoading, setAdminLoading] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchUserProfileById(authFetch, userId)
        if (!cancelled) setProfile(data)
      } catch (_error) {
        if (!cancelled) setProfile(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [authFetch, isAuthenticated, userId])

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !userId) return
    let cancelled = false
    const loadAdmin = async () => {
      setAdminLoading(true)
      try {
        const data = await fetchAdminUserDetail(authFetch, userId)
        if (!cancelled) setAdminDetail(data)
      } catch (_err) {
        // silently ignore — admin tile simply won't show
      } finally {
        if (!cancelled) setAdminLoading(false)
      }
    }
    loadAdmin()
    return () => { cancelled = true }
  }, [authFetch, isAuthenticated, isAdmin, userId])

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('calendar.loginRequiredTitle')}
        message={t('calendar.loginRequiredBody')}
        actionLabel={t('calendar.loginRequiredButton')}
        onAction={() => login({ returnTo: `/people/${userId}` })}
        centered
      />
    )
  }

  if (loading) {
    return (
      <div className="page-shell text-sm text-navy/70 dark:text-cream/70">
        {t('common.loading')}
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="page-shell">
        <div className="page-card">
          <p className="text-sm text-navy/70 dark:text-cream/70">{t('profile.notFound')}</p>
          <Link to="/calendar" className="mt-4 inline-flex text-sm font-semibold text-navy dark:text-cream">
            {t('common.backToCalendar')}
          </Link>
        </div>
      </div>
    )
  }

  const visibleTags = Array.isArray(profile.interest_tags)
    ? profile.interest_tags.filter((tag) => INTEREST_TAGS.includes(tag))
    : []

  return (
    <div className="page-shell">
      <Link
        to="/calendar"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-navy/70 hover:text-navy dark:text-cream/70 dark:hover:text-cream"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('common.backToCalendar')}
      </Link>

      <div className="page-card">
        <div className="flex items-center gap-3">
          {profile.picture_url ? (
            <img src={profile.picture_url} alt={profile.full_name} className="h-14 w-14 min-h-14 min-w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-bold text-cream dark:bg-cream dark:text-navy">
              {profile.full_name?.charAt(0) || '?'}
            </div>
          )}
          <h1 className="text-xl font-black text-navy dark:text-cream">{profile.full_name}</h1>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">{t('profile.about')}</p>
          <p className="mt-2 text-sm text-navy/85 dark:text-cream/85">{profile.about_me || t('profile.noAbout')}</p>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">{t('profile.interests')}</p>
          {visibleTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="ui-tag-chip ui-tag-chip-idle"
                >
                  <span className={TAG_COLORS[tag] || ''}>
                    <EventIcon type={tag} size="xs" />
                  </span>
                  <span>{t(`eventTypes.${tag}`)}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-navy/65 dark:text-cream/65">{t('profile.noInterests')}</p>
          )}
        </div>
      </div>

      {/* Admin detail tile */}
      {isAdmin && (
        <div className="mt-4 page-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center rounded-full bg-navy/10 dark:bg-cream/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-widest text-navy dark:text-cream">
              Admin
            </span>
            <span className="text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
              Szczegóły użytkownika
            </span>
          </div>

          {adminLoading ? (
            <p className="text-sm text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
          ) : adminDetail ? (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <AdminStat label="Ostatnia aktywność" value={formatAdminDate(adminDetail.last_active_at)} />
                <AdminStat label="Konto od" value={formatAdminDate(adminDetail.created_at)} />
                <AdminStat label="Rola / Status" value={`${adminDetail.role} / ${adminDetail.account_status}`} />
                <AdminStat label="Punkty Kenaz" value={adminDetail.kenaz_points} accent />
                <AdminStat label="Zapisanych wydarzeń" value={adminDetail.event_count} />
                <AdminStat
                  label="Subskrypcja"
                  value={
                    adminDetail.subscription_active
                      ? `aktywna do ${formatAdminDate(adminDetail.subscription_end_date)}`
                      : adminDetail.subscription_end_date
                        ? `wygasła ${formatAdminDate(adminDetail.subscription_end_date)}`
                        : 'brak'
                  }
                  highlight={adminDetail.subscription_active}
                />
                <AdminStat label="Wpłacono (wydarzenia)" value={adminDetail.total_paid_events} />
                <AdminStat label="Wpłacono (subskrypcje)" value={adminDetail.total_paid_subscriptions} />
                <AdminStat label="Wpłacono łącznie" value={adminDetail.total_paid_all} accent />
                <AdminStat label="Wsparcia (zatwierdzone)" value={adminDetail.total_donations} />
              </div>

              {/* Pending actions */}
              {adminDetail.pending_actions.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40 mb-2">
                    Oczekujące akcje
                  </p>
                  <div className="flex flex-col gap-2">
                    {adminDetail.pending_actions.map((action) => (
                      <div
                        key={action.type}
                        className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2"
                      >
                        <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                          {action.label}
                        </span>
                        {action.count > 1 && (
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-200 dark:bg-amber-800/50 rounded-full px-2 py-0.5">
                            ×{action.count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

function AdminStat({ label, value, accent, highlight }) {
  return (
    <div className="rounded-xl bg-navy/5 dark:bg-cream/5 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-navy/40 dark:text-cream/40 mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm font-semibold truncate ${
          highlight
            ? 'text-green-700 dark:text-green-400'
            : accent
              ? 'text-navy dark:text-cream'
              : 'text-navy/80 dark:text-cream/80'
        }`}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

function formatAdminDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default UserProfile
