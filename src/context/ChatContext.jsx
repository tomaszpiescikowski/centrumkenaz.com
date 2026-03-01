import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ChatContext = createContext(null)

// localStorage helpers
const LS_KEY = 'kenaz.chat.lastRead'
function loadLastRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveLastRead(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

const LS_KEY_MSGS = 'kenaz.chat.latestMessages'
function loadLatestMessages() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_MSGS) || '{}') } catch { return {} }
}
// Debounced save — avoid thrashing localStorage on every poll tick
let _saveMsgsTimer = null
function saveLatestMessages(data) {
  clearTimeout(_saveMsgsTimer)
  _saveMsgsTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY_MSGS, JSON.stringify(data)) } catch { /* ignore */ }
  }, 800)
}

/**
 * Global chat state provider.
 *
 * openChat() / navigateChat() controls which chat panel/tab is shown.
 * Unread tracking:
 *   - lastReadTimestamps[chatId] = ISO string when user last read that chat
 *   - latestMessageTimes[chatId] = ISO string of most recent message
 *   hasUnread(chatId) = latestMessageTimes[chatId] > lastReadTimestamps[chatId]
 *
 * WebSocket pub/sub:
 *   - subscribeWsMessages(chatId, callback) → unsubscribe()
 *     CommentsSection calls this to receive full WS messages in real-time.
 *   - dispatchWsMessage(chatId, msg) — called by ChatWSClient after each WS frame.
 *   - registerWsSend(fn) / wsSend(msg) — allow CommentsSection to send over the
 *     active WS connection instead of doing HTTP POST/PUT/DELETE.
 */
