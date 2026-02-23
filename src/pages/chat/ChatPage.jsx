import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { fetchRegisteredEvents } from '../../api/events'
import CommentsSection from '../../components/common/CommentsSection'
import EventIcon from '../../components/common/EventIcon'
import '../../components/common/CommentsSection.css'

function ChatPage() {
  const { t, currentLanguage } = useLanguage()
  const { isAuthenticated, user, authFetch } = useAuth()

  const isPendingApproval = isAuthenticated && user?.account_status !== 'active'
  const {
    view, eventId, eventTitle,
    navigateChat,
    markAsRead, hasUnread, setLatestMessageTime,
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

    const apply = () => {
      // MobileBottomNav owns the kb-open class globally — do NOT toggle it here
      // (duplicate toggling caused a race condition: ChatPage cleanup removed the
      // class on unmount just as MobileBottomNav's listener re-added it, leaving
      // the nav transform permanently stuck in the slid-out position).
      const kbOpen = vv.height < window.innerHeight - 100
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

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)

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

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString(currentLanguage === 'pl' ? 'pl-PL' : 'en-GB', {
      day: 'numeric', month: 'short',
    })
  }

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
            onLatestMessage={(ts) => setLatestMessageTime('general:global', ts)}
          />
        )}

        {view === 'events' && (
          <div className="cp-event-list-wrap">
            {!isAuthenticated ? (
              <div className="cp-empty"><p>{t('comments.loginToSeeEvents')}</p></div>
            ) : eventsLoading ? (
              <div className="cp-empty"><p>{t('comments.loading')}</p></div>
            ) : events.length === 0 ? (
              <div className="cp-empty"><p>{t('comments.noRegisteredEvents')}</p></div>
            ) : (
              <ul className="cp-event-list">
                {events.map((ev) => {
                  const chatId = `event:${ev.id}`
                  const unread = hasUnread(chatId)
                  return (
                    <li key={ev.id}>
                      <button className="cp-event-item" onClick={() => handleEventClick(ev)}>
                        <span className="cp-event-icon">
                          <EventIcon type={ev.type} size="sm" />
                        </span>
                        <span className="cp-event-info">
                          <span className="cp-event-title-text">{ev.title}</span>
                          <span className="cp-event-meta">{ev.city} &middot; {formatDate(ev.startDateTime)}</span>
                        </span>
                        {unread && <span className="chat-unread-dot" aria-label="unread" />}
                        <svg className="cp-event-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
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
            onLatestMessage={(ts) => setLatestMessageTime(`event:${eventId}`, ts)}
          />
        )}
      </div>
    </div>
  )
}

export default ChatPage
