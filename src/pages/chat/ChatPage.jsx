import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { fetchRegisteredEvents } from '../../api/events'
import CommentsSection from '../../components/common/CommentsSection'
import EventIcon from '../../components/common/EventIcon'
import { useCustomEventTypes } from '../../hooks/useCustomEventTypes'
import '../../components/common/CommentsSection.css'

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
  if (ct?.color) {
    const idx = strHash(type) % HASH_PALETTE.length
    return HASH_PALETTE[idx]
  }
  return HASH_PALETTE[strHash(type) % HASH_PALETTE.length]
}

function initials(name) {
  return (name || '').split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
}

function ChatPage() {
  const { t, currentLanguage } = useLanguage()
  const { isAuthenticated, user, authFetch } = useAuth()
  const { customTypes } = useCustomEventTypes()

  const isPendingApproval = isAuthenticated && user?.account_status !== 'active'
  const {
    view, eventId, eventTitle,
    navigateChat,
    markAsRead, hasUnread, unreadCounts, setLatestMessageTime, latestMessages,
    setRegisteredEvents,
  } = useChat()
  const navigate = useNavigate()

  const cpRootRef = useRef(null)

  // On mobile PWA: make the root fill the visual viewport at all times so that:
  //   - keyboard open → root shrinks to visible area, compose box stays above keyboard
  //   - keyboard closed → root sits between notch and bottom nav
  //   - header always at top, scrollable list in middle, compose always at bottom
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const el = cpRootRef.current
    if (!el) return

    // Capture full height at mount (before keyboard). Needed for Android Chrome
    // where window.innerHeight also shrinks when keyboard opens, making a
    // live comparison of vv.height vs window.innerHeight always near 0.
    const fullHeight = Math.max(vv.height, window.innerHeight)

    const apply = () => {
      // MobileBottomNav owns the kb-open class globally — do NOT toggle it here.
      const kbOpen = vv.height < fullHeight - 120
      if (kbOpen) {
        // Keyboard visible — fit exactly to visual viewport so compose stays above keys
        el.style.top = vv.offsetTop + 'px'
        el.style.height = vv.height + 'px'
        el.style.bottom = 'auto'
      } else {
        // Keyboard hidden — let CSS drive the size (position:fixed, bottom = nav height)
        el.style.top = ''
        el.style.height = ''
        el.style.bottom = ''
      }
    }

    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      // Do NOT touch kb-open here — MobileBottomNav will clear it when vv.resize fires
      el.style.top = ''; el.style.height = ''; el.style.bottom = ''
    }
  }, [])

  // null = never fetched; [] = fetched and empty; [...] = fetched with data
  const [events, setEvents] = useState(null)
  const [eventsLoading, setEventsLoading] = useState(false)

  const loadEvents = useCallback(async () => {
    if (!isAuthenticated) return
    setEventsLoading(true)
    try {
      const data = await fetchRegisteredEvents(authFetch)
      setEvents(data)
      setRegisteredEvents(data)
    } catch {
      setEvents([])
      setRegisteredEvents([])
    } finally {
      setEventsLoading(false)
    }
  }, [isAuthenticated, authFetch, setRegisteredEvents])

  useEffect(() => {
    if (view === 'events') loadEvents()
  }, [view, loadEvents])

  useEffect(() => {
    if (view === 'general') markAsRead('general:global')
    if (view === 'event' && eventId) markAsRead(`event:${eventId}`)
  }, [view, eventId, markAsRead])

  const handleEventClick = (ev) => {
    navigateChat('event', { eventId: ev.id, eventTitle: ev.title })
  }

  const handleGoToEvent = () => {
    navigate(`/event/${eventId}`)
  }

  const locale = currentLanguage === 'pl' ? 'pl-PL' : 'en-GB'

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }

  // WhatsApp-style time: today → HH:MM, this week → weekday, older → d MMM
  const formatMsgTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now - d
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays < 1) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    if (diffDays < 7) return d.toLocaleDateString(locale, { weekday: 'short' })
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }

  const sortedEvents = events ? (() => {
    const now = new Date()
    const upcoming = events.filter(ev => new Date(ev.startDateTime) >= now)
      .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    const past = events.filter(ev => new Date(ev.startDateTime) < now)
      .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime))
    return [...upcoming, ...past]
  })() : []

  const activeTab = view === 'general' ? 'general' : 'events'

  // Blurred mock for unauthenticated / pending-approval users.
  // PendingApprovalOverlay (Layout) renders the login / pending card on top.
  if (!isAuthenticated || isPendingApproval) {
    const mockMsgs = [
      { initials: 'KN', name: 'Kasia Nowak',      time: '08:12', text: 'Hej, czy sala A będzie dostępna jutro rano? 🏋️' },
      { initials: 'TM', name: 'Tomek Malinowski', time: '08:15', text: 'Tak, od 7:00 do 9:30 – sprawdziłem w grafiku 👍' },
      { initials: 'AL', name: 'Ana Lima',          time: '08:45', text: 'Świetne zajęcia wczoraj 🔥 Zobaczymy się w środę!' },
      { initials: 'MW', name: 'Marek Wiśniewski', time: '09:02', text: 'Pamiętajcie o warsztacie Wim Hof w niedzielę – miejsca się kończą!' },
      { initials: 'KN', name: 'Kasia Nowak',      time: '09:05', text: 'Już zapisana! Do zobaczenia 🙌' },
    ]
    return (
      <div className="cp-root" ref={cpRootRef}>
        <div className="pointer-events-none select-none blur-[3px] flex h-full flex-col overflow-hidden">
          {/* Header */}
          <div className="cp-header">
            <div className="cp-tabs">
              <button className="cp-tab cp-tab-active">{t('comments.tabGeneral')}</button>
              <button className="cp-tab">{t('comments.tabEvents')}</button>
            </div>
          </div>

          {/* Body – messenger mock */}
          <div className="cp-body">
            <div className="cmt-section cmt-messenger">
              <div className="cmt-list cmt-list-messenger">
                <div className="cmt-list-spacer" />
                {mockMsgs.map((m, i) => (
                  <div key={i} className="cmt-item">
                    <div className="cmt-item-body">
                      <div className="cmt-header">
                        <div className="cmt-avatar-link">
                          <div className="cmt-av-wrap">
                            <div className="cmt-av">{m.initials}</div>
                          </div>
                        </div>
                        <div className="cmt-meta">
                          <span className="cmt-author">{m.name}</span>
                          <span className="cmt-time">{m.time}</span>
                        </div>
                      </div>
                      <div className="cmt-content">{m.text}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Mock compose bar */}
              <div className="cmt-new-form">
                <div className="cmt-new-row">
                  <div className="cmt-input-wrap cmt-input-wrap-messenger">
                    <textarea
                      className="cmt-input cmt-input-new cmt-input-messenger"
                      rows={1}
                      readOnly
                      placeholder={t('comments.placeholder')}
                    />
                  </div>
                  <button type="button" className="cmt-btn cmt-btn-primary" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cp-root" ref={cpRootRef}>
      {/* ?????? Fixed header below notch ?????? */}
      <div className="cp-header">
        {view === 'event' ? (
          <div className="cp-event-header">
            <button
              className="cp-back-btn"
              onClick={() => navigateChat('events')}
              aria-label={t('comments.back')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="cp-event-title">{eventTitle || t('comments.eventChat')}</span>
            <button
              className="cp-goto-btn"
              onClick={handleGoToEvent}
              aria-label={t('comments.goToEvent')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="cp-tabs">
            <button
              className={`cp-tab ${activeTab === 'general' ? 'cp-tab-active' : ''}`}
              onClick={() => navigateChat('general')}
            >
              {t('comments.tabGeneral')}
            </button>
            <button
              className={`cp-tab ${activeTab === 'events' ? 'cp-tab-active' : ''}`}
              onClick={() => navigateChat('events')}
            >
              {t('comments.tabEvents')}
            </button>
          </div>
        )}
      </div>

      {/* ?????? Scrollable body ?????? */}
      <div className="cp-body">
        {view === 'general' && (
          <CommentsSection
            resourceType="general"
            resourceId="global"
            activeTab="general"
            hideHeader
            hideTabs
            messengerLayout
            chatId="general:global"
            onLatestMessage={(msg) => setLatestMessageTime('general:global', msg)}
          />
        )}

        {view === 'events' && (
          <div className="cp-event-list-wrap">
            {!isAuthenticated ? (
              <div className="cp-empty"><p>{t('comments.loginToSeeEvents')}</p></div>
            ) : eventsLoading || events === null ? (
              <div className="cp-empty"><p>{t('comments.loading')}</p></div>
            ) : events.length === 0 ? (
              <div className="cp-empty"><p>{t('comments.noRegisteredEvents')}</p></div>
            ) : (
              <ul className="cp-ev-list">
                {sortedEvents.map((ev, idx) => {
                  const chatId = `event:${ev.id}`
                  const unread = hasUnread(chatId)
                  const unreadCount = unreadCounts[chatId] || 1
                  const previewMsg = latestMessages[chatId]
                  const isPast = new Date(ev.startDateTime) < new Date()
                  const palette = getTypePalette(ev.type, customTypes)

                  // Section divider between upcoming and past
                  const prevEv = sortedEvents[idx - 1]
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

                  // "Dziś" label for today's events
                  const evDate = new Date(ev.startDateTime)
                  const now = new Date()
                  const isToday = !isPast &&
                    evDate.getDate() === now.getDate() &&
                    evDate.getMonth() === now.getMonth() &&
                    evDate.getFullYear() === now.getFullYear()

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

                        {/* Line 2: meta + today + avatars + unread badge / chevron */}
                        <span className="cp-ev-bottom">
                          <span className="cp-ev-meta">
                            {ev.city}
                            {ev.city && evTime && <> &middot;</>}
                            {evTime && <> {isToday ? evTime : formatDate(ev.startDateTime)}</>}
                            {!ev.city && !evTime && formatDate(ev.startDateTime)}
                          </span>
                          {isToday && <span className="cp-ev-today">{t('comments.today')}</span>}
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
                          {unread
                            ? <span className="cp-ev-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            : <span className="cp-ev-chevron"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                          }
                        </span>

                        {/* Line 3 (optional): latest message preview */}
                        {previewText && (
                          <span className={`cp-ev-preview${unread ? ' cp-ev-preview--bold' : ''}`}>
                            {authorShort && <span className="cp-ev-preview-who">{authorShort}:&nbsp;</span>}
                            {previewText}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {view === 'event' && eventId && (
          <CommentsSection
            resourceType="event"
            resourceId={eventId}
            hideHeader
            hideTabs
            messengerLayout
            chatId={`event:${eventId}`}
            onLatestMessage={(msg) => setLatestMessageTime(`event:${eventId}`, msg)}
          />
        )}
      </div>
    </div>
  )
}

export default ChatPage
