import { Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { submitJoinRequest } from '../../api/user'
import InterestTagsPicker from '../../components/forms/InterestTagsPicker'
import LanguageSelector from '../../components/controls/LanguageSelector'
import CitySelector from '../../components/controls/CitySelector'
import AuthGateCard from '../../components/ui/AuthGateCard'

function PendingApproval() {
  const { isAuthenticated, login, logout, user, authFetch, fetchUser, accessToken } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()
  const navigate = useNavigate()
  const [aboutMe, setAboutMe] = useState(user?.about_me || '')
  const [interestTags, setInterestTags] = useState(Array.isArray(user?.interest_tags) ? user.interest_tags : [])
  const [phoneCountryCode, setPhoneCountryCode] = useState('+48')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [sending, setSending] = useState(false)
  const FIRST_APPROVED_PLANS_KEY = 'approvedFirstPlanChoiceShown'

  const formatPhoneDisplay = (raw) => {
    const digits = raw.replace(/\D/g, '')
    return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
  }

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '')
    setPhoneNumber(digits)
  }

  const COUNTRY_CODES = [
    { code: '+48', label: '🇵🇱 +48' },
    { code: '+1', label: '🇺🇸 +1' },
    { code: '+44', label: '🇬🇧 +44' },
    { code: '+49', label: '🇩🇪 +49' },
    { code: '+31', label: '🇳🇱 +31' },
    { code: '+39', label: '🇮🇹 +39' },
    { code: '+33', label: '🇫🇷 +33' },
    { code: '+34', label: '🇪🇸 +34' },
    { code: '+86', label: '🇨🇳 +86' },
    { code: '+380', label: '🇺🇦 +380' },
    { code: '+91', label: '🇮🇳 +91' },
  ]

  useEffect(() => {
    setAboutMe(user?.about_me || '')
    setInterestTags(Array.isArray(user?.interest_tags) ? user.interest_tags : [])
  }, [user?.about_me, user?.interest_tags])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('approval.title')}
        message={t('approval.loginRequired')}
        actionLabel={t('approval.loginButton')}
        onAction={() => login({ returnTo: '/pending-approval' })}
      />
    )
  }

  if (user?.account_status === 'active') {
    const alreadyPrompted = localStorage.getItem(FIRST_APPROVED_PLANS_KEY) === '1'
    if (!alreadyPrompted) {
      localStorage.setItem(FIRST_APPROVED_PLANS_KEY, '1')
      return <Navigate to="/plans" replace />
    }
    return <Navigate to="/calendar" replace />
  }

  const requestSubmitted = Boolean(user?.approval_request_submitted)

  const canSubmit = aboutMe.trim().length > 0 && interestTags.length > 0

  const handleSubmitJoinRequest = async () => {
    if (!canSubmit || sending) return
    try {
      setSending(true)
      await submitJoinRequest(authFetch, {
        about_me: aboutMe.trim(),
        interest_tags: interestTags,
        phone_country_code: phoneCountryCode,
        phone_number: phoneNumber.trim(),
        admin_message: adminMessage.trim(),
      })
      if (accessToken) {
        await fetchUser(accessToken)
      }
      showSuccess(t('approval.joinRequestSent'))
    } catch (err) {
      showError(err.message || t('approval.joinRequestError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page-shell flex h-full min-h-0 flex-col gap-4 sm:gap-5">
      <div className="shrink-0 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
            {t('approval.title')}
          </h1>
          <p className="text-navy/60 dark:text-cream/60 mt-2">
            {t('approval.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="btn-accent shrink-0 h-10 px-5 text-sm"
        >
          {t('account.logout')}
        </button>
      </div>

      {!requestSubmitted ? (
        <section className="shrink-0 page-card space-y-4">
          <p className="text-navy/70 dark:text-cream/70">
            {t('approval.profileRequiredBody')}
          </p>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
              {t('approval.phoneLabel')}
            </p>
            <div className="flex gap-2">
              <select
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
                className="ui-input ui-input-compact w-28 shrink-0"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                type="tel"
                value={formatPhoneDisplay(phoneNumber)}
                onChange={handlePhoneChange}
                maxLength={20}
                className="ui-input ui-input-compact flex-1"
                placeholder={t('approval.phonePlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                {t('nav.city')}
              </p>
              <CitySelector />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                {t('common.language')}
              </p>
              <LanguageSelector />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
              {t('account.interests')}
            </p>
            <InterestTagsPicker value={interestTags} onChange={setInterestTags} t={t} />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
              {t('account.aboutMe')}
            </p>
            <textarea
              value={aboutMe}
              onChange={(e) => setAboutMe(e.target.value)}
              maxLength={800}
              rows={4}
              className="ui-input ui-input-compact"
              placeholder={t('account.aboutMePlaceholder')}
            />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
              {t('approval.adminMessageLabel')}
            </p>
            <textarea
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              maxLength={500}
              rows={2}
              className="ui-input ui-input-compact"
              placeholder={t('approval.adminMessagePlaceholder')}
            />
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={!canSubmit || sending}
              onClick={handleSubmitJoinRequest}
              className="btn-accent h-10 px-6 text-sm disabled:opacity-60"
            >
              {sending ? t('common.loading') : t('approval.submitJoinRequest')}
            </button>
          </div>
        </section>
      ) : (
        <section className="shrink-0 page-card">
          <p className="text-navy/70 dark:text-cream/70">
            {t('approval.description', { name: user?.full_name || '' })}
          </p>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className="font-semibold text-navy dark:text-cream">{t('approval.foundersLabel')}</span>
              <span className="text-navy/70 dark:text-cream/70">{t('approval.foundersNames')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="font-semibold text-navy dark:text-cream">{t('approval.emailLabel')}</span>
              <span className="text-navy/70 dark:text-cream/70">{t('approval.emailValue')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="font-semibold text-navy dark:text-cream">{t('approval.socialLabel')}</span>
              <span className="text-navy/70 dark:text-cream/70">{t('approval.socialValue')}</span>
            </div>
          </div>
        </section>
      )}

      {requestSubmitted && (
        <section className="shrink-0 page-card space-y-4">
          <h3 className="text-lg font-black text-navy dark:text-cream">
            {t('account.preferences') || 'Preferences'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                {t('nav.city')}
              </p>
              <CitySelector />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-navy/50 dark:text-cream/50">
                {t('common.language')}
              </p>
              <LanguageSelector />
            </div>
          </div>
        </section>
      )}

      {requestSubmitted && (
        <div className="shrink-0 p-5 rounded-2xl border border-dashed border-navy/20 dark:border-cream/20">
          <p className="text-navy/70 dark:text-cream/70">
            {t('approval.waitingHint')}
          </p>
        </div>
      )}
    </div>
  )
}

export default PendingApproval
