/**
 * ChatWSClient – singleton WebSocket bridge for the full chat protocol.
 *
 * Opens one WebSocket to /api/comments/ws and maintains it for the full
 * session.  All real-time chat traffic flows through this connection:
 *
 *   Receiving (server → client):
 *     new_message      – full CommentResponse pushed when a message is created
 *     message_updated  – full CommentResponse when a comment is edited
 *     message_deleted  – comment_id when a comment is soft-deleted
 *     reaction_updated – full CommentResponse when reactions change
 *
 *   Sending (client → server):
 *     send_message    – create a new comment
 *     edit_message    – edit an existing comment
 *     delete_message  – soft-delete a comment
 *     toggle_reaction – add/remove a reaction
 *
 * All incoming events are dispatched to ChatContext.dispatchWsMessage so that
 * CommentsSection components can subscribe and update their state in-place
 * without issuing any HTTP requests.
 *
 * Fallback: if WS is unavailable/disconnected, the component falls back to
 * polling /api/comments/check every 30 s for unread-badge bookkeeping only
 * (not for fetching full message content).
 *
 * wsSend registration: exposes the active socket's send function via
 * ChatContext.registerWsSend so CommentsSection (and any other component) can
 * send frames without holding a direct reference to the WebSocket object.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { checkNewMessages } from '../api/comments'

/** Fallback polling interval while WS is disconnected (ms). */
const FALLBACK_POLL_MS = 30_000
/** Initial backoff before first reconnect attempt (ms). */
const RECONNECT_INITIAL_MS = 1_000
/** Maximum reconnect backoff (ms). */
const RECONNECT_MAX_MS = 30_000
/** Fallback "since" for chats never opened. */
const EPOCH_FALLBACK = '2020-01-01T00:00:00.000Z'

/** Build the WebSocket URL relative to the current host. */
function buildWsUrl() {
  if (typeof window === 'undefined') return null
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = import.meta.env.DEV
    ? `${window.location.hostname}:8000`
    : window.location.host
  return `${proto}//${host}/api/comments/ws`
}

