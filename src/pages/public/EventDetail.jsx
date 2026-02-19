import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../context/NotificationContext'
import { deleteEvent, fetchEventById, fetchRegisteredEventIds, updateEvent } from '../../api/events'
import EventIcon from '../../components/common/EventIcon'
import ParticipantsTable from '../../components/common/ParticipantsTable'
import RegisterButton from '../../components/forms/RegisterButton'
import DatePickerField from '../../components/forms/DatePickerField'
import AuthGateCard from '../../components/ui/AuthGateCard'

function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t, currentLanguage } = useLanguage()
  const { user, isAuthenticated, authFetch, login } = useAuth()
  const { showSuccess, showError, showConfirm } = useNotification()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registeredIds, setRegisteredIds] = useState(new Set())

  const [participantCount, setParticipantCount] = useState(0)
  const [participantsRefreshKey, setParticipantsRefreshKey] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [adminForm, setAdminForm] = useState(null)
  const [fieldHints, setFieldHints] = useState({})
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [deletingAdmin, setDeletingAdmin] = useState(false)
  const isAdmin = user?.role === 'admin'

  const refreshRegisteredIds = async () => {
    if (!isAuthenticated || user?.account_status !== 'active') {
      setRegisteredIds(new Set())
      return
    }
    try {
      const ids = await fetchRegisteredEventIds(authFetch)
      setRegisteredIds(new Set(ids))
    } catch (_error) {
      setRegisteredIds(new Set())
    }
  }

  useEffect(() => {
    // Check for payment success/cancel in URL
    const paymentStatus = searchParams.get('payment')
    if (paymentStatus === 'success') {
      showSuccess(t('event.registrationSuccessSubtitle'), {
        title: t('event.registrationSuccessTitle'),
      })
      setParticipantsRefreshKey((k) => k + 1)
      // Clear the URL parameter
      window.history.replaceState({}, '', `/event/${id}`)
    }
  }, [searchParams, id, t, showSuccess])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!isAuthenticated || user?.account_status !== 'active') {
        setEvent(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const data = await fetchEventById(id, authFetch)
        if (!cancelled) setEvent(data)
      } catch (e) {
        console.error('Failed to load event:', e)
        if (!cancelled) setEvent(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, isAuthenticated, user, authFetch])

  useEffect(() => {
    refreshRegisteredIds()
  }, [user, isAuthenticated, authFetch])

  useEffect(() => {
    if (!event) return
    const toLocalDateTimeInput = (isoValue) => {
      if (!isoValue) return ''
      const date = new Date(isoValue)
      if (Number.isNaN(date.getTime())) return ''
      const offsetMs = date.getTimezoneOffset() * 60000
      return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
    }
    setAdminForm({
      title: event.title || '',
      description: event.description || '',
      event_type: event.type || 'mors',
      start_date: toLocalDateTimeInput(event.startDateTime),
      end_date: toLocalDateTimeInput(event.endDateTime),
      time_info: event.time || '',
      city: event.city || '',
      location: event.location || '',
      price_guest: String(event.priceGuest ?? 0),
      price_member: String(event.priceMember ?? 0),
      manual_payment_verification: true,
      manual_payment_url: event.manualPaymentUrl || '',
      manual_payment_due_hours: String(event.manualPaymentDueHours ?? 24),
      max_participants: event.maxParticipants ? String(event.maxParticipants) : '',
      requires_subscription: Boolean(event.requiresSubscription),
    })
    setFieldHints({})
  }, [event])

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center">
        <div className="w-full">
          <AuthGateCard
            title={t('calendar.loginRequiredTitle')}
            message={t('calendar.loginRequiredBody')}
            actionLabel={t('calendar.loginRequiredButton')}
            onAction={() => login({ returnTo: `/event/${id}` })}
            centered
          />
        </div>
      </div>
    )
  }

  if (user?.account_status !== 'active') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center">
        <div className="w-full">
          <AuthGateCard
            title={t('calendar.pendingRequiredTitle')}
            message={t('calendar.pendingRequiredBody')}
            actionLabel={t('calendar.pendingRequiredButton')}
            actionTo="/pending-approval"
            centered
          />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-shell flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-navy/70 dark:text-cream/70">{t('common.loading')}</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold mb-4 text-navy dark:text-cream">
          {t('event.notFound')}
        </h1>
        <Link
          to="/calendar"
          className="px-6 py-3 rounded-full font-bold
            btn-primary"
        >
          {t('common.backToCalendar')}
        </Link>
      </div>
    )
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const locale = currentLanguage === 'pl' ? 'pl-PL' : 'en-GB'
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatPrice = (price) => {
    if (price === 0) return t('common.free')
    return `${price} ${t('common.currency')}`
  }

  const mapsQuery = event.location || `${event.title} ${event.city}`
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`

  const selectedOccurrenceDate = event.date
  const selectedEndDate = event.endDate || null

  // Determine price based on user role
  const userPrice = event.requiresSubscription
    ? event.priceMember
    : (user?.role === 'member' ? event.priceMember : event.priceGuest)
  const maxParticipants = event.maxParticipants ?? null
  const isFull = maxParticipants !== null && participantCount >= maxParticipants
  const isRegistered = registeredIds.has(event.id)
  const occurrenceStart = event.startDateTime ? new Date(event.startDateTime) : null
  const isPast = occurrenceStart && !Number.isNaN(occurrenceStart.getTime())
    ? occurrenceStart < new Date()
    : false
  const baseAdminInputClass = 'ui-input'
  const validationHintClass = 'ui-field-hint'
  const validationBorderClass = 'ui-input-invalid'
  const adminInputClassFor = (fieldKey, extra = '') =>
    `${baseAdminInputClass} ${fieldHints[fieldKey] ? validationBorderClass : ''} ${extra}`.trim()

  const handleRegistrationSuccess = () => {
    // Trigger refresh of participants table
    setParticipantsRefreshKey((k) => k + 1)
    refreshRegisteredIds()
  }

  const clearFieldHint = (key) => {
    setFieldHints((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const setFieldHint = (key, hintKey) => {
    setFieldHints((prev) => ({ ...prev, [key]: hintKey }))
  }

  const handleAdminChange = (key, value) => {
    clearFieldHint(key)
    setAdminForm((prev) => ({ ...prev, [key]: value }))
  }

  const setAdminValue = (key, value) => {
    setAdminForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleAdminNonNegativeNumberChange = (key, value) => {
    if (value === '') {
      clearFieldHint(key)
      setAdminValue(key, '')
      return
    }
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      setAdminValue(key, value)
      return
    }
    if (parsed < 0) {
      setFieldHint(key, 'admin.validation.nonNegative')
      setAdminValue(key, '0')
      return
    }
    clearFieldHint(key)
    setAdminValue(key, value)
  }

  const handleAdminMinOneNumberChange = (key, value) => {
    if (value === '') {
      clearFieldHint(key)
      setAdminValue(key, '')
      return
    }
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      setAdminValue(key, value)
      return
    }
    if (parsed < 1) {
      setFieldHint(key, 'admin.validation.minOne')
      setAdminValue(key, '1')
      return
    }
    clearFieldHint(key)
    setAdminValue(key, value)
  }

  const handleAdminSave = async () => {
    if (!adminForm || !isAdmin) return
    const requiredHints = {}
    if (!adminForm.title.trim()) requiredHints.title = 'admin.validationRequired'
    if (!adminForm.start_date) requiredHints.start_date = 'admin.validationRequired'
    if (!adminForm.city.trim()) requiredHints.city = 'admin.validationRequired'
    const hasPaidPrice = Number(adminForm.requires_subscription ? adminForm.price_member : adminForm.price_guest) > 0
      || Number(adminForm.price_member || 0) > 0
    if (adminForm.manual_payment_verification && hasPaidPrice && !adminForm.manual_payment_url.trim()) {
      requiredHints.manual_payment_url = 'admin.validationRequired'
    }
    if (Object.keys(requiredHints).length > 0) {
      setFieldHints((prev) => ({ ...prev, ...requiredHints }))
      showError(t('admin.validationRequired'))
      return
    }

    const startDateCandidate = new Date(adminForm.start_date)
    if (!Number.isNaN(startDateCandidate.getTime()) && startDateCandidate < new Date()) {
      setFieldHints((prev) => ({ ...prev, start_date: 'admin.validation.notPastDate' }))
      showError(t('admin.validation.notPastDate'))
      return
    }
    try {
      setSavingAdmin(true)
      const payload = {
        title: adminForm.title.trim(),
        description: adminForm.description.trim() || null,
        event_type: adminForm.event_type,
        start_date: adminForm.start_date ? new Date(adminForm.start_date).toISOString() : null,
        end_date: adminForm.end_date ? new Date(adminForm.end_date).toISOString() : null,
        time_info: adminForm.time_info.trim() || null,
        city: adminForm.city.trim(),
        location: adminForm.location.trim() || null,
        price_guest: adminForm.requires_subscription ? 0 : Number(adminForm.price_guest || 0),
        price_member: Number(adminForm.price_member || 0),
        manual_payment_verification: true,
        manual_payment_url: adminForm.manual_payment_url.trim()
          ? adminForm.manual_payment_url.trim()
          : null,
        manual_payment_due_hours: Number(adminForm.manual_payment_due_hours || 24),
        max_participants: adminForm.max_participants ? Number(adminForm.max_participants) : null,
        requires_subscription: adminForm.requires_subscription,
      }
      const updated = await updateEvent(authFetch, event.id, payload)
      setEvent(updated)
      setIsEditing(false)
      showSuccess(t('event.adminUpdateSuccess'))
    } catch (err) {
      showError(err.message || t('event.adminUpdateError'))
    } finally {
      setSavingAdmin(false)
    }
  }

  const handleAdminDelete = async () => {
    if (!isAdmin) return
    showConfirm(t('event.adminDeleteConfirm'), {
      actions: [
        {
          label: t('common.close'),
          variant: 'neutral',
        },
        {
          label: t('event.adminDelete'),
          variant: 'danger',
          onClick: async () => {
            try {
              setDeletingAdmin(true)
              await deleteEvent(authFetch, event.id)
              showSuccess(t('event.adminDeleteSuccess'))
              navigate('/calendar')
            } catch (err) {
              showError(err.message || t('event.adminDeleteError'))
            } finally {
              setDeletingAdmin(false)
            }
          },
        },
      ],
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4 sm:py-6">
      {/* Back button */}
      <Link
        to="/calendar"
        className="mb-6 inline-flex items-center gap-2 font-medium
          text-navy/70 dark:text-cream/70 hover:text-navy dark:hover:text-cream"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('common.backToCalendar')}
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
        <div className="lg:col-span-2">
          {/* Event header */}
          <div className="mb-4 rounded-2xl border border-navy/10 bg-cream/75 p-5 dark:border-cream/15 dark:bg-navy/75">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-navy/10 p-3 dark:bg-cream/20">
            <EventIcon type={event.type} size="lg" />
          </div>
          <div>
            <h1 className="mb-1 text-xl font-black text-navy dark:text-cream sm:text-2xl">
              {event.title}
            </h1>
            <p className="text-sm text-navy/70 dark:text-cream/70">
              {event.city}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => setIsEditing((prev) => !prev)}
              className="px-4 py-2 rounded-full text-sm font-semibold btn-primary"
            >
              {isEditing ? t('event.adminCancelEdit') : t('event.adminEdit')}
            </button>
            <button
              onClick={handleAdminDelete}
              disabled={deletingAdmin}
              className="px-4 py-2 rounded-full text-sm font-semibold btn-secondary disabled:opacity-60"
            >
              {deletingAdmin ? t('common.loading') : t('event.adminDelete')}
            </button>
          </div>
        )}

        {isAdmin && isEditing && adminForm && (
          <div className="mb-6 space-y-4 rounded-2xl border border-navy/20 bg-cream/70 p-4 dark:border-cream/20 dark:bg-navy/70">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.title')}
                <input
                  type="text"
                  value={adminForm.title}
                  onChange={(e) => handleAdminChange('title', e.target.value)}
                  className={adminInputClassFor('title')}
                />
                {fieldHints.title && (
                  <p className={validationHintClass}>{t(fieldHints.title)}</p>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.eventType')}
                <select
                  value={adminForm.event_type}
                  onChange={(e) => handleAdminChange('event_type', e.target.value)}
                  className={adminInputClassFor('event_type')}
                >
                  {['karate', 'mors', 'planszowki', 'ognisko', 'spacer', 'joga', 'wyjazd', 'inne'].map((item) => (
                    <option key={item} value={item}>
                      {t(`eventTypes.${item}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.startDate')}
                <DatePickerField
                  type="datetime-local"
                  value={adminForm.start_date}
                  onChange={(e) => handleAdminChange('start_date', e.target.value)}
                  inputClassName={fieldHints.start_date ? validationBorderClass : ''}
                />
                {fieldHints.start_date && (
                  <p className={validationHintClass}>{t(fieldHints.start_date)}</p>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.endDate')}
                <DatePickerField
                  type="datetime-local"
                  value={adminForm.end_date}
                  onChange={(e) => handleAdminChange('end_date', e.target.value)}
                  inputClassName={fieldHints.end_date ? validationBorderClass : ''}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.timeInfo')}
                <input
                  type="text"
                  value={adminForm.time_info}
                  onChange={(e) => handleAdminChange('time_info', e.target.value)}
                  placeholder={t('admin.fields.timeInfoPlaceholder')}
                  className={adminInputClassFor('time_info')}
                />
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.city')}
                <input
                  type="text"
                  value={adminForm.city}
                  onChange={(e) => handleAdminChange('city', e.target.value)}
                  className={adminInputClassFor('city')}
                />
                {fieldHints.city && (
                  <p className={validationHintClass}>{t(fieldHints.city)}</p>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream md:col-span-2">
                {t('admin.fields.location')}
                <input
                  type="text"
                  value={adminForm.location}
                  onChange={(e) => handleAdminChange('location', e.target.value)}
                  className={adminInputClassFor('location')}
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
              {t('admin.fields.description')}
              <textarea
                value={adminForm.description}
                onChange={(e) => handleAdminChange('description', e.target.value)}
                rows={3}
                className={`w-full ${adminInputClassFor('description')}`}
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-navy dark:text-cream">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={adminForm.requires_subscription}
                onChange={(e) => handleAdminChange('requires_subscription', e.target.checked)}
              />
              <span>{t('admin.fields.requiresSubscription')}</span>
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.priceGuest')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adminForm.price_guest}
                  onChange={(e) => handleAdminNonNegativeNumberChange('price_guest', e.target.value)}
                  placeholder={t('admin.fields.priceGuestPlaceholder')}
                  disabled={adminForm.requires_subscription}
                  className={adminInputClassFor('price_guest', 'disabled:opacity-60')}
                />
                {fieldHints.price_guest && (
                  <p className={validationHintClass}>{t(fieldHints.price_guest)}</p>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.priceMember')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={adminForm.price_member}
                  onChange={(e) => handleAdminNonNegativeNumberChange('price_member', e.target.value)}
                  placeholder={t('admin.fields.priceMemberPlaceholder')}
                  className={adminInputClassFor('price_member')}
                />
                {fieldHints.price_member && (
                  <p className={validationHintClass}>{t(fieldHints.price_member)}</p>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.maxParticipants')}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={adminForm.max_participants}
                  onChange={(e) => handleAdminMinOneNumberChange('max_participants', e.target.value)}
                  placeholder={t('admin.fields.maxParticipantsPlaceholder')}
                  className={adminInputClassFor('max_participants')}
                />
                {fieldHints.max_participants && (
                  <p className={validationHintClass}>{t(fieldHints.max_participants)}</p>
                )}
              </label>
            </div>

            <div className="inline-flex items-center gap-2 text-sm text-navy dark:text-cream">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="form-checkbox cursor-not-allowed opacity-70"
                  checked={adminForm.manual_payment_verification}
                  disabled
                  readOnly
                />
                <span>{t('admin.fields.manualPaymentVerification')}</span>
              </label>
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy/20 text-[10px] font-bold text-navy/70 dark:border-cream/20 dark:text-cream/70"
                title={t('admin.fields.manualPaymentVerificationLockedHint')}
                aria-label={t('admin.fields.manualPaymentVerificationLockedHint')}
              >
                i
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream md:col-span-2">
                {t('admin.fields.manualPaymentUrl')}
                <input
                  type="url"
                  value={adminForm.manual_payment_url}
                  onChange={(e) => handleAdminChange('manual_payment_url', e.target.value)}
                  placeholder={t('admin.fields.manualPaymentUrlPlaceholder')}
                  className={adminInputClassFor('manual_payment_url')}
                />
                {fieldHints.manual_payment_url && (
                  <p className={validationHintClass}>{t(fieldHints.manual_payment_url)}</p>
                )}
              </label>

              <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
                {t('admin.fields.manualPaymentDueHours')}
                <input
                  type="number"
                  min="1"
                  max="168"
                  step="1"
                  value={adminForm.manual_payment_due_hours}
                  onChange={(e) => handleAdminMinOneNumberChange('manual_payment_due_hours', e.target.value)}
                  className={adminInputClassFor('manual_payment_due_hours')}
                />
              </label>
            </div>

            <div>
              <button
                onClick={handleAdminSave}
                disabled={savingAdmin}
                className="px-5 py-2 rounded-full font-semibold btn-primary disabled:opacity-60"
              >
                {savingAdmin ? t('common.loading') : t('event.adminSave')}
              </button>
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="mb-4 flex flex-wrap gap-4 text-sm text-navy dark:text-cream">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(selectedOccurrenceDate)}</span>
            {selectedEndDate && (
              <span> - {formatDate(selectedEndDate)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{event.time}</span>
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-navy/90 dark:text-cream/90 sm:text-base">
          {event.description}
        </p>

        {(event.location || event.city) && event.showMap !== false && (
          <div className="mb-5">
            <p className="text-sm uppercase tracking-wide text-navy/50 dark:text-cream/50">
              {t('event.location')}
            </p>
            {event.location && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-navy dark:text-cream font-semibold"
              >
                {event.location}
                <span className="text-xs opacity-70">↗</span>
              </a>
            )}
            <div className="mt-3 overflow-hidden rounded-2xl border border-navy/10 dark:border-cream/15">
              <iframe
                title={`map-${event.id}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`}
                className="h-56 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        )}

          </div>

          {/* Pricing */}
          <div className="mb-4 rounded-2xl border border-navy/10 bg-cream/75 p-5 dark:border-cream/15 dark:bg-navy/75">
        <h2 className="mb-4 text-lg font-black italic text-navy dark:text-cream sm:text-xl">
          {t('event.price')}
        </h2>

        {event.requiresSubscription && (
          <p className="mb-4 text-sm font-semibold text-navy/70 dark:text-cream/70">
            {t('event.subscriptionRequired')}
          </p>
        )}

        <div className="space-y-3">
          {!event.requiresSubscription && (
            <div className="flex justify-between items-center">
              <span className="text-navy/70 dark:text-cream/70">
                {t('event.priceGuest')}
              </span>
              <span className="text-lg font-bold text-navy dark:text-cream sm:text-xl">
                {formatPrice(event.priceGuest)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-bold text-navy dark:text-cream">
              {t('event.priceMember')}
            </span>
            <span className="text-lg font-bold text-navy dark:text-cream sm:text-xl">
              {formatPrice(event.priceMember)}
            </span>
          </div>
        </div>

        {event.paymentInfo && (
          <div className="mt-6 pt-6 border-t whitespace-pre-line text-sm
            border-navy/20 dark:border-cream/20 text-navy/70 dark:text-cream/70">
            {event.paymentInfo}
          </div>
        )}
          </div>
        </div>

        {/* Participants Table */}
        <div className="lg:col-span-1 lg:flex">
          <div className="mb-4 lg:mb-0 lg:h-full lg:w-full">
            <ParticipantsTable
              eventId={event.id}
              maxParticipants={maxParticipants}
              onUpdate={setParticipantCount}
              refreshKey={participantsRefreshKey}
              compact
              className="lg:h-full"
            />
          </div>
        </div>
      </div>

      {/* Registration CTA */}
      <div className="mt-4 rounded-2xl border border-navy/10 bg-cream/75 p-5 dark:border-cream/15 dark:bg-navy/75">
        <div className="max-w-md mx-auto">
          <RegisterButton
            eventId={event.id}
            price={userPrice}
            isFull={isFull}
            isPast={isPast}
            isRegistered={isRegistered}
            onSuccess={handleRegistrationSuccess}
          />

          <p className="mt-4 text-sm text-center text-navy/50 dark:text-cream/50">
            {t('event.interested')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default EventDetail
