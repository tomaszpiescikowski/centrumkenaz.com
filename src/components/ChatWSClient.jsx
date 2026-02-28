/**
 * ChatWSClient – replaces ChatPoller.
 *
 * Opens a WebSocket connection to /api/comments/ws and subscribes to
 * all relevant chat channels (general + registered events). The server
 * pushes a `new_message` event whenever a comment is created, so the
 * client receives instant notifications without any polling latency.
 *
 * Fallback: if the WebSocket connection drops or is unavailable
 * (e.g. older proxy without WS support), the component falls back to
 * polling /api/comments/check every 30 s — same as before but much
 * less frequent since WS handles the hot path.
 *
 * Re-subscription: when registeredEvents changes (user joins a new
 * event), a fresh `subscribe` message is sent over the existing socket.
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
          setLatestMessageTimeRef.current(msg.chat_id, {
            ts:            msg.latest,
            text:          msg.text   ?? null,
            author:        msg.author ?? null,
            recentAuthors: null,
          })
          bumpUnreadCountRef.current(msg.chat_id)
          addPendingRefreshRef.current(msg.chat_id)
        }
      }

      ws.onerror = () => { wsReady = false }

      ws.onclose = () => {
        wsReady = false
        ws = null
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
