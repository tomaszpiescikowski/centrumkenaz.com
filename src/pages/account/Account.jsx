import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { fetchMyProfile, updateMyProfile } from '../../api/user'
import InterestTagsPicker from '../../components/forms/InterestTagsPicker'
import LanguageSelector from '../../components/controls/LanguageSelector'
import CitySelector from '../../components/controls/CitySelector'
import AuthGateCard from '../../components/ui/AuthGateCard'

function Account({ darkMode, setDarkMode }) {
  const { user, isAuthenticated, authFetch, login, logout, fetchUser, accessToken } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const navigate = useNavigate()
  const [aboutMe, setAboutMe] = useState('')
  const [originalAboutMe, setOriginalAboutMe] = useState('')
  const [interestTags, setInterestTags] = useState([])
  const [isEditingAboutMe, setIsEditingAboutMe] = useState(false)
  const [savingAboutMe, setSavingAboutMe] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)
  const [loading, setLoading] = useState(true)

  const activeSubscription = useMemo(() => {
    if (!user?.subscription_end_date) return false
    return new Date(user.subscription_end_date) >= new Date()
  }, [user])

  const currentPlanCode = useMemo(() => {
    if (!activeSubscription) return 'free'
    return user?.subscription_plan_code || 'pro'
  }, [activeSubscription, user])

  const currentPlanLabel = useMemo(() => {
    const key = `plans.plan.${currentPlanCode}.title`
    const label = t(key)
    return label || currentPlanCode
  }, [t, currentPlanCode])

  const subscriptionActivationLabel = useMemo(() => {
    if (activeSubscription && user?.subscription_end_date) {
      return t('plans.subscriptionActiveUntil', { date: formatShortDate(user.subscription_end_date) })
    }
    return t('plans.subscriptionInactive')
  }, [activeSubscription, user, t])

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    let cancelled = false
    const loadProfile = async () => {
      setLoading(true)
      try {
        const profile = await fetchMyProfile(authFetch)
        if (cancelled) return
        const aboutMeValue = profile.about_me || ''
        setAboutMe(aboutMeValue)
        setOriginalAboutMe(aboutMeValue)
        setInterestTags(Array.isArray(profile.interest_tags) ? profile.interest_tags : [])
      } catch (_err) {
        if (cancelled) return
        const aboutMeValue = user?.about_me || ''
        setAboutMe(aboutMeValue)
        setOriginalAboutMe(aboutMeValue)
        setInterestTags(Array.isArray(user?.interest_tags) ? user.interest_tags : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadProfile()
    return () => {
      cancelled = true
    }
  }, [authFetch, isAuthenticated, user?.id])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleSaveAboutMe = async () => {
    try {
      setSavingAboutMe(true)
      await updateMyProfile(authFetch, {
        about_me: aboutMe.trim(),
        interest_tags: interestTags,
      })
      const trimmedValue = aboutMe.trim()
      setOriginalAboutMe(trimmedValue)
      setAboutMe(trimmedValue)
      setIsEditingAboutMe(false)
      showSuccess(t('account.profileSaved'))
    } catch (err) {
      showError(err.message || t('account.profileSaveError'))
    } finally {
      setSavingAboutMe(false)
    }
  }

  const handleInterestsChange = async (newTags) => {
    setInterestTags(newTags)
    try {
      setSavingInterests(true)
      await updateMyProfile(authFetch, {
        about_me: aboutMe.trim(),
        interest_tags: newTags,
      })
    } catch (err) {
      showError(err.message || t('account.profileSaveError'))
    } finally {
      setSavingInterests(false)
    }
  }

  const handleEditAboutMe = () => {
    setIsEditingAboutMe(true)
  }

  const handleCancelEditAboutMe = () => {
    setAboutMe(originalAboutMe)
    setIsEditingAboutMe(false)
  }

  const aboutMeChanged = aboutMe.trim() !== originalAboutMe.trim()

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('account.title')}
        message={t('account.loginRequired')}
        actionLabel={t('account.loginButton')}
        onAction={() => login({ returnTo: '/me' })}
      />
    )
  }

  if (user?.account_status !== 'active') {
    return <Navigate to="/pending-approval" replace />
  }

  return (
    <div className="page-shell flex h-full min-h-0 flex-col gap-4 sm:gap-6">
      <div className="shrink-0 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-navy dark:text-cream md:text-4xl">
            {t('account.title')}
          </h1>
          <p className="text-navy/60 dark:text-cream/60">
            {t('account.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="btn-primary shrink-0 h-10 px-5 text-sm"
        >
          {t('account.logout')}
        </button>
      </div>

      <section className="shrink-0 rounded-2xl border border-navy/10 bg-cream/60 p-6 dark:border-cream/10 dark:bg-navy/60">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <h2 className="mb-4 text-xl font-black text-navy dark:text-cream">
              {t('account.profileTitle')}
            </h2>

            <div className="mb-5 flex items-center gap-4 rounded-2xl bg-navy/5 p-4 dark:bg-cream/10">
              {user?.picture_url ? (
                <img
                  src={user.picture_url}
                  alt={user?.full_name || 'User'}
                  className="h-16 w-16 min-h-16 min-w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy text-2xl font-bold text-cream dark:bg-cream dark:text-navy">
                  {user?.full_name?.charAt(0) || '?'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                  {t('account.name')}
                </p>
                <p className="truncate text-lg font-bold text-navy dark:text-cream">
                  {user?.full_name || '—'}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                  {t('account.email')}
                </p>
                <p className="truncate text-sm font-medium text-navy/80 dark:text-cream/80">
                  {user?.email || '—'}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-navy/10 bg-cream/50 p-4 dark:border-cream/15 dark:bg-navy/50">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                    {t('account.aboutMe')}
                  </p>
                  {!isEditingAboutMe ? (
                    <div className="group relative">
                      <div
                        onClick={handleEditAboutMe}
                        className="min-h-[100px] cursor-pointer rounded-2xl border border-navy/10 bg-cream px-4 py-3 text-navy transition-colors hover:border-navy/20 dark:border-cream/15 dark:bg-navy dark:text-cream dark:hover:border-cream/25"
                      >
                        {aboutMe || (
                          <span className="text-navy/50 dark:text-cream/50">
                            {t('account.aboutMePlaceholder')}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleEditAboutMe}
                        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-navy/10 text-navy opacity-0 transition-opacity hover:bg-navy/20 group-hover:opacity-100 dark:bg-cream/10 dark:text-cream dark:hover:bg-cream/20"
                        title={t('common.edit')}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <textarea
                        ref={(el) => el?.focus()}
                        value={aboutMe}
                        onChange={(e) => setAboutMe(e.target.value)}
                        maxLength={800}
                        rows={4}
                        className="ui-input ui-input-compact pr-16"
                        placeholder={t('account.aboutMePlaceholder')}
                      />
                      {aboutMeChanged && (
                        <button
                          type="button"
                          onClick={handleSaveAboutMe}
                          disabled={savingAboutMe}
                          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-navy text-cream transition-all hover:scale-110 disabled:opacity-60 dark:bg-cream dark:text-navy"
                          title={t('common.save')}
                        >
                          {savingAboutMe ? (
                            <span className="text-xs">...</span>
                          ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )}
                      {!aboutMeChanged && (
                        <button
                          type="button"
                          onClick={handleCancelEditAboutMe}
                          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-navy/10 text-navy transition-all hover:bg-navy/20 dark:bg-cream/10 dark:text-cream dark:hover:bg-cream/20"
                          title={t('common.cancel')}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                    {t('account.interests')}
                  </p>
                  <InterestTagsPicker value={interestTags} onChange={handleInterestsChange} t={t} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                      {t('common.theme') || 'Motyw'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDarkMode(!darkMode)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-navy/10 bg-cream px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-navy/20 dark:border-cream/15 dark:bg-navy dark:text-cream dark:hover:border-cream/25"
                    >
                      {darkMode ? (
                        <>
                          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                          </svg>
                          {t('common.themeDark') || 'Ciemny'}
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                          </svg>
                          {t('common.themeLight') || 'Jasny'}
                        </>
                      )}
                    </button>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                      {t('nav.city')}
                    </p>
                    <CitySelector />
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                      {t('common.language') || 'Language'}
                    </p>
                    <LanguageSelector />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-navy/10 bg-cream/50 p-4 dark:border-cream/15 dark:bg-navy/50">
            <h3 className="text-lg font-black text-navy dark:text-cream">
              {t('account.manageSubscription')}
            </h3>
            <p className="mt-1 text-sm text-navy/70 dark:text-cream/70">
              {t('plans.subtitle')}
            </p>

            <div className="mt-4 grid gap-3 text-sm">
              <InfoRow label={t('account.points')} value={String(user?.points ?? 0)} />
              <InfoRow label={t('account.subscriptionPlan')} value={currentPlanLabel} />
              <InfoRow
                label={t('account.subscription')}
                value={activeSubscription ? t('account.subscriptionActive') : t('account.subscriptionInactive')}
              />
            </div>

            <p className="mt-4 rounded-xl bg-navy/5 px-3 py-2 text-sm text-navy/80 dark:bg-cream/10 dark:text-cream/80">
              {subscriptionActivationLabel}
            </p>

            <div className="mt-4">
              <Link
                to="/plans"
                className="btn-primary h-10 px-5 text-sm"
              >
                {t('account.manageSubscription')}
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">{label}</p>
      <p className="text-base font-semibold text-navy dark:text-cream">{value}</p>
    </div>
  )
}

function formatShortDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default Account
