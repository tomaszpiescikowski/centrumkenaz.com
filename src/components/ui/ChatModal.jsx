import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { fetchRegisteredEvents } from '../../api/events'
import CommentsSection from '../common/CommentsSection'
import EventIcon from '../common/EventIcon'
import '../common/CommentsSection.css'

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
    open, view, eventId, eventTitle,
    closeChat, navigateChat,
    hasUnread, unreadCounts, setLatestMessageTime,
  } = useChat()
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

  if (!open) return null

  // On mobile, chat is a dedicated page (/chat) — don't render modal overlay
  if (typeof window !== 'undefined' && window.innerWidth < 640) return null

  const handleEventClick = (ev) => {
    navigateChat('event', { eventId: ev.id, eventTitle: ev.title })
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
        <div className="chat-modal-header">
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
                            {ev.city} · {formatDate(ev.startDateTime)}
                          </span>
                        </span>
                        {unread && <span className="chat-unread-badge" aria-label="unread">{(unreadCounts[chatId] || 0) > 9 ? '9+' : (unreadCounts[chatId] || 1)}</span>}
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
    </div>
  )
}

export default ChatModal
