import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ChatContext = createContext(null)

/**
 * Global chat state provider.
 *
 * Any component can open the chat modal via `openChat()`:
 *   - openChat()                          → general chat (default)
 *   - openChat({ eventId, eventTitle })   → specific event chat
 *   - openChat({ view: 'events' })        → event list view
 */
function ChatProvider({ children }) {
  const [chatState, setChatState] = useState({
    open: false,
    view: 'general',   // 'general' | 'events' | 'event'
    eventId: null,
    eventTitle: null,
  })

  const openChat = useCallback((opts = {}) => {
    if (opts.eventId) {
      setChatState({
        open: true,
        view: 'event',
        eventId: opts.eventId,
        eventTitle: opts.eventTitle || null,
      })
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

  const value = useMemo(
    () => ({ ...chatState, openChat, closeChat, navigateChat }),
    [chatState, openChat, closeChat, navigateChat],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

export { ChatProvider, useChat }
