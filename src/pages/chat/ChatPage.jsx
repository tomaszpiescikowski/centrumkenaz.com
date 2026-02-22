import { useEffect, useState, useCallback } from 'react'
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
  const { isAuthenticated, authFetch } = useAuth()
  const {
    view, eventId, eventTitle,
    navigateChat,
    markAsRead, hasUnread, setLatestMessageTime,
  } = useChat()
  const navigate = useNavigate()

  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Load registered events
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

  // Mark current chat as read when viewing it
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
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  const activeTab = view === 'general' ? 'general' : 'events'

  return (
    <div className="chat-page-root">
      {/* ?????? Header ?????? */}
      <div className="chat-modal-header">
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
            <span className="chat-modal-title chat-modal-title-truncate">
              {eventTitle || t('comments.eventChat')}
            </span>
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
        {/* No X close button on mobile ??? user uses bottom nav */}
      </div>

      {/* ?????? Body ?????? */}
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
        <div className="chat-modal-body chat-event-list-body">
          {!isAuthenticated ? (
            <div className="chat-event-list-empty">
              <p>{t('comments.loginToSeeEvents')}</p>
            </div>
          ) : eventsLoading ? (
            <div className="chat-event-list-empty">
              <p>{t('comments.loading')}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="chat-event-list-empty">
              <p>{t('comments.noRegisteredEvents')}</p>
            </div>
          ) : (
            <ul className="chat-event-list">
              {events.map((ev) => {
                const chatId = `event:${ev.id}`
                const unread = hasUnread(chatId)
                return (
                  <li key={ev.id}>
                    <button
                      className="chat-event-item"
                      onClick={() => handleEventClick(ev)}
                    >
                      <span className="chat-event-icon">
                        <EventIcon type={ev.type} size="sm" />
                      </span>
                      <span className="chat-event-info">
                        <span className="chat-event-title">{ev.title}</span>
                        <span className="chat-event-meta">
                          {ev.city} ?? {formatDate(ev.startDateTime)}
                        </span>
                      </span>
                      {unread && <span className="chat-unread-dot" aria-label="unread" />}
                      <svg className="chat-event-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  )
}

export default ChatPage
