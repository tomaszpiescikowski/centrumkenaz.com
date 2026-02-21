import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { fetchEventAvailability, fetchEventsForMonth, fetchRegisteredEventIds } from '../../api/events'
import { useAuth } from '../../context/AuthContext'
import { useCity } from '../../context/CityContext'
import EventIcon from '../common/EventIcon'
import { toLocalDateKey } from '../../utils/date'
import { TAG_COLORS as ICON_COLORS } from '../../constants/interestTags'

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_EVENTS_PER_DAY = 4

const EVENT_TYPES = [
  { type: 'karate', labelKey: 'eventTypes.karate' },
  { type: 'mors', labelKey: 'eventTypes.mors' },
  { type: 'planszowki', labelKey: 'eventTypes.planszowki' },
  { type: 'ognisko', labelKey: 'eventTypes.ognisko' },
  { type: 'spacer', labelKey: 'eventTypes.spacer' },
  { type: 'joga', labelKey: 'eventTypes.joga' },
  { type: 'wyjazd', labelKey: 'eventTypes.wyjazd' },
  { type: 'inne', labelKey: 'eventTypes.inne' },
]

const EVENT_TONES = {
  karate: { marker: 'bg-cyan-500 text-white', line: 'bg-cyan-500' },
  mors: { marker: 'bg-blue-500 text-white', line: 'bg-blue-500' },
  planszowki: { marker: 'bg-violet-500 text-white', line: 'bg-violet-500' },
  ognisko: { marker: 'bg-orange-500 text-white', line: 'bg-orange-500' },
  spacer: { marker: 'bg-emerald-500 text-white', line: 'bg-emerald-500' },
  joga: { marker: 'bg-pink-500 text-white', line: 'bg-pink-500' },
  wyjazd: { marker: 'bg-amber-500 text-white', line: 'bg-amber-500' },
  inne: { marker: 'bg-slate-500 text-white', line: 'bg-slate-500' },
}

function getTone(type) {
  return EVENT_TONES[type] || EVENT_TONES.inne
}

function getEventPath(event) {
  return `/event/${event.id}`
}

