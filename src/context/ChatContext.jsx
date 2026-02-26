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
  const [latestMessages, setLatestMessages] = useState({})
  // pendingRefresh tracks chatIds that have new messages detected by polling
  const [pendingRefresh, setPendingRefresh] = useState({})

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

  const setLatestMessageTime = useCallback((chatId, timestampOrObj) => {
    if (!timestampOrObj) return
    setLatestMessages((prev) => {
      const incoming = typeof timestampOrObj === 'string'
        ? { ts: timestampOrObj, text: null, author: null }
        : { ts: timestampOrObj.ts, text: timestampOrObj.text ?? null, author: timestampOrObj.author ?? null }
      const current = prev[chatId]
      if (current && current.ts >= incoming.ts) return prev
      return { ...prev, [chatId]: incoming }
    })
  }, [])

  const hasUnread = useCallback((chatId) => {
    const msg = latestMessages[chatId]
    if (!msg) return false
    const ts = typeof msg === 'string' ? msg : msg.ts
    if (!ts) return false
    const lastRead = lastReadTimestamps[chatId]
    if (!lastRead) return true  // never read
    return new Date(ts) > new Date(lastRead)
  }, [latestMessages, lastReadTimestamps])

  const addPendingRefresh = useCallback((chatId) => {
    setPendingRefresh((prev) => prev[chatId] ? prev : { ...prev, [chatId]: true })
  }, [])

  const clearPendingRefresh = useCallback((chatId) => {
    setPendingRefresh((prev) => {
      if (!prev[chatId]) return prev
      const next = { ...prev }
      delete next[chatId]
      return next
    })
  }, [])

  const totalUnread = useMemo(() => {
    return Object.keys(latestMessages).filter((chatId) => hasUnread(chatId)).length
  }, [latestMessages, hasUnread])

  const value = useMemo(
    () => ({
      ...chatState,
      openChat, closeChat, navigateChat,
      markAsRead, setLatestMessageTime,
      hasUnread, totalUnread,
      lastReadTimestamps, latestMessages,
      pendingRefresh, addPendingRefresh, clearPendingRefresh,
    }),
    [chatState, openChat, closeChat, navigateChat, markAsRead, setLatestMessageTime, hasUnread, totalUnread, lastReadTimestamps, latestMessages, pendingRefresh, addPendingRefresh, clearPendingRefresh],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

export { ChatProvider, useChat }
