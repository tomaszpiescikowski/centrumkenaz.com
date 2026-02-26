import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useCity } from '../../context/CityContext'
import { useNotification } from '../../context/NotificationContext'
import { createEvent } from '../../api/events'
import DatePickerField from '../../components/forms/DatePickerField'
import AuthGateCard from '../../components/ui/AuthGateCard'
import Tooltip from '../../components/ui/Tooltip'
import EventIconPicker from '../../components/common/EventIconPicker'
import CustomSelect from '../../components/controls/CustomSelect'
import { useCustomEventTypes } from '../../hooks/useCustomEventTypes'

const PREFILL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_START_TIME = '10:00'
const DEFAULT_END_TIME = '11:00'
const DEFAULT_PAYMENT_URL = import.meta.env.VITE_DEFAULT_PAYMENT_URL || ''

function normalizePrefillDate(rawDate) {
  if (!rawDate || !PREFILL_DATE_PATTERN.test(rawDate)) return null
  const parsed = new Date(`${rawDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return rawDate
}

function toDateTimeLocal(dateKey, timeValue) {
  if (!dateKey) return ''
  return `${dateKey}T${timeValue}`
}

function AdminEventCreate() {
  const { user, authFetch, isAuthenticated, login } = useAuth()
  const { t } = useLanguage()
  const { showError } = useNotification()
  const { cities, selectedCity } = useCity()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { customTypes } = useCustomEventTypes()
  const prefillDate = useMemo(
    () => normalizePrefillDate(searchParams.get('prefill_date')),
    [searchParams]
  )
  const adminCreateReturnTo = prefillDate
    ? `/admin/events/new?prefill_date=${prefillDate}`
    : '/admin/events/new'

  const inputClassName = 'ui-input'
  const validationHintClass = 'ui-field-hint'
  const validationBorderClass = 'ui-input-invalid'
  const inputClassFor = (fieldKey, extra = '') =>
    `${inputClassName} ${fieldHints[fieldKey] ? validationBorderClass : ''} ${extra}`.trim()

  const [form, setForm] = useState({
    title: '',
    description: '',
    eventType: 'karate',
    startDate: toDateTimeLocal(prefillDate, DEFAULT_START_TIME),
    endDate: toDateTimeLocal(prefillDate, DEFAULT_END_TIME),
    city: '',
    location: '',
    showMap: true,
    priceGuest: '0',
    priceMember: '0',
    manualPaymentVerification: true,
    manualPaymentUrl: DEFAULT_PAYMENT_URL,
    manualPaymentDueHours: '24',
    maxParticipants: '',
    requiresSubscription: false,
    cancelCutoffHours: '24',
    pointsValue: '1',
  })

  const [saving, setSaving] = useState(false)
  const [fieldHints, setFieldHints] = useState({})

  const eventTypeOptions = useMemo(
    () => ['karate', 'mors', 'planszowki', 'ognisko', 'spacer', 'joga', 'wyjazd'],
    []
  )
  // eventTypeOptions kept for potential legacy use; visual selection handled by EventIconPicker

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!form.city && selectedCity?.name) {
      updateField('city', selectedCity.name)
    }
    if (!form.location && selectedCity?.name) {
      updateField('location', selectedCity.name)
    }
  }, [form.city, form.location, selectedCity])

  useEffect(() => {
    if (!prefillDate) return
    setForm((prev) => ({
      ...prev,
      startDate: toDateTimeLocal(prefillDate, prev.startDate.split('T')[1]?.slice(0, 5) || DEFAULT_START_TIME),
      endDate: toDateTimeLocal(prefillDate, prev.endDate.split('T')[1]?.slice(0, 5) || DEFAULT_END_TIME),
    }))
  }, [prefillDate])

  const updateField = (key, value) => {
    clearFieldHint(key)
    setForm((prev) => ({ ...prev, [key]: value }))
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

  const handleNonNegativeNumberChange = (key, value) => {
    if (value === '') {
      clearFieldHint(key)
      updateField(key, '')
      return
    }
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      updateField(key, value)
      return
    }
    if (parsed < 0) {
      setFieldHint(key, 'admin.validation.nonNegative')
      updateField(key, '0')
      return
    }
    clearFieldHint(key)
    updateField(key, value)
  }

  const handleMinOneNumberChange = (key, value) => {
    if (value === '') {
      clearFieldHint(key)
      updateField(key, '')
      return
    }
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      updateField(key, value)
      return
    }
    if (parsed < 1) {
      setFieldHint(key, 'admin.validation.minOne')
      updateField(key, '1')
      return
    }
    clearFieldHint(key)
    updateField(key, value)
  }

  const handleBoundedNumberChange = (key, value, min, max) => {
    if (value === '') {
      clearFieldHint(key)
      updateField(key, '')
      return
    }
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      updateField(key, value)
      return
    }
    if (parsed < min) {
      setFieldHint(key, 'admin.validation.minOne')
      updateField(key, String(min))
      return
    }
    if (parsed > max) {
      setFieldHint(key, 'admin.validation.maxValue')
      updateField(key, String(max))
      return
    }
    clearFieldHint(key)
    updateField(key, value)
  }

  const toggleRequiresSubscription = (checked) => {
    if (checked) {
      clearFieldHint('priceGuest')
    }
    setForm((prev) => ({
      ...prev,
      requiresSubscription: checked,
      // Guest price is irrelevant for subscription-only events.
      priceGuest: checked ? '0' : prev.priceGuest,
    }))
  }

  const formatTimeInfo = (start, end) => {
    if (!start) return null
    const startTime = start.split('T')[1]?.slice(0, 5)
    if (!startTime) return null
    if (end) {
      const endTime = end.split('T')[1]?.slice(0, 5)
      if (endTime) return `${startTime}-${endTime}`
    }
    return startTime
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!isAdmin) {
      showError(t('admin.notAuthorized'))
      return
    }

    const requiredHints = {}
    if (!form.title.trim()) requiredHints.title = 'admin.validationRequired'
    if (!form.startDate) {
      requiredHints.startDate = 'admin.validationRequired'
    } else if (new Date(form.startDate) < new Date()) {
      requiredHints.startDate = 'admin.validation.notPastDate'
    }
    if (!form.city.trim()) requiredHints.city = 'admin.validationRequired'
    const hasPaidPrice = Number(form.requiresSubscription ? form.priceMember : form.priceGuest) > 0
      || Number(form.priceMember) > 0
    if (form.manualPaymentVerification && hasPaidPrice && !form.manualPaymentUrl.trim()) {
      requiredHints.manualPaymentUrl = 'admin.validationRequired'
    }

    if (Object.keys(requiredHints).length > 0) {
      setFieldHints((prev) => ({ ...prev, ...requiredHints }))
      showError(t('admin.validationRequired'))
      return
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_type: form.eventType,
      start_date: new Date(form.startDate).toISOString(),
      end_date: form.endDate ? new Date(form.endDate).toISOString() : null,
      time_info: formatTimeInfo(form.startDate, form.endDate),
      city: form.city.trim(),
      location: form.location.trim() || null,
      show_map: form.showMap,
      price_guest: form.requiresSubscription ? 0 : Number(form.priceGuest || 0),
      price_member: Number(form.priceMember || 0),
      manual_payment_verification: true,
      manual_payment_url: form.manualPaymentUrl.trim()
        ? form.manualPaymentUrl.trim()
        : null,
      manual_payment_due_hours: Number(form.manualPaymentDueHours || 24),
      max_participants: form.maxParticipants ? Number(form.maxParticipants) : null,
      requires_subscription: form.requiresSubscription,
      cancel_cutoff_hours: Number(form.cancelCutoffHours || 24),
      points_value: Number(form.pointsValue || 0),
    }

    try {
      setSaving(true)
      const created = await createEvent(authFetch, payload)
      if (!created?.id) {
        showError(t('admin.createError'))
        return
      }
      navigate(`/event/${created.id}`)
    } catch (err) {
      showError(err.message || t('admin.createError'))
    } finally {
      setSaving(false)
    }
  }

  if (isAuthenticated && !isAdmin) {
    return (
      <AuthGateCard
        title={t('admin.notAuthorizedTitle')}
        message={t('admin.notAuthorized')}
        actionLabel={t('common.backToCalendar')}
        actionTo="/calendar"
      />
    )
  }

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('admin.createEventTitle')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: adminCreateReturnTo })}
      />
    )
  }

  return (
    <div className="page-shell">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
          {t('admin.createEventTitle')}
        </h1>
        <p className="text-navy/60 dark:text-cream/60">
          {t('admin.createEventSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
            {t('admin.fields.title')}
            <input
              type="text"
              className={inputClassFor('title')}
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('admin.fields.titlePlaceholder')}
              required
            />
            {fieldHints.title && (
              <p className={validationHintClass}>{t(fieldHints.title)}</p>
            )}
          </label>
        </div>

        <div className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
          {t('admin.fields.eventType')}
          <EventIconPicker
            value={form.eventType}
            onChange={(val) => updateField('eventType', val)}
            customTypes={customTypes}
          />
        </div>

        <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
          {t('admin.fields.description')}
          <textarea
            rows="4"
            className={inputClassName}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder={t('admin.fields.descriptionPlaceholder')}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream min-w-0">
            {t('admin.fields.startDate')}
            <DatePickerField
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
              buttonLabel={t('admin.fields.startDate')}
              inputClassName={fieldHints.startDate ? validationBorderClass : ''}
              required
            />
            {fieldHints.startDate && (
              <p className={validationHintClass}>{t(fieldHints.startDate)}</p>
            )}
          </label>

          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream min-w-0">
            {t('admin.fields.endDate')}
            <DatePickerField
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
              buttonLabel={t('admin.fields.endDate')}
              inputClassName=""
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
          {t('admin.fields.city')}
          <CustomSelect
            options={cities.map((city) => ({ value: city.name, label: city.name }))}
            value={form.city}
            onChange={(val) => updateField('city', val)}
            isInvalid={Boolean(fieldHints.city)}
          />
          {fieldHints.city && (
            <p className={validationHintClass}>{t(fieldHints.city)}</p>
          )}
        </label>

        <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
          <span className="flex items-center gap-1.5">
            {t('admin.fields.location')}
            <Tooltip text={t('admin.fields.locationTooltip')}>
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy/20 text-[10px] font-bold text-navy/70 dark:border-cream/20 dark:text-cream/70 cursor-help"
                aria-label={t('admin.fields.locationTooltip')}
              >
                i
              </span>
            </Tooltip>
          </span>
          <input
            type="text"
            className={inputClassName}
            value={form.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder={t('admin.fields.locationPlaceholder')}
          />
          {form.location && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-navy/10 dark:border-cream/10">
              <iframe
                title={t('admin.fields.locationPreview')}
                className="w-full h-64"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(form.location)}&output=embed`}
              />
            </div>
          )}
          {form.location && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.location)}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-navy dark:text-cream"
            >
              {t('admin.fields.openInMaps')} ↗
            </a>
          )}
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 text-sm text-navy dark:text-cream">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={form.showMap}
              onChange={(e) => updateField('showMap', e.target.checked)}
            />
            {t('admin.fields.showMap')}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 text-sm text-navy dark:text-cream">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={form.requiresSubscription}
              onChange={(e) => toggleRequiresSubscription(e.target.checked)}
            />
            {t('admin.fields.requiresSubscription')}
          </label>

          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
            {t('admin.fields.pointsValue')}
            <input
              type="number"
              min="0"
              className={inputClassFor('pointsValue')}
              value={form.pointsValue}
              onChange={(e) => handleNonNegativeNumberChange('pointsValue', e.target.value)}
              placeholder={t('admin.fields.pointsValuePlaceholder')}
            />
            {fieldHints.pointsValue && (
              <p className={validationHintClass}>{t(fieldHints.pointsValue)}</p>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
            {t('admin.fields.priceGuest')}
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClassFor('priceGuest', form.requiresSubscription ? 'opacity-60 cursor-not-allowed' : '')}
              value={form.priceGuest}
              onChange={(e) => handleNonNegativeNumberChange('priceGuest', e.target.value)}
              placeholder={t('admin.fields.priceGuestPlaceholder')}
              disabled={form.requiresSubscription}
            />
            {form.requiresSubscription && (
              <p className="text-xs text-navy/60 dark:text-cream/60">
                {t('event.subscriptionRequired')}
              </p>
            )}
            {fieldHints.priceGuest && !form.requiresSubscription && (
              <p className={validationHintClass}>{t(fieldHints.priceGuest)}</p>
            )}
          </label>

          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
            {t('admin.fields.priceMember')}
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClassFor('priceMember')}
              value={form.priceMember}
              onChange={(e) => handleNonNegativeNumberChange('priceMember', e.target.value)}
              placeholder={t('admin.fields.priceMemberPlaceholder')}
            />
            {fieldHints.priceMember && (
              <p className={validationHintClass}>{t(fieldHints.priceMember)}</p>
            )}
          </label>

          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
            {t('admin.fields.maxParticipants')}
            <input
              type="number"
              min="1"
              className={inputClassFor('maxParticipants')}
              value={form.maxParticipants}
              onChange={(e) => handleMinOneNumberChange('maxParticipants', e.target.value)}
              placeholder={t('admin.fields.maxParticipantsPlaceholder')}
            />
            {fieldHints.maxParticipants && (
              <p className={validationHintClass}>{t(fieldHints.maxParticipants)}</p>
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm text-navy dark:text-cream">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="form-checkbox cursor-not-allowed opacity-70"
                checked={form.manualPaymentVerification}
                disabled
                readOnly
              />
              {t('admin.fields.manualPaymentVerification')}
            </label>
            <Tooltip text={t('admin.fields.manualPaymentVerificationLockedHint')}>
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy/20 text-[10px] font-bold text-navy/70 dark:border-cream/20 dark:text-cream/70 cursor-help select-none"
                aria-label={t('admin.fields.manualPaymentVerificationLockedHint')}
                role="img"
              >
                i
              </span>
            </Tooltip>
          </div>

          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream md:col-span-2">
            {t('admin.fields.manualPaymentUrl')}
            <input
              type="url"
              className={inputClassFor('manualPaymentUrl')}
              value={form.manualPaymentUrl}
              onChange={(e) => updateField('manualPaymentUrl', e.target.value)}
              placeholder={t('admin.fields.manualPaymentUrlPlaceholder')}
            />
            {fieldHints.manualPaymentUrl && (
              <p className={validationHintClass}>{t(fieldHints.manualPaymentUrl)}</p>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
          <span className="flex items-center gap-1.5">
            {t('admin.fields.manualPaymentDueHours')}
            <Tooltip text={t('admin.fields.manualPaymentDueHoursTooltip')}>
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy/20 text-[10px] font-bold text-navy/70 dark:border-cream/20 dark:text-cream/70 cursor-help"
                aria-label={t('admin.fields.manualPaymentDueHoursTooltip')}
              >
                i
              </span>
            </Tooltip>
          </span>
          <input
            type="number"
            min="1"
            max="168"
            className={inputClassFor('manualPaymentDueHours')}
            value={form.manualPaymentDueHours}
            onChange={(e) => handleBoundedNumberChange('manualPaymentDueHours', e.target.value, 1, 168)}
          />
          {fieldHints.manualPaymentDueHours && (
            <p className={validationHintClass}>{t(fieldHints.manualPaymentDueHours)}</p>
          )}
          <p className="text-xs text-navy/60 dark:text-cream/60">
            {t('admin.fields.manualPaymentDueHoursHint')}
          </p>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-2 text-sm text-navy dark:text-cream">
            <span className="flex items-center gap-1.5">
              {t('admin.fields.cancelCutoffHours')}
              <Tooltip text={t('admin.fields.cancelCutoffHoursTooltip')}>
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy/20 text-[10px] font-bold text-navy/70 dark:border-cream/20 dark:text-cream/70 cursor-help"
                  aria-label={t('admin.fields.cancelCutoffHoursTooltip')}
                >
                  i
                </span>
              </Tooltip>
            </span>
            <input
              type="number"
              min="0"
              className={inputClassFor('cancelCutoffHours')}
              value={form.cancelCutoffHours}
              onChange={(e) => handleNonNegativeNumberChange('cancelCutoffHours', e.target.value)}
            />
            {fieldHints.cancelCutoffHours && (
              <p className={validationHintClass}>{t(fieldHints.cancelCutoffHours)}</p>
            )}
          </label>

        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-3 rounded-full font-semibold transition-all
              ${saving
                ? 'bg-navy/40 dark:bg-cream/40 text-cream dark:text-navy cursor-wait'
                : 'btn-primary hover:scale-[1.02]'
              }`}
          >
            {saving ? t('admin.saving') : t('admin.createEventButton')}
          </button>
          <Link
            to="/calendar"
            className="px-6 py-3 rounded-full font-semibold
              btn-secondary"
          >
            {t('common.backToCalendar')}
          </Link>
        </div>
      </form>
    </div>
  )
}

export default AdminEventCreate