function Calendar({ className = '' }) {
  const { t, currentLanguage } = useLanguage()
  const { isAuthenticated, authFetch, user } = useAuth()
  const { selectedCity } = useCity()
  const selectedCityName = selectedCity?.name || ''
  const isActiveUser = isAuthenticated && user?.account_status === 'active'
  const isAdmin = user?.role === 'admin' && user?.account_status === 'active'
  const [searchParams, setSearchParams] = useSearchParams()
  const dayFromQuery = searchParams.get('day')

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDayKey, setSelectedDayKey] = useState(null)

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [registeredEventIds, setRegisteredEventIds] = useState(() => new Set())
  const [availabilityByEventId, setAvailabilityByEventId] = useState({})
  const authFetchRef = useRef(authFetch)

  const [typeFilter, setTypeFilter] = useState(() => (
    EVENT_TYPES.reduce((acc, item) => {
      acc[item.type] = true
      return acc
    }, {})
  ))

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const days = t('calendar.days')
  const months = t('calendar.months')
  // Desktop should match mobile view; no breakpoint-specific rendering.

  useEffect(() => {
    authFetchRef.current = authFetch
  }, [authFetch])

  useEffect(() => {
    if (dayFromQuery && DATE_KEY_PATTERN.test(dayFromQuery)) {
      const parsed = new Date(`${dayFromQuery}T00:00:00`)
      if (
        !Number.isNaN(parsed.getTime())
        && parsed.getFullYear() === year
        && parsed.getMonth() === month
      ) {
        setSelectedDayKey(dayFromQuery)
        return
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (today.getFullYear() === year && today.getMonth() === month) {
      setSelectedDayKey(toLocalDateKey(today))
      return
    }
    setSelectedDayKey(toLocalDateKey(new Date(year, month, 1)))
  }, [year, month, dayFromQuery])

  useEffect(() => {
    if (!selectedDayKey || dayFromQuery === selectedDayKey) return
    const next = new URLSearchParams(searchParams)
    next.set('day', selectedDayKey)
    setSearchParams(next, { replace: true })
  }, [selectedDayKey, dayFromQuery, searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false

    const loadRegistered = async () => {
      if (!isActiveUser) {
        setRegisteredEventIds(new Set())
        return
      }

      try {
        const ids = await fetchRegisteredEventIds(authFetchRef.current)
        if (!cancelled) setRegisteredEventIds(new Set(ids))
      } catch (error) {
        if (!cancelled) setRegisteredEventIds(new Set())
      }
    }

    loadRegistered()
    return () => {
      cancelled = true
    }
  }, [isActiveUser])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!isActiveUser) {
        setEvents([])
        setAvailabilityByEventId({})
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const monthEvents = await fetchEventsForMonth({
          year,
          month: month + 1,
          limit: 500,
          city: selectedCityName,
          authFetch: authFetchRef.current,
        })

        if (!cancelled) {
          setEvents(monthEvents)
        }
      } catch (error) {
        if (!cancelled) setEvents([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [year, month, selectedCityName, isActiveUser])

  useEffect(() => {
    let cancelled = false

    const loadAvailability = async () => {
      if (!isActiveUser || !events.length) {
        setAvailabilityByEventId({})
        return
      }

      const rows = await Promise.all(
        events.map(async (eventItem) => {
          try {
            const availability = await fetchEventAvailability(eventItem.id, authFetchRef.current)
            return [eventItem.id, availability]
          } catch (_error) {
            return [eventItem.id, null]
          }
        })
      )

      if (cancelled) return
      const next = {}
      for (const [key, value] of rows) {
        if (value) next[key] = value
      }
      setAvailabilityByEventId(next)
    }

    loadAvailability()
    return () => {
      cancelled = true
    }
  }, [events, isActiveUser])

  const visibleEvents = useMemo(() => {
    return events.filter((eventItem) => {
      const typeKey = EVENT_TYPES.some((row) => row.type === eventItem.type) ? eventItem.type : 'inne'
      return typeFilter[typeKey] !== false
    })
  }, [events, typeFilter])

  const eventsByDay = useMemo(() => {
    const map = new Map()

    for (const eventItem of visibleEvents) {
      if (!eventItem?.date) continue

      const startKey = eventItem.date
      const endKey = eventItem.endDate || eventItem.date
      let cursor = new Date(startKey)
      const endDate = new Date(endKey)
      cursor.setHours(0, 0, 0, 0)
      endDate.setHours(0, 0, 0, 0)

      while (cursor <= endDate) {
        const key = toLocalDateKey(cursor)
        const dayRows = map.get(key) || []
        if (dayRows.length < MAX_EVENTS_PER_DAY) {
          dayRows.push(eventItem)
        }
        map.set(key, dayRows)
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    for (const [key, rows] of map.entries()) {
      rows.sort((a, b) => {
        const timeCmp = (a.time || '').localeCompare(b.time || '')
        if (timeCmp !== 0) return timeCmp
        return String(a.title).localeCompare(String(b.title))
      })
      map.set(key, rows)
    }

    return map
  }, [visibleEvents])

  const monthCells = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const mondayOffset = (firstDay.getDay() + 6) % 7
    const gridStart = new Date(year, month, 1 - mondayOffset)
    const todayKey = toLocalDateKey(new Date())

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + index)
      const key = toLocalDateKey(date)
      const cellDate = new Date(date)
      cellDate.setHours(0, 0, 0, 0)
      return {
        key,
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: key === todayKey,
        isPast: cellDate < today,
        events: eventsByDay.get(key) || [],
      }
    })
  }, [year, month, eventsByDay])

  const selectedDayEvents = selectedDayKey
    ? (eventsByDay.get(selectedDayKey) || []).slice(0, MAX_EVENTS_PER_DAY)
    : []
  const adminCreatePath = selectedDayKey && DATE_KEY_PATTERN.test(selectedDayKey)
    ? `/admin/events/new?prefill_date=${selectedDayKey}`
    : '/admin/events/new'
  const isSelectedDayPast = useMemo(() => {
    if (!selectedDayKey) return false
    const d = new Date(`${selectedDayKey}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return d < today
  }, [selectedDayKey])
  const selectedDayLabel = useMemo(() => {
    if (!selectedDayKey) return ''
    const date = new Date(`${selectedDayKey}T00:00:00`)
    const locale = currentLanguage === 'pl' ? 'pl-PL' : 'en-GB'
    return date.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [selectedDayKey, currentLanguage])

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const renderDayMarkers = (dayEvents) => {
    if (!dayEvents.length) return null
    return (
      <div className="mt-1 flex items-center justify-center gap-0.5">
        {dayEvents.slice(0, MAX_EVENTS_PER_DAY).map((eventItem, idx) => {
          const tone = getTone(eventItem.type)
          return (
            <span
              key={`${eventItem.id}-${idx}`}
              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full ${tone.marker}`}
              title={eventItem.title}
            >
              <EventIcon type={eventItem.type} size="xs" />
            </span>
          )
        })}
      </div>
    )
  }

  const getProgressTone = (ratio) => {
    if (ratio >= 0.85) return 'bg-rose-500'
    if (ratio >= 0.55) return 'bg-amber-400'
    return 'bg-emerald-500'
  }

  const toggleAllFilters = (nextValue) => {
    setTypeFilter((prev) => {
      const updated = { ...prev }
      EVENT_TYPES.forEach(({ type }) => {
        updated[type] = nextValue
      })
      return updated
    })
  }


  return (
    <div className={`w-full max-w-4xl mx-auto min-h-0 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          onClick={prevMonth}
          className="rounded-lg p-2 text-navy transition hover:bg-navy/10 dark:text-cream dark:hover:bg-cream/20"
          aria-label="Previous month"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="px-2 text-center text-2xl font-black text-navy dark:text-cream">
          {months[month]} {year}
        </h2>

        <button
          onClick={nextMonth}
          className="rounded-lg p-2 text-navy transition hover:bg-navy/10 dark:text-cream dark:hover:bg-cream/20"
          aria-label="Next month"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {isAdmin && !isSelectedDayPast && (
        <div className="mb-3">
          <Link
            to={adminCreatePath}
            className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-2 text-sm"
          >
            <span className="text-base leading-none">+</span>
            <span>{t('admin.cards.createEvent.title')}</span>
          </Link>
        </div>
      )}

      <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-3 lg:items-stretch lg:gap-4">
        <div className="flex h-full min-h-0 flex-col lg:col-span-2">
          <div className="grid grid-cols-7 gap-1 rounded-2xl border border-navy/10 bg-cream/80 p-2 dark:border-cream/10 dark:bg-navy/80">
            {days.map((dayName) => (
              <div key={dayName} className="py-1 text-center text-[11px] font-black uppercase tracking-wide text-navy/70 dark:text-cream/70">
                {dayName}
              </div>
            ))}

            {monthCells.map((cell) => {
              const isSelected = cell.key === selectedDayKey
              const isOutside = !cell.isCurrentMonth
              const isPastDay = cell.isPast && !isOutside
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={isOutside}
                  onClick={() => setSelectedDayKey(cell.key)}
                  className={
                    `min-h-[44px] rounded-xl border px-1 py-1 text-center transition ` +
                    `${isOutside
                      ? 'cursor-default border-transparent text-navy/25 dark:text-cream/25'
                      : isPastDay && !isSelected
                        ? 'border-navy/5 text-navy/35 dark:border-cream/10 dark:text-cream/35'
                        : 'border-navy/10 text-navy dark:border-cream/15 dark:text-cream'} ` +
                    `${isSelected ? 'bg-navy text-cream dark:bg-cream dark:text-navy' : 'bg-transparent'} ` +
                    `${cell.isToday && !isSelected ? 'ring-1 ring-navy/30 dark:ring-cream/30' : ''}`
                  }
                >
                  <div
                    className={
                      `text-sm font-bold leading-none ` +
                      `${isSelected ? 'text-cream dark:text-navy' : isPastDay ? 'text-navy/35 dark:text-cream/35' : 'text-navy dark:text-cream'}`
                    }
                  >
                    {cell.date.getDate()}
                  </div>
                  {!isOutside && renderDayMarkers(cell.events)}
                </button>
              )
            })}
          </div>

          <div className="mt-3 shrink-0 rounded-xl border border-navy/10 bg-transparent p-3 dark:border-cream/15 dark:bg-transparent">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-navy dark:text-cream">{t('calendar.legend')}</h3>
              <div className="group relative">
                <svg className="h-3.5 w-3.5 cursor-default text-navy/40 dark:text-cream/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-lg bg-navy px-2.5 py-1.5 text-xs text-cream shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:bg-cream dark:text-navy">
                  {t('calendar.legendTooltip')}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(({ type, labelKey }) => {
                const isActive = typeFilter[type] !== false
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter((prev) => ({ ...prev, [type]: !isActive }))}
                    onDoubleClick={() => {
                      const allActive = EVENT_TYPES.every(({ type: itemType }) => typeFilter[itemType] !== false)
                      toggleAllFilters(!allActive)
                    }}
                    className={
                      `inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ` +
                      `border border-navy/15 dark:border-cream/15 ` +
                      `${isActive
                        ? 'bg-navy/5 text-navy dark:bg-cream/10 dark:text-cream'
                        : 'text-navy/70 hover:bg-navy/5 dark:text-cream/70 dark:hover:bg-cream/10'
                      }`
                    }
                  >
                    <span className={isActive ? ICON_COLORS[type] : 'text-navy/30 dark:text-cream/30'}>
                      <EventIcon type={type} size="sm" />
                    </span>
                    <span>{t(labelKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-1 lg:h-full">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-navy/10 bg-cream/75 dark:border-cream/15 dark:bg-navy/75">
            <div className="border-b border-navy/10 px-4 py-3 dark:border-cream/15">
              <span className="block text-sm font-bold text-navy dark:text-cream">
                {t('calendar.mobileSelectedDay')}
              </span>
              <span className="mt-1 block text-left text-sm font-bold text-navy/80 dark:text-cream/80">
                {selectedDayLabel}
              </span>
            </div>

            {selectedDayEvents.length === 0 && (
              <div className="flex-1 px-4 py-6 text-sm text-navy/60 dark:text-cream/60">
                {t('calendar.mobileNoEvents')}
              </div>
            )}

            {selectedDayEvents.length > 0 && (
              <div className="flex-1 divide-y divide-navy/10 overflow-y-auto dark:divide-cream/10">
                {selectedDayEvents.map((eventItem) => {
                  const isRegistered = registeredEventIds.has(eventItem.id)
                  const availability = availabilityByEventId[eventItem.id] || null
                  const maxParticipants = availability?.max_participants ?? null
                  const occupiedCount = availability?.occupied_count ?? null
                  const progressRatio = maxParticipants
                    ? Math.min(Math.max((occupiedCount || 0) / maxParticipants, 0), 1)
                    : 0
                  const progressPercent = progressRatio * 100
                  const progressTone = getProgressTone(progressRatio)
                  const tone = getTone(eventItem.type)

                  return (
                    <Link
                      key={eventItem.id}
                      to={getEventPath(eventItem)}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-navy/5 dark:hover:bg-cream/5"
                    >
                      <span className={`h-10 w-1.5 rounded-full ${tone.line}`} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-cream">
                          <EventIcon type={eventItem.type} size="sm" />
                          <span className="truncate">{eventItem.title}</span>
                        </div>
                        <div className="mt-1 text-xs text-navy/65 dark:text-cream/65">
                          {eventItem.time || t('common.today')}
                          {eventItem.location ? ` · ${eventItem.location}` : ''}
                        </div>
                        {maxParticipants != null && occupiedCount != null && (
                          <div className="mt-2">
                            <div className="relative h-2 w-full rounded-full bg-navy/10 dark:bg-cream/10">
                              <span
                                className={`absolute left-0 top-0 h-full rounded-full ${progressTone}`}
                                style={{ width: `${progressRatio * 100}%` }}
                              />
                              <span
                                className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${progressTone}`}
                                style={{
                                  left: progressRatio <= 0
                                    ? '0%'
                                    : progressRatio >= 1
                                      ? 'calc(100% - 5px)'
                                      : `calc(${progressPercent}% - 5px)`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-navy/60 dark:text-cream/60">
                          {isRegistered && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                              {t('calendar.registered')}
                            </span>
                          )}
                          {maxParticipants != null && occupiedCount != null && (
                            <span>{occupiedCount}/{maxParticipants}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Calendar