function ChatProvider({ children }) {
  const [chatState, setChatState] = useState({
    open: false,
    view: 'general',   // 'general' | 'events' | 'event'
    eventId: null,
    eventTitle: null,
    eventData: null,   // full normalized event object when in event view
    isRegistered: null, // null = unknown (e.g. from ChatPage list), true/false from EventDetail
  })

  const [lastReadTimestamps, setLastReadTimestamps] = useState(loadLastRead)
  const [latestMessages, setLatestMessages] = useState(loadLatestMessages)
  // pendingRefresh tracks chatIds that have new messages detected by polling
  const [pendingRefresh, setPendingRefresh] = useState({})
  // registeredEvents — kept in sync by ChatPage so ChatPoller can poll all chats
  const [registeredEvents, setRegisteredEventsState] = useState([])
  const setRegisteredEvents = useCallback((evts) => setRegisteredEventsState(evts || []), [])
  // Per-chat unread message counts (populated by ChatPoller)
  const unreadCountsRef = useRef({})
  const [unreadCounts, setUnreadCounts] = useState({})

  // ── WebSocket pub/sub ────────────────────────────────────────────────────
  // Map of chatId → Set<callback>. Using a ref so registrations never cause
  // re-renders and handlers always see the latest set.
  const wsHandlersRef = useRef(/** @type {Map<string, Set<Function>>} */ (new Map()))

  const subscribeWsMessages = useCallback((chatId, callback) => {
    if (!wsHandlersRef.current.has(chatId)) {
      wsHandlersRef.current.set(chatId, new Set())
    }
    wsHandlersRef.current.get(chatId).add(callback)
    // Return an unsubscribe function
    return () => {
      wsHandlersRef.current.get(chatId)?.delete(callback)
    }
  }, [])

  const dispatchWsMessage = useCallback((chatId, message) => {
    wsHandlersRef.current.get(chatId)?.forEach((cb) => {
      try { cb(message) } catch { /* isolate per-handler errors */ }
    })
  }, [])

  // ── WS send ───────────────────────────────────────────────────────────────
  // ChatWSClient sets this ref to the socket's send wrapper so any component
  // can send messages without holding a direct reference to the WebSocket.
  const wsSendRef = useRef(null)

  const registerWsSend = useCallback((fn) => {
    wsSendRef.current = fn
  }, [])

  /**
   * Send a message over the active WebSocket.
   * Returns true if sent, false if WS unavailable (caller should fall back to HTTP).
   */
  const wsSend = useCallback((msg) => {
    if (typeof wsSendRef.current === 'function') {
      wsSendRef.current(msg)
      return true
    }
    return false
  }, [])

  const openChat = useCallback((opts = {}) => {
    if (opts.eventId) {
      setChatState({ open: true, view: 'event', eventId: opts.eventId, eventTitle: opts.eventTitle || null, eventData: null, isRegistered: opts.isRegistered ?? null })
    } else if (opts.view === 'events') {
      setChatState({ open: true, view: 'events', eventId: null, eventTitle: null, eventData: null, isRegistered: null })
    } else {
      setChatState({ open: true, view: 'general', eventId: null, eventTitle: null, eventData: null, isRegistered: null })
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
      eventData: opts.eventData ?? null,
      isRegistered: opts.isRegistered ?? null,
    }))
  }, [])

  const markAsRead = useCallback((chatId) => {
    const now = new Date().toISOString()
    setLastReadTimestamps((prev) => {
      const next = { ...prev, [chatId]: now }
      saveLastRead(next)
      return next
    })
    // Clear unread count for this chat
    if (unreadCountsRef.current[chatId]) {
      unreadCountsRef.current = { ...unreadCountsRef.current, [chatId]: 0 }
      setUnreadCounts(unreadCountsRef.current)
    }
  }, [])

  const setUnreadCount = useCallback((chatId, count) => {
    if (unreadCountsRef.current[chatId] === count) return
    unreadCountsRef.current = { ...unreadCountsRef.current, [chatId]: count }
    setUnreadCounts(unreadCountsRef.current)
  }, [])

  const bumpUnreadCount = useCallback((chatId) => {
    const current = unreadCountsRef.current[chatId] || 0
    unreadCountsRef.current = { ...unreadCountsRef.current, [chatId]: current + 1 }
    setUnreadCounts(unreadCountsRef.current)
  }, [])

  const setLatestMessageTime = useCallback((chatId, timestampOrObj) => {
    if (!timestampOrObj) return
    setLatestMessages((prev) => {
      const incoming = typeof timestampOrObj === 'string'
        ? { ts: timestampOrObj, text: null, author: null, recentAuthors: null }
        : {
            ts: timestampOrObj.ts,
            text: timestampOrObj.text ?? null,
            author: timestampOrObj.author ?? null,
            recentAuthors: timestampOrObj.recentAuthors ?? null,
          }
      const current = prev[chatId]
      if (current && current.ts >= incoming.ts) {
        // Not newer — but update authors/text if incoming has fresher data
        const updated = { ...current }
        let changed = false
        if (incoming.recentAuthors?.length) { updated.recentAuthors = incoming.recentAuthors; changed = true }
        if (incoming.text && !current.text) { updated.text = incoming.text; updated.author = incoming.author; changed = true }
        if (!changed) return prev
        const next = { ...prev, [chatId]: updated }
        saveLatestMessages(next)
        return next
      }
      // Newer message — preserve fields that incoming lacks
      if (!incoming.recentAuthors && current?.recentAuthors) incoming.recentAuthors = current.recentAuthors
      if (!incoming.text && current?.text) { incoming.text = current.text; incoming.author = current.author }
      const next = { ...prev, [chatId]: incoming }
      saveLatestMessages(next)
      return next
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
    return Object.values(unreadCounts).reduce((sum, c) => sum + (c || 0), 0)
  }, [unreadCounts])

  const value = useMemo(
    () => ({
      ...chatState,
      openChat, closeChat, navigateChat,
      markAsRead, setLatestMessageTime,
      hasUnread, totalUnread, unreadCounts, setUnreadCount, bumpUnreadCount,
      lastReadTimestamps, latestMessages,
      pendingRefresh, addPendingRefresh, clearPendingRefresh,
      registeredEvents, setRegisteredEvents,
      // WebSocket pub/sub
      subscribeWsMessages, dispatchWsMessage,
      registerWsSend, wsSend,
    }),
    [chatState, openChat, closeChat, navigateChat, markAsRead, setLatestMessageTime, hasUnread, totalUnread, unreadCounts, setUnreadCount, bumpUnreadCount, lastReadTimestamps, latestMessages, pendingRefresh, addPendingRefresh, clearPendingRefresh, registeredEvents, setRegisteredEvents, subscribeWsMessages, dispatchWsMessage, registerWsSend, wsSend],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

export { ChatProvider, useChat }
