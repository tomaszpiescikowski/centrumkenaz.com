import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { fetchUserProfileById } from '../../api/user'
import { INTEREST_TAGS } from '../../constants/interestTags'
import EventIcon from '../../components/common/EventIcon'
import { TAG_COLORS } from '../../constants/interestTags'
import AuthGateCard from '../../components/ui/AuthGateCard'

function UserProfile() {
  const { userId } = useParams()
  const { authFetch, isAuthenticated, login } = useAuth()
  const { t } = useLanguage()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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
    </div>
  )
}

export default UserProfile
