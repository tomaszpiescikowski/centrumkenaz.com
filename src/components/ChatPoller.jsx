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
    registeredEvents, lastReadTimestamps,
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

      try {
        const result = await checkNewMessages(authFetchRef.current, sinceMap)
        for (const [chatId, latestTs] of Object.entries(result)) {
          setLatestMessageTime(chatId, { ts: latestTs, text: null, author: null })
          addPendingRefresh(chatId)
        }
      } catch {
        // Polling failures are silent — next tick will retry
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, setLatestMessageTime, addPendingRefresh])

  return null
}
