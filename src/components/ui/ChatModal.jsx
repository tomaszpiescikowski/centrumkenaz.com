import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { fetchRegisteredEvents } from '../../api/events'
import CommentsSection from '../common/CommentsSection'
import EventIcon from '../common/EventIcon'
import { useCustomEventTypes } from '../../hooks/useCustomEventTypes'
import '../common/CommentsSection.css'

const TYPE_PALETTE = {
  karate:     { bg: '#0891b2', gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  mors:       { bg: '#2563eb', gradient: 'linear-gradient(135deg,#60a5fa,#2563eb)' },
  planszowki: { bg: '#7c3aed', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  ognisko:    { bg: '#ea580c', gradient: 'linear-gradient(135deg,#fb923c,#ea580c)' },
  spacer:     { bg: '#059669', gradient: 'linear-gradient(135deg,#34d399,#059669)' },
  joga:       { bg: '#db2777', gradient: 'linear-gradient(135deg,#f472b6,#db2777)' },
  wyjazd:     { bg: '#d97706', gradient: 'linear-gradient(135deg,#fbbf24,#d97706)' },
  inne:       { bg: '#475569', gradient: 'linear-gradient(135deg,#94a3b8,#475569)' },
}
function strHash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
const HASH_PALETTE = [
  { bg: '#0891b2', gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  { bg: '#7c3aed', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { bg: '#059669', gradient: 'linear-gradient(135deg,#34d399,#059669)' },
  { bg: '#db2777', gradient: 'linear-gradient(135deg,#f472b6,#db2777)' },
  { bg: '#d97706', gradient: 'linear-gradient(135deg,#fbbf24,#d97706)' },
  { bg: '#dc2626', gradient: 'linear-gradient(135deg,#f87171,#dc2626)' },
]
function getTypePalette(type, customTypes = []) {
  if (TYPE_PALETTE[type]) return TYPE_PALETTE[type]
  const ct = customTypes.find((c) => c.key === type)
  if (ct?.color) return HASH_PALETTE[strHash(type) % HASH_PALETTE.length]
  return HASH_PALETTE[strHash(type) % HASH_PALETTE.length]
}
function formatMsgTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function formatRelativeTime(isoStr, locale) {
  if (!isoStr) return ''
  const diffMs = Date.now() - new Date(isoStr).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  try {
    const rtf = new Intl.RelativeTimeFormat(locale || 'pl-PL', { numeric: 'auto' })
    if (diffSec < 60) return rtf.format(-diffSec, 'second')
    if (diffMin < 60) return rtf.format(-diffMin, 'minute')
    if (diffH < 24) return rtf.format(-diffH, 'hour')
    return rtf.format(-diffD, 'day')
  } catch {
    if (diffMin < 60) return `${diffMin} min`
    if (diffH < 24) return `${diffH} h`
    return `${diffD} d`
  }
}

function initials(name) {
  return (name || '').split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
}

/**
 * Global chat overlay with three views:
 *  1. General chat   – general/global CommentsSection
 *  2. Event list     – list of user's registered events
 *  3. Event chat     – CommentsSection for a specific event
 *
 * Opened / controlled via ChatContext.
 */
function ChatModal() {
  const { t, currentLanguage } = useLanguage()
  const { isAuthenticated, authFetch } = useAuth()
  const {
    open, view, eventId, eventTitle, eventData,
    closeChat, navigateChat, markAsRead,
    hasUnread, unreadCounts, setLatestMessageTime, latestMessages,
  } = useChat()
  const { customTypes } = useCustomEventTypes()
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const panelRef = useRef(null)

  // Persisted modal size (desktop)
  const [modalSize, setModalSize] = useState(() => {
    try {
      const raw = localStorage.getItem('kenaz.chatModalSize')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return null
  })

  // ResizeObserver — persist size when user drags the resize handle
  useEffect(() => {
    const el = panelRef.current
    if (!el || !open) return
    let skipFirst = true
    const ro = new ResizeObserver((entries) => {
      if (skipFirst) { skipFirst = false; return }
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          const size = { width: Math.round(width), height: Math.round(height) }
          setModalSize(size)
          localStorage.setItem('kenaz.chatModalSize', JSON.stringify(size))
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => { if (e.key === 'Escape') closeChat() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeChat])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Load registered events when switching to events view
  const loadEvents = useCallback(async () => {
    if (!isAuthenticated) return
    setEventsLoading(true)
    try {
      const data = await fetchRegisteredEvents(authFetch)
      setEvents(data)
    } catch {
      setEvents([])
    } finally {
      setEventsLoading(false)
    }
  }, [isAuthenticated, authFetch])

  useEffect(() => {
    if (open && view === 'events') loadEvents()
  }, [open, view, loadEvents])

  // Mark chat as read when entering a specific view
  useEffect(() => {
    if (!open) return
    if (view === 'general') markAsRead('general:global')
    if (view === 'event' && eventId) markAsRead(`event:${eventId}`)
  }, [open, view, eventId, markAsRead])

  if (!open) return null

  // On mobile, chat is a dedicated page (/chat) — don't render modal overlay
  if (typeof window !== 'undefined' && window.innerWidth < 640) return null

  const handleEventClick = (ev) => {
    navigateChat('event', { eventId: ev.id, eventTitle: ev.title, eventData: ev })
  }

  const handleGoToEvent = () => {
    closeChat()
    navigate(`/event/${eventId}`)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString(currentLanguage === 'pl' ? 'pl-PL' : 'en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  // Active tab for the top tabs
  const activeTab = view === 'general' ? 'general' : 'events'

  return (
    <div
      className="chat-modal-backdrop"
      onClick={(e) => {
        // On mobile (full-page mode) don't close on backdrop click
        if (window.innerWidth < 640) return
        if (e.target === e.currentTarget) closeChat()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('comments.chatTitle')}
    >
      <div
        ref={panelRef}
        className="chat-modal-panel"
        style={modalSize ? { width: modalSize.width, height: modalSize.height } : undefined}
      >
        {/* ── Header ── */}
        <div className={`chat-modal-header${view === 'event' ? ' chat-modal-header--event' : ''}`}>
          <div className="chat-modal-header-row">
            {/* Back button when in event chat */}
            {view === 'event' && (
              <button
                className="chat-modal-back"
                onClick={() => navigateChat('events')}
                aria-label={t('comments.back')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}

            {view === 'event' ? (
              <div className="chat-modal-event-header">
                <span className="chat-modal-title chat-modal-title-truncate">{eventTitle || t('comments.eventChat')}</span>
                <button
                  className="chat-modal-goto"
                  onClick={handleGoToEvent}
                  aria-label={t('comments.goToEvent')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {t('comments.goToEvent')}
                </button>
              </div>
            ) : (
              <div className="cmt-tabs" style={{ margin: 0, flex: 1 }}>
                <button
                  className={`cmt-tab ${activeTab === 'general' ? 'cmt-tab-active' : ''}`}
                  onClick={() => navigateChat('general')}
                >
                  {t('comments.tabGeneral')}
                </button>
                <button
                  className={`cmt-tab ${activeTab === 'events' ? 'cmt-tab-active' : ''}`}
                  onClick={() => navigateChat('events')}
                >
                  {t('comments.tabEvents')}
                </button>
              </div>
            )}

            <button
              className="chat-modal-close"
              onClick={closeChat}
              aria-label={t('comments.cancel')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Event details sub-header */}
          {view === 'event' && eventData && (() => {
            const locale = currentLanguage === 'pl' ? 'pl-PL' : 'en-GB'
            const palette = getTypePalette(eventData.type, customTypes)
            const d = new Date(eventData.startDateTime)
            const dateStr = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
            const timeStr = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            return (
              <div className="cp-ev-subheader cp-ev-subheader--modal">
                {eventData.type && (
                  <span className="cp-ev-sub-tag" style={{ color: palette.bg, borderColor: palette.bg + '40', background: palette.bg + '18' }}>
                    {eventData.type}
                  </span>
                )}
                <span className="cp-ev-sub-info">{dateStr}&nbsp;&middot;&nbsp;{timeStr}</span>
                {eventData.city && <span className="cp-ev-sub-info">{eventData.city}</span>}
                {eventData.location && <span className="cp-ev-sub-info">{eventData.location}</span>}
                {eventData.maxParticipants && (
                  <span className="cp-ev-sub-info">max.&nbsp;{eventData.maxParticipants}</span>
                )}
              </div>
            )
          })()}
        </div>

        {/* ── Body ── */}
        {view === 'general' && (
          <div className="chat-modal-body">
            <CommentsSection
              resourceType="general"
              resourceId="global"
              activeTab="general"
              hideHeader
              hideTabs
              messengerLayout
              chatId="general:global"
              onLatestMessage={(ts) => setLatestMessageTime('general:global', ts)}
            />
          </div>
        )}

        {view === 'events' && (
          <div className="cp-event-list-wrap">
            {!isAuthenticated ? (
              <div className="cp-empty"><p>{t('comments.loginToSeeEvents')}</p></div>
            ) : eventsLoading ? (
              <div className="cp-empty"><p>{t('comments.loading')}</p></div>
            ) : events.length === 0 ? (
              <div className="cp-empty"><p>{t('comments.noRegisteredEvents')}</p></div>
            ) : (() => {
              const locale = currentLanguage === 'pl' ? 'pl-PL' : 'en-GB'
              const sorted = [...events].sort((a, b) => {
                const aP = new Date(a.startDateTime) < new Date()
                const bP = new Date(b.startDateTime) < new Date()
                if (aP !== bP) return aP ? 1 : -1
                return new Date(a.startDateTime) - new Date(b.startDateTime)
              })
              return (
                <ul className="cp-ev-list">
                  {sorted.map((ev, idx) => {
                    const chatId = `event:${ev.id}`
                    const unread = hasUnread(chatId)
                    const unreadCount = unreadCounts[chatId] || 0
                    const previewMsg = latestMessages[chatId]
                    const isPast = new Date(ev.startDateTime) < new Date()
                    const palette = getTypePalette(ev.type, customTypes)

                    const prevEv = sorted[idx - 1]
                    const prevIsPast = prevEv ? new Date(prevEv.startDateTime) < new Date() : false
                    const showPastDivider = isPast && !prevIsPast && idx > 0

                    const authorShort = previewMsg?.author
                      ? previewMsg.author.split(' ')[0].replace(/^~/, '')
                      : null
                    const previewText = previewMsg?.text
                      ? (previewMsg.text.length > 55 ? previewMsg.text.slice(0, 55) + '\u2026' : previewMsg.text)
                      : null
                    const timeLabel = previewMsg?.ts
                      ? formatMsgTime(previewMsg.ts)
                      : formatDate(ev.startDateTime)

                    const evDate = new Date(ev.startDateTime)
                    const now = new Date()
                    const isToday = !isPast &&
                      evDate.getDate() === now.getDate() &&
                      evDate.getMonth() === now.getMonth() &&
                      evDate.getFullYear() === now.getFullYear()

                    const tomorrow = new Date(now)
                    tomorrow.setDate(tomorrow.getDate() + 1)
                    const isTomorrow = !isPast && !isToday &&
                      evDate.getDate() === tomorrow.getDate() &&
                      evDate.getMonth() === tomorrow.getMonth() &&
                      evDate.getFullYear() === tomorrow.getFullYear()

                    const evTime = ev.startDateTime
                      ? new Date(ev.startDateTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
                      : null

                    const authors = previewMsg?.recentAuthors

                    return (
                      <li key={ev.id}>
                        {showPastDivider && (
                          <div className="cp-section-divider">
                            <span>{t('comments.pastEvents')}</span>
                          </div>
                        )}
                        <button
                          className={`cp-ev-row${isPast ? ' cp-ev-row--past' : ''}${unread ? ' cp-ev-row--unread' : ''}`}
                          style={{ '--ev-color': palette.bg }}
                          onClick={() => handleEventClick(ev)}
                        >
                          {/* Line 1: icon + title + timestamp */}
                          <span className="cp-ev-top">
                            <span className="cp-ev-icon" style={{ color: palette.bg }}>
                              <EventIcon type={ev.type} size="sm" customTypes={customTypes} />
                            </span>
                            <span className={`cp-ev-title${unread ? ' cp-ev-title--bold' : ''}`}>{ev.title}</span>
                            <span className="cp-ev-ts">{timeLabel}</span>
                          </span>

                          {/* Line 2: avatars (left) + meta + today + badge / chevron */}
                          <span className="cp-ev-bottom">
                            {authors?.length > 0 && (
                              <span className="cp-ev-avs">
                                {authors.slice(0, 3).map((a, i) => (
                                  <span key={a.id} className="cmt-reply-av" style={{ zIndex: 3 - i }}>
                                    {a.picture_url
                                      ? <img src={a.picture_url} alt={a.full_name} />
                                      : <span>{initials(a.full_name)}</span>
                                    }
                                  </span>
                                ))}
                              </span>
                            )}
                            <span className="cp-ev-meta">
                              {ev.city}
                              {ev.city && evTime && <> &middot;</>}
                              {evTime && <> {isToday ? evTime : formatDate(ev.startDateTime)}</>}
                              {!ev.city && !evTime && formatDate(ev.startDateTime)}
                            </span>
                            {isToday && <span className="cp-ev-today">{t('comments.today')}</span>}
                            {isTomorrow && <span className="cp-ev-tomorrow">{t('comments.tomorrow')}</span>}
                            {unread
                              ? <span className="cp-ev-badge">{unreadCount > 9 ? '9+' : unreadCount > 0 ? unreadCount : '•'}</span>
                              : <span className="cp-ev-chevron"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                            }
                          </span>

                          {/* Line 3 (optional): latest message preview */}
                          {previewText && (
                            <span className={`cp-ev-preview${unread ? ' cp-ev-preview--bold' : ''}`}>
                              {authorShort && (
                                <><strong className="cp-ev-preview-name">{authorShort}</strong><em className="cp-ev-preview-verb">&nbsp;{t('comments.wroteMessage')}:</em>{' '}</>
                              )}
                              <span className="cp-ev-preview-text">{previewText}</span>
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            })()}
          </div>
        )}

        {view === 'event' && eventId && (
          <div className="chat-modal-body">
            <CommentsSection
              resourceType="event"
              resourceId={eventId}
              activeTab="event"
              hideHeader
              hideTabs
              messengerLayout
              chatId={`event:${eventId}`}
              onLatestMessage={(ts) => setLatestMessageTime(`event:${eventId}`, ts)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatModal
