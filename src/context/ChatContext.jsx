import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ChatContext = createContext(null)

// localStorage helpers
const LS_KEY = 'kenaz.chat.lastRead'
function loadLastRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveLastRead(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

/**
 * Global chat state provider.
 *
 * openChat() / navigateChat() controls which chat panel/tab is shown.
 * Unread tracking: 
 *   - lastReadTimestamps[chatId] = ISO string when user last read that chat
 *   - latestMessageTimes[chatId] = ISO string of most recent message
 *   hasUnread(chatId) = latestMessageTimes[chatId] > lastReadTimestamps[chatId]
 */
function ChatProvider({ children }) {
  const [chatState, setChatState] = useState({
    open: false,
    view: 'general',   // 'general' | 'events' | 'event'
    eventId: null,
    eventTitle: null,
  })

  const [lastReadTimestamps, setLastReadTimestamps] = useState(loadLastRead)
  const [latestMessageTimes, setLatestMessageTimes] = useState({})

  const openChat = useCallback((opts = {}) => {
    if (opts.eventId) {
      setChatState({ open: true, view: 'event', eventId: opts.eventId, eventTitle: opts.eventTitle || null })
    } else if (opts.view === 'events') {
      setChatState({ open: true, view: 'events', eventId: null, eventTitle: null })
    } else {
      setChatState({ open: true, view: 'general', eventId: null, eventTitle: null })
    }
  }, [])

  const closeChat = useCallback(() => {
    setChatState((s) => ({ ...s, open: false }))
  }, [])

  const navigateChat = useCallback((view, opts = {}) => {
    setChatState((s) => ({
      ...s,
      view,
      eventId: opts.eventId ?? null,
      eventTitle: opts.eventTitle ?? null,
    }))
  }, [])

  const markAsRead = useCallback((chatId) => {
    const now = new Date().toISOString()
    setLastReadTimestamps((prev) => {
      const next = { ...prev, [chatId]: now }
      saveLastRead(next)
      return next
    })
  }, [])

  const setLatestMessageTime = useCallback((chatId, timestamp) => {
    if (!timestamp) return
    setLatestMessageTimes((prev) => {
      const ts = typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString()
      if (prev[chatId] === ts) return prev
      return { ...prev, [chatId]: ts }
    })
  }, [])

  const hasUnread = useCallback((chatId) => {
    const latest = latestMessageTimes[chatId]
    if (!latest) return false
    const lastRead = lastReadTimestamps[chatId]
    if (!lastRead) return true  // never read
    return new Date(latest) > new Date(lastRead)
  }, [latestMessageTimes, lastReadTimestamps])

  const totalUnread = useMemo(() => {
    return Object.keys(latestMessageTimes).filter((chatId) => hasUnread(chatId)).length
  }, [latestMessageTimes, hasUnread])

  const value = useMemo(
    () => ({
      ...chatState,
      openChat, closeChat, navigateChat,
      markAsRead, setLatestMessageTime,
      hasUnread, totalUnread,
      lastReadTimestamps, latestMessageTimes,
    }),
    [chatState, openChat, closeChat, navigateChat, markAsRead, setLatestMessageTime, hasUnread, totalUnread, lastReadTimestamps, latestMessageTimes],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

export { ChatProvider, useChat }
