import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../context/NotificationContext'
import { useChat } from '../../context/ChatContext'
import { deleteEvent, fetchEventById, fetchRegisteredEventIds, fetchEventAvailability, updateEvent } from '../../api/events'
import { API_URL } from '../../api/config'
import RegisterButton from '../../components/forms/RegisterButton'
import DatePickerField from '../../components/forms/DatePickerField'
import AuthGateCard from '../../components/ui/AuthGateCard'
import CustomSelect from '../../components/controls/CustomSelect'
import CommentsSection from '../../components/common/CommentsSection'
import EventIcon from '../../components/common/EventIcon'

function buildGoogleCalendarUrl(event) {
  const start = new Date(event.startDateTime)
  const end = event.endDateTime ? new Date(event.endDateTime) : new Date(start.getTime() + 60 * 60 * 1000)
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
  })
  if (event.location) params.set('location', event.location)
  if (event.city && !event.location) params.set('location', event.city)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

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
  const [participants, setParticipants] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [availability, setAvailability] = useState(null)
  const [participantsRefreshKey, setParticipantsRefreshKey] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [adminForm, setAdminForm] = useState(null)
  const [fieldHints, setFieldHints] = useState({})
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [deletingAdmin, setDeletingAdmin] = useState(false)
  const { openChat } = useChat()
  const isAdmin = user?.role === 'admin'

  const userAccountStatus = user?.account_status

  const refreshRegisteredIds = useCallback(async () => {
    if (!isAuthenticated || userAccountStatus !== 'active') {
      setRegisteredIds(new Set())
      return
    }
    try {
      const ids = await fetchRegisteredEventIds(authFetch)
      setRegisteredIds(new Set(ids))
    } catch (_error) {
      setRegisteredIds(new Set())
    }
  }, [isAuthenticated, userAccountStatus, authFetch])

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
      if (!isAuthenticated || userAccountStatus !== 'active') {
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
  }, [id, isAuthenticated, userAccountStatus, authFetch])

  useEffect(() => {
    refreshRegisteredIds()
  }, [refreshRegisteredIds])

  // Fetch participants, waitlist, and availability
  useEffect(() => {
    if (!event || !isAuthenticated || userAccountStatus !== 'active') return
    let cancelled = false
    const loadSidebar = async () => {
      try {
        const [pRes, wRes, aData] = await Promise.all([
          authFetch(`${API_URL}/events/${event.id}/participants`),
          authFetch(`${API_URL}/events/${event.id}/waitlist`),
          fetchEventAvailability(event.id, authFetch),
        ])
        const pData = pRes.ok ? await pRes.json() : []
        const wData = wRes.ok ? await wRes.json() : []
        if (!cancelled) {
          setParticipants(pData)
          setParticipantCount(pData.length)
          setWaitlist(wData)
          setAvailability(aData)
        }
      } catch (_err) {
        if (!cancelled) {
          setParticipants([])
          setWaitlist([])
          setAvailability(null)
        }
      }
    }
    loadSidebar()
    return () => { cancelled = true }
  }, [event, participantsRefreshKey, isAuthenticated, userAccountStatus, authFetch])

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
  const isTooFarFuture = (() => {
    if (!occurrenceStart || Number.isNaN(occurrenceStart.getTime())) return false
    const maxFuture = new Date()
    maxFuture.setHours(0, 0, 0, 0)
    maxFuture.setDate(maxFuture.getDate() + 21)
    return occurrenceStart >= maxFuture
  })()
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

  /* ── helpers for participant rows ──────────────────── */
  const statusRowClass = (s) => {
    if (s === 'confirmed') return 'ev-row-ok'
    if (s === 'pending' || s === 'manual_payment_verification') return 'ev-row-wait'
    if (s === 'manual_payment_required') return 'ev-row-pay'
    return ''
  }
  const statusAvClass = (s) => {
    if (s === 'confirmed') return 'ev-av-ok'
    if (s === 'pending' || s === 'manual_payment_verification') return 'ev-av-wait'
    if (s === 'manual_payment_required') return 'ev-av-pay'
    return ''
  }
  const statusDotClass = (s) => {
    if (s === 'confirmed') return 'ev-d-ok'
    if (s === 'pending' || s === 'manual_payment_verification') return 'ev-d-wait'
    if (s === 'manual_payment_required') return 'ev-d-pay'
    return ''
  }
  const initials = (name) => {
    const parts = (name || '').split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  /* ── availability tags ──────────────────────────────── */
  const occupiedCount = availability?.occupied_count ?? participantCount
  const waitlistCount = availability?.waitlist_count ?? waitlist.length
  const availableSpots = availability?.available_spots ?? (maxParticipants != null ? Math.max(0, maxParticipants - occupiedCount) : null)

  const availabilityTag = (() => {
    if (maxParticipants == null) return { label: t('participants.noLimit'), cls: 'ev-tag-green' }
    if (availableSpots === 0) return { label: t('registration.noSpots'), cls: 'ev-tag-red' }
    if (availableSpots <= 3) return { label: `${availableSpots} ${t('participants.free')}`, cls: 'ev-tag-amber' }
    return { label: `${availableSpots} ${t('participants.free')}`, cls: 'ev-tag-green' }
  })()

  /* ── progress bar ───────────────────────────────────── */
  const barPercent = maxParticipants ? Math.min(100, Math.round((occupiedCount / maxParticipants) * 100)) : 0
  const barColor = barPercent >= 100 ? '#ef4444' : barPercent >= 80 ? '#f59e0b' : '#22c55e'

  /* ── badge for participant card header ──────────────── */
  const badgeCls = (() => {
    if (maxParticipants == null) return 'ev-badge-green'
    if (availableSpots === 0) return 'ev-badge-red'
    if (availableSpots <= 3) return 'ev-badge-amber'
    return 'ev-badge-green'
  })()

  /* ── has any non-confirmed status? show legend ──────── */
  const hasMultipleStatuses = participants.some((p) => p.status !== 'confirmed')

  return (
    <div className="ev mx-auto w-full max-w-4xl px-3 py-3 sm:px-4 sm:py-6">
      {/* Back link */}
      <Link to="/calendar" className="ev-back">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('common.backToCalendar')}
      </Link>

      <div className="ev-grid">
        {/* ────── LEFT COLUMN ────── */}
        <div className="ev-left">
          {/* Hero card */}
          <div className="ev-card ev-hero">
            {/* Admin bar */}
            {isAdmin && (
              <div className="ev-admin-bar" style={{ margin: '-1.25rem -1.25rem 0', padding: '0.75rem 1.25rem', borderTop: 'none' }}>
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

            {/* Admin editing form */}
            {isAdmin && isEditing && adminForm && (
              <div className="space-y-4 rounded-2xl border border-navy/20 bg-cream/70 p-4 dark:border-cream/20 dark:bg-navy/70">
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
                    <CustomSelect
                      options={['karate', 'mors', 'planszowki', 'ognisko', 'spacer', 'joga', 'wyjazd', 'inne'].map((item) => ({ value: item, label: t(`eventTypes.${item}`) }))}
                      value={adminForm.event_type}
                      onChange={(val) => handleAdminChange('event_type', val)}
                      isInvalid={Boolean(fieldHints.event_type)}
                    />
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

            {/* Title + Price row */}
            <div className="ev-header-row">
              <div className="ev-header-left">
                <h1 className="ev-title">
                  <EventIcon type={event.type || 'inne'} size="sm" />
                  {event.title}
                </h1>

                {/* Date & time */}
                <div className="ev-meta">
                  <span className="ev-meta-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(selectedOccurrenceDate)}
                    {selectedEndDate && selectedEndDate !== selectedOccurrenceDate && (
                      <> – {formatDate(selectedEndDate)}</>
                    )}
                  </span>

                  {event.time && (
                    <>
                      <span className="ev-meta-sep">·</span>
                      <span className="ev-meta-item">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {event.time}
                      </span>
                    </>
                  )}
                </div>

                {/* Add to Google Calendar – only for registered users */}
                {isRegistered && (
                  <a
                    href={buildGoogleCalendarUrl(event)}
                    target="_blank"
                    rel="noreferrer"
                    className="ev-gcal-btn"
                    title={t('account.addToCalendar')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>
                    {t('account.addToCalendar')}
                  </a>
                )}
              </div>

              {/* Price box */}
              <div className="ev-price-box">
                {event.requiresSubscription ? (
                  <div className="ev-price-line ev-price-member">
                    <span className="ev-price-label">{t('event.priceMember')}</span>
                    <span className="ev-price-val">{formatPrice(event.priceMember)}</span>
                  </div>
                ) : (
                  <>
                    <div className="ev-price-line">
                      <span className="ev-price-label">{t('event.priceGuest')}</span>
                      <span className="ev-price-val">{formatPrice(event.priceGuest)}</span>
                    </div>
                    <div className="ev-price-line ev-price-member">
                      <span className="ev-price-label">{t('event.priceMember')}</span>
                      <span className="ev-price-val">{formatPrice(event.priceMember)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cancellation deadline info */}
            {(() => {
              if (!occurrenceStart || isPast) return null
              const cutoffHours = event.cancelCutoffHours || 24
              const deadlineMs = occurrenceStart.getTime() - cutoffHours * 3600000
              const deadline = new Date(deadlineMs)
              const now = new Date()
              const remaining = deadlineMs - now.getTime()
              const canCancel = remaining > 0

              if (canCancel) {
                const totalMin = Math.floor(remaining / 60000)
                const days = Math.floor(totalMin / 1440)
                const hrs = Math.floor((totalMin % 1440) / 60)
                const mins = totalMin % 60
                const parts = []
                if (days > 0) parts.push(`${days}${t('common.days')}`)
                if (hrs > 0) parts.push(`${hrs}${t('common.hours')}`)
                if (days === 0 && mins > 0) parts.push(`${mins}${t('common.minutes')}`)
                const timeStr = parts.join(' ')

                const isUrgent = remaining < 24 * 3600000

                return (
                  <div className={`ev-cancel-info ev-cancel-open ${isUrgent ? 'ev-cancel-urgent' : ''}`}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{t('event.cancellationTimeRemaining', { time: timeStr })}</span>
                  </div>
                )
              }

              return (
                <div className="ev-cancel-info ev-cancel-closed">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('event.cancellationExpired')}</span>
                </div>
              )
            })()}

            {/* Tags */}
            <div className="ev-tags">
              <span className={`ev-tag ${availabilityTag.cls}`}>
                {availabilityTag.label}
              </span>
              <span className="ev-tag ev-tag-outline">
                {t(`eventTypes.${event.type}`) || event.type}
              </span>
              {event.requiresSubscription && (
                <span className="ev-tag ev-tag-outline">
                  {t('participants.subscribersOnly')}
                </span>
              )}
              {event.city && (
                <span className="ev-tag ev-tag-outline">
                  {event.city}
                </span>
              )}
            </div>

            {/* Location */}
            {(event.location || event.city) && (
              <>
                <hr className="ev-separator" />
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="ev-loc-inline"
                >
                  <div className="ev-loc-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="ev-loc-name">{event.location || event.city}</span>
                    <span className="ev-loc-sub">{t('participants.openInMaps')}</span>
                  </div>
                </a>
              </>
            )}

            {/* Description */}
            {event.description && (
              <>
                <hr className="ev-separator" />
                <div className="ev-desc">{event.description}</div>
              </>
            )}

            {/* Filler to push CTA to bottom */}
            <div className="ev-filler" />
          </div>

          {/* CTA card */}
          <div className="ev-cta-card">
            <RegisterButton
              eventId={event.id}
              price={0}
              isFull={isFull}
              isPast={isPast}
              isTooFarFuture={isTooFarFuture}
              isRegistered={isRegistered}
              requiresSubscription={event.requiresSubscription}
              onSuccess={handleRegistrationSuccess}
            />
          </div>

          {/* Comments section – hidden on mobile (replaced by chat button) */}
          <div
            className="ev-card ev-chat-card hidden sm:block"
            style={{ marginTop: '0.75rem', padding: '1rem 1.25rem' }}
          >
            <CommentsSection resourceType="event" resourceId={event.id} hideTabs messengerLayout />
          </div>

          {/* Mobile full-width event chat button */}
          <button
            type="button"
            onClick={() => openChat({ eventId: event.id, eventTitle: event.title })}
            className="ev-chat-open-btn sm:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {t('comments.eventChat')}
          </button>
        </div>

        {/* ────── RIGHT COLUMN ────── */}
        <div className="ev-right">
          {/* Participants card */}
          <div className="ev-card ev-tcard">
            {/* Header */}
            <div className="ev-thead">
              <span className="ev-thead-title">{t('participants.title')}</span>
              <span className={`ev-badge ${badgeCls}`}>
                {maxParticipants != null
                  ? `${occupiedCount} / ${maxParticipants}`
                  : occupiedCount}
              </span>
            </div>

            {/* Progress bar */}
            {maxParticipants != null && (
              <div className="ev-bar">
                <div
                  className="ev-bar-fill"
                  style={{ width: `${barPercent}%`, background: barColor }}
                />
              </div>
            )}

            {/* Column headers */}
            <div className="ev-col-headers">
              <span>{t('participants.name')}</span>
              <span>{t('participants.points')}</span>
            </div>

            {/* Scrollable participant list */}
            <div className="ev-scroll">
              {participants.length === 0 ? (
                <div className="ev-empty">
                  <p>{t('participants.emptyTitle')}</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {t('participants.emptySubtitle')}
                  </p>
                </div>
              ) : (
                participants.map((p) => (
                  <Link
                    key={p.id}
                    to={`/people/${p.user_id}`}
                    className={`ev-row ${statusRowClass(p.status)}`}
                  >
                    <div className="ev-av-wrap">
                      {p.picture_url ? (
                        <img
                          src={p.picture_url}
                          alt={p.full_name}
                          className={`ev-av ev-av-img ${statusAvClass(p.status)}`}
                        />
                      ) : (
                        <div className={`ev-av ${statusAvClass(p.status)}`}>
                          {initials(p.full_name)}
                        </div>
                      )}
                      <span className={`ev-dot ${statusDotClass(p.status)}`} />
                    </div>
                    <div className="ev-nc">
                      <span className="ev-name">{p.full_name}</span>
                    </div>
                    <span className={`ev-pts ${p.points > 0 ? 'ev-pts-v' : 'ev-pts-n'}`}>
                      {p.points > 0 ? p.points : '—'}
                    </span>
                  </Link>
                ))
              )}
            </div>

            {/* Legend */}
            {hasMultipleStatuses && (
              <details className="ev-legend-details">
                <summary className="ev-legend-summary">
                  {t('participants.legendTitle')}
                </summary>
                <div className="ev-legend-grid">
                  <div className="ev-legend-item">
                    <span className="ev-leg-pill ev-leg-ok">{t('participants.statusConfirmed')}</span>
                    <span className="ev-legend-desc">{t('participants.tooltipConfirmed')}</span>
                  </div>
                  <div className="ev-legend-item">
                    <span className="ev-leg-pill ev-leg-wait">{t('participants.statusPending')}</span>
                    <span className="ev-legend-desc">{t('participants.tooltipPending')}</span>
                  </div>
                  <div className="ev-legend-item">
                    <span className="ev-leg-pill ev-leg-pay">{t('participants.statusPayment')}</span>
                    <span className="ev-legend-desc">{t('participants.tooltipPayment')}</span>
                  </div>
                </div>
              </details>
            )}
          </div>

          {/* Waitlist card */}
          {waitlist.length > 0 && (
            <div className="ev-card ev-tcard-wl">
              <div className="ev-thead">
                <span className="ev-thead-title">{t('registration.waitlistTitle')}</span>
                <span className="ev-badge ev-badge-grey">{waitlist.length}</span>
              </div>
              <div className="ev-scroll" style={{ maxHeight: '10rem' }}>
                {waitlist.map((w, idx) => (
                  <Link
                    key={w.id}
                    to={`/people/${w.user_id}`}
                    className="ev-row ev-row-wl"
                  >
                    <div className="ev-av-wrap">
                      {w.picture_url ? (
                        <img
                          src={w.picture_url}
                          alt={w.full_name}
                          className="ev-av ev-av-img"
                        />
                      ) : (
                        <div className="ev-av">
                          {initials(w.full_name)}
                        </div>
                      )}
                      <span className="ev-dot ev-d-wl" />
                    </div>
                    <div className="ev-nc">
                      <span className="ev-name">{w.full_name}</span>
                    </div>
                    <span className="ev-wl-pos">#{idx + 1}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EventDetail