export default function ChatWSClient() {
  const { user, authFetch } = useAuth()
  const {
    latestMessages,
    setLatestMessageTime,
    addPendingRefresh,
    registeredEvents,
    lastReadTimestamps,
    setUnreadCount,
    bumpUnreadCount,
    dispatchWsMessage,
    registerWsSend,
  } = useChat()

  // ── Stable refs so WS callbacks always read the freshest data ───────────
  const latestMessagesRef = useRef(latestMessages)
  useEffect(() => { latestMessagesRef.current = latestMessages }, [latestMessages])

  const authFetchRef = useRef(authFetch)
  useEffect(() => { authFetchRef.current = authFetch }, [authFetch])

  const registeredEventsRef = useRef(registeredEvents)
  useEffect(() => { registeredEventsRef.current = registeredEvents }, [registeredEvents])

  const lastReadRef = useRef(lastReadTimestamps)
  useEffect(() => { lastReadRef.current = lastReadTimestamps }, [lastReadTimestamps])

  const setLatestMessageTimeRef = useRef(setLatestMessageTime)
  useEffect(() => { setLatestMessageTimeRef.current = setLatestMessageTime }, [setLatestMessageTime])

  const addPendingRefreshRef = useRef(addPendingRefresh)
  useEffect(() => { addPendingRefreshRef.current = addPendingRefresh }, [addPendingRefresh])

  const setUnreadCountRef = useRef(setUnreadCount)
  useEffect(() => { setUnreadCountRef.current = setUnreadCount }, [setUnreadCount])

  const bumpUnreadCountRef = useRef(bumpUnreadCount)
  useEffect(() => { bumpUnreadCountRef.current = bumpUnreadCount }, [bumpUnreadCount])

  const dispatchWsMessageRef = useRef(dispatchWsMessage)
  useEffect(() => { dispatchWsMessageRef.current = dispatchWsMessage }, [dispatchWsMessage])

  const registerWsSendRef = useRef(registerWsSend)
  useEffect(() => { registerWsSendRef.current = registerWsSend }, [registerWsSend])

  // ── WS connection (rebuilt only on user change) ──────────────────────────
  useEffect(() => {
    if (!user) return

    let ws = null
    let dead = false
    let wsReady = false
    let reconnectDelay = RECONNECT_INITIAL_MS
    let reconnectTimer = null
    let fallbackTimer = null

    // ── helpers ──────────────────────────────────────────────────────────

    function chatList() {
      const chats = ['general:global']
      for (const ev of registeredEventsRef.current) chats.push(`event:${ev.id}`)
      return chats
    }

    function buildSinceMap() {
      const snapshot   = latestMessagesRef.current
      const lastRead   = lastReadRef.current
      const events     = registeredEventsRef.current
      const since      = {}

      for (const [id, msg] of Object.entries(snapshot)) {
        const ts = typeof msg === 'string' ? msg : msg?.ts
        if (ts) since[id] = ts
      }
      if (!since['general:global']) since['general:global'] = lastRead['general:global'] || EPOCH_FALLBACK
      for (const ev of events) {
        const cid = `event:${ev.id}`
        if (!since[cid]) since[cid] = lastRead[cid] || EPOCH_FALLBACK
      }
      return since
    }

    async function doPoll() {
      const since = buildSinceMap()
      if (!Object.keys(since).length) return
      try {
        const result = await checkNewMessages(authFetchRef.current, since)
        for (const [chatId, data] of Object.entries(result)) {
          const ts      = typeof data === 'string' ? data : data.latest
          const count   = typeof data === 'object' ? (data.count  || 0)  : 0
          const authors = typeof data === 'object' ? (data.authors || []) : []
          const text    = typeof data === 'object' ? (data.text   ?? null) : null
          const author  = typeof data === 'object' ? (data.author ?? null) : null
          setLatestMessageTimeRef.current(chatId, { ts, text, author, recentAuthors: authors })
          setUnreadCountRef.current(chatId, count)
          // Also trigger a pendingRefresh so CommentsSection can catch up
          // (only needed when WS was disconnected and we bridged the gap via poll)
          addPendingRefreshRef.current(chatId)
        }
      } catch { /* silent */ }
    }

    function startFallback() {
      if (fallbackTimer) return
      fallbackTimer = setInterval(doPoll, FALLBACK_POLL_MS)
    }

    function stopFallback() {
      if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null }
    }

    function subscribe() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', chats: chatList() }))
      }
    }

    /** Expose the socket send function via ChatContext so CommentsSection can transmit. */
    function registerSend() {
      registerWsSendRef.current((msg) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg))
        } else {
          throw new Error('WebSocket not connected')
        }
      })
    }

    function clearSend() {
      registerWsSendRef.current(null)
    }

    function connect() {
      if (dead) return
      const token = localStorage.getItem('accessToken')
      if (!token) return
      const wsUrl = buildWsUrl()
      if (!wsUrl) return

      ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`)

      ws.onopen = () => {
        reconnectDelay = RECONNECT_INITIAL_MS
        subscribe()
        registerSend()
      }

      ws.onmessage = (evt) => {
        let msg
        try { msg = JSON.parse(evt.data) } catch { return }

        if (msg.type === 'subscribed') {
          wsReady = true
          stopFallback()
          // Catch up on any messages that arrived while WS was disconnected
          doPoll()

        } else if (msg.type === 'new_message') {
          // Update the global unread / latest-message bookkeeping
          setLatestMessageTimeRef.current(msg.chat_id, {
            ts:            msg.latest ?? msg.comment?.created_at ?? null,
            text:          msg.text   ?? msg.comment?.content ?? null,
            author:        msg.author ?? msg.comment?.author?.full_name ?? null,
            recentAuthors: null,
          })
          bumpUnreadCountRef.current(msg.chat_id)
          // Dispatch full message to any open CommentsSection
          if (msg.comment) {
            dispatchWsMessageRef.current(msg.chat_id, { type: 'new_message', comment: msg.comment, chat_id: msg.chat_id })
          } else {
            // Lightweight notification from an external source (e.g. another server
            // instance) — fall back to HTTP fetch via pendingRefresh
            addPendingRefreshRef.current(msg.chat_id)
          }

        } else if (msg.type === 'message_updated' || msg.type === 'reaction_updated') {
          if (msg.comment && msg.chat_id) {
            dispatchWsMessageRef.current(msg.chat_id, { type: msg.type, comment: msg.comment, chat_id: msg.chat_id })
          }

        } else if (msg.type === 'message_deleted') {
          if (msg.comment_id && msg.chat_id) {
            dispatchWsMessageRef.current(msg.chat_id, { type: 'message_deleted', comment_id: msg.comment_id, chat_id: msg.chat_id })
          }

        } else if (msg.type === 'message_sent') {
          // Acknowledgement for our own send — forward to handler in CommentsSection
          if (msg.comment && msg.chat_id) {
            dispatchWsMessageRef.current(msg.chat_id, { type: 'message_sent', comment: msg.comment, temp_id: msg.temp_id ?? null, chat_id: msg.chat_id })
          }
        }
      }

      ws.onerror = () => { wsReady = false }

      ws.onclose = () => {
        wsReady = false
        ws = null
        clearSend()
        if (dead) return
        startFallback()
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          connect()
        }, reconnectDelay)
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
      }
    }

    connect()
    // Initial catch-up poll — WS may not yet have delivered full history
    doPoll()

    return () => {
      dead = true
      clearSend()
      stopFallback()
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      if (ws) { ws.close(); ws = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ── Re-subscribe when registered events list changes ─────────────────────
  useEffect(() => {
    // No-op if not yet mounted / no WS — the next connect() will pick up the
    // fresh list from registeredEventsRef automatically.
  }, [registeredEvents])

  return null
}
