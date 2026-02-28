import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { checkNewMessages } from '../api/comments'

const POLL_INTERVAL_MS = 3000
// Fallback "since" timestamp for chats that have never been opened/read
const EPOCH_FALLBACK = '2020-01-01T00:00:00.000Z'

export default function ChatPoller() {
  const { user, authFetch } = useAuth()
  const {
    latestMessages, setLatestMessageTime, addPendingRefresh,
    registeredEvents, lastReadTimestamps, setUnreadCount,
  } = useChat()

  // Keep stable refs so the interval always reads the freshest data
  const latestMessagesRef = useRef(latestMessages)
  useEffect(() => { latestMessagesRef.current = latestMessages }, [latestMessages])

  const authFetchRef = useRef(authFetch)
  useEffect(() => { authFetchRef.current = authFetch }, [authFetch])

  const registeredEventsRef = useRef(registeredEvents)
  useEffect(() => { registeredEventsRef.current = registeredEvents }, [registeredEvents])

  const lastReadRef = useRef(lastReadTimestamps)
  useEffect(() => { lastReadRef.current = lastReadTimestamps }, [lastReadTimestamps])

  useEffect(() => {
    if (!user) return

    const poll = async () => {
      const snapshot = latestMessagesRef.current
      const lastRead = lastReadRef.current
      const events = registeredEventsRef.current

      // Build sinceMap from latestMessages (chats that have been opened)
      const sinceMap = {}
      for (const [chatId, msg] of Object.entries(snapshot)) {
        const ts = typeof msg === 'string' ? msg : msg?.ts
        if (ts) sinceMap[chatId] = ts
      }

      // Also add general chat if not already tracked
      if (!sinceMap['general:global']) {
        sinceMap['general:global'] = lastRead['general:global'] || EPOCH_FALLBACK
      }

      // Add all registered event chats — use lastRead ts or fallback
      // so we detect new messages even in chats never opened this session
      for (const ev of events) {
        const chatId = `event:${ev.id}`
        if (!sinceMap[chatId]) {
          sinceMap[chatId] = lastRead[chatId] || EPOCH_FALLBACK
        }
      }

      if (Object.keys(sinceMap).length === 0) return

      // For chats that have a ts but are missing recentAuthors, override since to
      // EPOCH_FALLBACK so the server always returns data (and authors) for them.
      // Track these chatIds so we don't falsely mark them as having new messages.
      const authorOnlyChats = new Set()
      for (const [chatId, msg] of Object.entries(snapshot)) {
        if (msg && typeof msg === 'object' && msg.ts && !msg.recentAuthors?.length) {
          sinceMap[chatId] = EPOCH_FALLBACK
          authorOnlyChats.add(chatId)
        }
      }

      try {
        const result = await checkNewMessages(authFetchRef.current, sinceMap)
        for (const [chatId, data] of Object.entries(result)) {
          // data is { latest: ISO, count: N, authors: [...], text: str|null, author: str|null }
          const latestTs = typeof data === 'string' ? data : data.latest
          const count = typeof data === 'object' ? (data.count || 0) : 0
          const recentAuthors = typeof data === 'object' ? (data.authors || []) : []
          const latestText = typeof data === 'object' ? (data.text ?? null) : null
          const latestAuthor = typeof data === 'object' ? (data.author ?? null) : null
          if (authorOnlyChats.has(chatId)) {
            // Only update authors — don't update ts/count/pending for author-only fetches
            if (recentAuthors.length) {
              setLatestMessageTime(chatId, { ts: snapshot[chatId]?.ts ?? latestTs, text: snapshot[chatId]?.text ?? latestText, author: snapshot[chatId]?.author ?? latestAuthor, recentAuthors })
            }
          } else {
            setLatestMessageTime(chatId, { ts: latestTs, text: latestText, author: latestAuthor, recentAuthors })
            setUnreadCount(chatId, count)
            addPendingRefresh(chatId)
          }
        }
      } catch {
        // Polling failures are silent — next tick will retry
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, setLatestMessageTime, addPendingRefresh, setUnreadCount])

  return null
}
