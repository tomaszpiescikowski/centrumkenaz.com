import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { fetchMyProfile, updateMyProfile, fetchPendingSubscriptionPurchase } from '../../api/user'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import InterestTagsPicker from '../../components/forms/InterestTagsPicker'
import LanguageSelector from '../../components/controls/LanguageSelector'
import CitySelector from '../../components/controls/CitySelector'
import AuthGateCard from '../../components/ui/AuthGateCard'

function Account({ darkMode, setDarkMode }) {
  const { user, isAuthenticated, authFetch, login, logout, fetchUser, accessToken, connectGoogleCalendar, loading: authLoading } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const isActive = isAuthenticated && user?.account_status === 'active'
  const { supported: pushSupported, permission: pushPermission, subscribed: pushSubscribed, subscribing: pushSubscribing, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe, error: pushError } = usePushNotifications({ authFetch, isActive })

  // After calendar connect redirect (?calendar=connected) re-fetch the user
  // so has_google_calendar flips to true, then clean the URL.
  useEffect(() => {
    if (searchParams.get('calendar') === 'connected') {
      fetchUser(accessToken)
      showSuccess(t('account.calendarConnected') || 'Połączono z Google Calendar')
      navigate('/me', { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [aboutMe, setAboutMe] = useState('')
  const [originalAboutMe, setOriginalAboutMe] = useState('')
  const [interestTags, setInterestTags] = useState([])
  const [isEditingAboutMe, setIsEditingAboutMe] = useState(false)
  const [savingAboutMe, setSavingAboutMe] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingPurchase, setPendingPurchase] = useState(null)

  const activeSubscription = useMemo(() => {
    if (!user?.subscription_end_date) return false
    return new Date(user.subscription_end_date) >= new Date()
  }, [user])

  const currentPlanCode = useMemo(() => {
    if (!activeSubscription) return 'free'
    return user?.subscription_plan_code || 'monthly'
  }, [activeSubscription, user])

  const currentPlanLabel = useMemo(() => {
    const key = `plans.plan.${currentPlanCode}.title`
    const label = t(key)
    return label || currentPlanCode
  }, [t, currentPlanCode])

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    let cancelled = false
    const loadProfile = async () => {
      setLoading(true)
      try {
        const [profile, pending] = await Promise.all([
          fetchMyProfile(authFetch),
          fetchPendingSubscriptionPurchase(authFetch).catch(() => null),
        ])
        if (cancelled) return
        const aboutMeValue = profile.about_me || ''
        setAboutMe(aboutMeValue)
        setOriginalAboutMe(aboutMeValue)
        setInterestTags(Array.isArray(profile.interest_tags) ? profile.interest_tags : [])
        setPendingPurchase(pending)
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

  if (authLoading) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy dark:border-cream" />
      </div>
    )
  }

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
    <div className="page-shell flex flex-col gap-4 sm:gap-6">
      <div className="shrink-0 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
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

      <section className="shrink-0">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl border border-navy/10 bg-[rgba(255,251,235,0.82)] p-4 dark:border-cream/15 dark:bg-[rgba(15,23,74,0.68)]">
            <h2 className="mb-4 text-xl font-black text-navy dark:text-cream">
              {t('account.profileTitle')}
            </h2>

            <div className="mb-5 flex items-center gap-4 pb-5 border-b border-navy/8 dark:border-cream/8">
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
                <p className="text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                  {t('account.name')}
                </p>
                <p className="truncate text-lg font-bold text-navy dark:text-cream">
                  {user?.full_name || '—'}
                </p>
                <p className="mt-1 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                  {t('account.email')}
                </p>
                <p className="truncate text-sm font-medium text-navy/80 dark:text-cream/80">
                  {user?.email || '—'}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                    {t('account.aboutMe')}
                  </p>
                  {!isEditingAboutMe ? (
                    <div className="group relative">
                      <div
                        onClick={handleEditAboutMe}
                        className="min-h-[100px] cursor-pointer rounded-xl border border-navy/15 bg-navy/5 px-4 py-3 text-navy transition-colors dark:border-cream/15 dark:bg-cream/8 dark:text-cream"
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
                  <p className="mb-2 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                    {t('account.interests')}
                  </p>
                  <InterestTagsPicker value={interestTags} onChange={handleInterestsChange} t={t} />
                </div>
                <div className="pt-1 border-t border-navy/8 dark:border-cream/8">
                  <p className="mb-1.5 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                    {t('account.googleCalendar')}
                  </p>
                  {user?.has_google_calendar ? (
                    <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 dark:border-green-400/30 dark:bg-green-900/20 dark:text-green-300">
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('account.calendarConnected')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-navy/60 dark:text-cream/60">
                        {t('account.calendarDescription')}
                      </p>
                      <button
                        type="button"
                        onClick={connectGoogleCalendar}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-navy/25 hover:bg-navy/5 dark:border-cream/15 dark:bg-navy dark:text-cream dark:hover:border-cream/25"
                      >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
                        </svg>
                        {t('account.connectCalendar')}
                      </button>
                    </div>
                  )}
                </div>

                {pushSupported && (
                  <div className="pt-1 border-t border-navy/8 dark:border-cream/8">
                    <p className="mb-1.5 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                      {t('account.pushNotifications') || 'Powiadomienia push'}
                    </p>
                    {pushError && (
                      <div className="mb-2 rounded-xl border border-red-300/40 bg-red-50/80 px-3 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300">
                        <span className="font-semibold">Błąd: </span>{pushError}
                      </div>
                    )}
                    {pushPermission === 'denied' ? (
                      <div className="flex w-full items-center gap-2.5 rounded-xl border border-red-300/40 bg-red-50/80 px-4 py-2.5 text-sm font-semibold text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300">
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        {t('account.pushDenied') || 'Zablokowane w ustawieniach przeglądarki'}
                      </div>
                    ) : pushSubscribed ? (
                      <button
                        type="button"
                        onClick={pushUnsubscribe}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-green-500/30 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 transition-colors hover:border-green-500/50 hover:bg-green-100/80 dark:border-green-400/30 dark:bg-green-900/20 dark:text-green-300 dark:hover:border-green-400/50"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
                        </svg>
                        {t('account.pushSubscribed') || 'Powiadomienia włączone'}
                        <span className="ml-auto text-xs font-normal opacity-60">{t('account.pushClickToDisable') || 'kliknij aby wyłączyć'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pushSubscribe}
                        disabled={pushSubscribing}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-navy/10 bg-cream px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-navy/20 hover:bg-navy/5 disabled:opacity-60 dark:border-cream/15 dark:bg-navy dark:text-cream dark:hover:border-cream/25"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
                        </svg>
                        {pushSubscribing ? (t('common.loading') || '…') : (t('account.pushSubscribe') || 'Włącz powiadomienia push')}
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="mb-2 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
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
                    <p className="mb-2 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                      {t('nav.city')}
                    </p>
                    <CitySelector />
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">
                      {t('common.language') || 'Language'}
                    </p>
                    <LanguageSelector />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="flex flex-col rounded-2xl border border-navy/10 bg-[rgba(255,251,235,0.82)] p-4 dark:border-cream/15 dark:bg-[rgba(15,23,74,0.68)]">
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

            <div className="xl:mt-auto">
              <div className="mt-4 flex flex-col rounded-xl bg-navy/5 px-3 py-2 text-sm text-navy/80 dark:bg-cream/10 dark:text-cream/80">
                <span>{activeSubscription ? t('plans.subscriptionActiveUntilLabel') : t('plans.subscriptionInactive')}</span>
                {activeSubscription && user?.subscription_end_date && (
                  <span className="font-semibold text-navy dark:text-cream">
                    {formatShortDate(user.subscription_end_date)}
                  </span>
                )}
              </div>

              <div className="mt-4">
                <Link
                  to="/plans"
                  className="inline-flex h-10 w-full items-center justify-center rounded-full bg-accent-red px-5 text-sm font-semibold text-white hover:bg-[#C83C2A] transition-colors"
                >
                  {t('account.manageSubscription')}
                </Link>
              </div>

              {pendingPurchase && pendingPurchase.status === 'manual_payment_required' && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-100/70 p-3 text-xs text-amber-900 dark:border-amber-300/40 dark:bg-amber-900/30 dark:text-amber-100">
                  <p className="font-semibold">{t('account.pendingSubscriptionTitle')}</p>
                  <Link
                    to={`/subscription-purchases/${pendingPurchase.purchase_id}/manual-payment`}
                    className="mt-1 inline-block font-semibold underline"
                  >
                    {t('account.pendingSubscriptionLink')}
                  </Link>
                </div>
              )}

              {pendingPurchase && pendingPurchase.status === 'manual_payment_verification' && (
                <div className="mt-3 rounded-xl border border-sky-500/30 bg-sky-100/70 p-3 text-xs text-sky-900 dark:border-sky-300/40 dark:bg-sky-900/30 dark:text-sky-100">
                  <p className="font-semibold">{t('account.verificationSubscriptionTitle')}</p>
                  <p className="mt-1">{t('account.verificationSubscriptionBody')}</p>
                </div>
              )}
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
      <p className="text-[11px] font-medium tracking-[0.03em] text-navy/40 dark:text-cream/40">{label}</p>
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
