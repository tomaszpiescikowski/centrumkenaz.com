/**
 * ChatPoller — global background component that polls the server every 3 s
 * to check whether any tracked chat has received new messages.
 *
 * Strategy
 * ─────────
 * 1. Build a sinceMap from latestMessages  { chatId → latestKnownTs }
 * 2. POST /comments/check  →  server returns only chats with newer activity
 * 3. For each chat returned:
 *    a. Update latestMessages (so the unread badge reflects the new ts)
 *    b. Add chatId to pendingRefresh (CommentsSection picks this up to reload
 *       and play the receive sound / highlight new messages)
 *
 * This component renders nothing — it is purely a side-effect holder.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { checkNewMessages } from '../api/comments'

const POLL_INTERVAL_MS = 3000

export default function ChatPoller() {
  const { user, authFetch } = useAuth()
  const { latestMessages, setLatestMessageTime, addPendingRefresh } = useChat()

  // Keep a stable ref to latestMessages so the interval always reads fresh data
  const latestMessagesRef = useRef(latestMessages)
  useEffect(() => { latestMessagesRef.current = latestMessages }, [latestMessages])

  const authFetchRef = useRef(authFetch)
  useEffect(() => { authFetchRef.current = authFetch }, [authFetch])

  useEffect(() => {
    // Only poll when logged in
    if (!user) return

    const poll = async () => {
      const snapshot = latestMessagesRef.current
      if (!snapshot || Object.keys(snapshot).length === 0) return

      // Build sinceMap  { chatId → ISO string }
      const sinceMap = {}
      for (const [chatId, msg] of Object.entries(snapshot)) {
        const ts = typeof msg === 'string' ? msg : msg?.ts
        if (ts) sinceMap[chatId] = ts
      }
      if (Object.keys(sinceMap).length === 0) return

      try {
        const result = await checkNewMessages(authFetchRef.current, sinceMap)
        for (const [chatId, latestTs] of Object.entries(result)) {
          // Update the unread tracker so the badge stays in sync
          setLatestMessageTime(chatId, { ts: latestTs, text: null, author: null })
          // Signal CommentsSection that this chat needs a live refresh
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
