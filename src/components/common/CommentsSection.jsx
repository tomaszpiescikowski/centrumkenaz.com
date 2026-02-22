import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { searchUsers } from '../../api/user'
import {
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
  togglePinComment,
  toggleReaction,
} from '../../api/comments'
import './CommentsSection.css'

const REACTION_EMOJIS = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  fire: '🔥',
}

/**
 * Flatten nested comment tree into a list with thread metadata.
 * Visual depth is capped at 1 — replies to replies stay at depth 1
 * but show a "replying to X" indicator (git-graph style).
 */
function flattenComments(comments, parentAuthor = null, depth = 0) {
  const result = []
  if (!comments) return result
  for (let i = 0; i < comments.length; i++) {
    const c = comments[i]
    const visualDepth = Math.min(depth, 1)
    const replyToName = depth > 1 ? parentAuthor : null

    result.push({
      ...c,
      _depth: depth,
      _visualDepth: visualDepth,
      _replyToName: replyToName,
      _hasChildren: c.replies && c.replies.length > 0,
    })

    if (c.replies && c.replies.length > 0) {
      const children = flattenComments(c.replies, c.author?.full_name, depth + 1)
      result.push(...children)
    }
  }
  return result
}

/** Count total comments (including nested) */
function countAll(comments) {
  if (!comments) return 0
  let n = 0
  for (const c of comments) {
    n += 1
    if (c.replies) n += countAll(c.replies)
  }
  return n
}

function CommentsSection({ resourceType, resourceId, activeTab: externalTab, onTabChange, hideHeader, hideTabs, messengerLayout, chatId, onLatestMessage }) {
  const { user, authFetch } = useAuth()
  const { t } = useLanguage()
  const isAdmin = user?.role === 'admin'

  const [comments, setComments] = useState([])
  const [generalComments, setGeneralComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newContent, setNewContent] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyContent, setReplyContent] = useState('')
  const [messengerReplyTo, setMessengerReplyTo] = useState(null) // { parentId, authorName } — messenger-mode reply
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editVersion, setEditVersion] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showReactionPicker, setShowReactionPicker] = useState(null)
  const [pickerPos, setPickerPos] = useState(null)
  const [longPressId, setLongPressId] = useState(null)
  const [internalTab, setInternalTab] = useState('event')

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState(null)   // null = inactive, '' = '@' just typed
  const [mentionResults, setMentionResults] = useState([])
  const [mentionCursorPos, setMentionCursorPos] = useState(0)
  const newTextareaRef = useRef(null)
  // Maps displayed @Name → userId for converting back to tokens on submit
  const mentionMapRef = useRef({})

  const activeTab = externalTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab

  const replyInputRef = useRef(null)
  const editInputRef = useRef(null)
  const listRef = useRef(null)
  const longPressTimer = useRef(null)
  const touchMoved = useRef(false)

  // Swipe-to-reply state
  const [swipeId, setSwipeId] = useState(null)
  const [swipeX, setSwipeX] = useState(0)
  const swipeStart = useRef(null)
  const swipeItemRef = useRef(null)
  const SWIPE_THRESHOLD = 60

  // Collapsible reply threads
  const [expandedReplies, setExpandedReplies] = useState(new Set())

  // Reply highlight + flash feedback
  const [replyHighlightId, setReplyHighlightId] = useState(null)
  const [flashId, setFlashId] = useState(null)
  const pendingReplyParentRef = useRef(null)

  // Pagination: load older messages
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderOffset, setOlderOffset] = useState(50)

  const isGeneralTab = activeTab === 'general'
  const currentComments = isGeneralTab ? generalComments : comments

  const loadComments = useCallback(async () => {
    try {
      const data = await fetchComments(resourceType, resourceId, authFetch, { limit: 50, order: 'desc' })
      const ordered = [...data].reverse()
      setComments(ordered)
      setHasMoreOlder(data.length === 50)
      setOlderOffset(50)
      if (onLatestMessage && ordered.length > 0) {
        // Find latest created_at across all comments and replies
        let latest = null
        const scanDates = (items) => {
          for (const c of items) {
            if (!latest || c.created_at > latest) latest = c.created_at
            if (c.replies?.length) scanDates(c.replies)
          }
        }
        scanDates(ordered)
        if (latest) onLatestMessage(latest)
      }
    } catch {
      setError(t('comments.loadError'))
    } finally {
      setLoading(false)
    }
  }, [resourceType, resourceId, authFetch, t, onLatestMessage])

  const loadGeneralComments = useCallback(async () => {
    try {
      const data = await fetchComments('general', 'global', authFetch, { limit: 50, order: 'desc' })
      const orderedGeneral = [...data].reverse()
      setGeneralComments(orderedGeneral)
      if (onLatestMessage && chatId === 'general:global' && orderedGeneral.length > 0) {
        let latest = null
        const scanDates = (items) => {
          for (const c of items) {
            if (!latest || c.created_at > latest) latest = c.created_at
            if (c.replies?.length) scanDates(c.replies)
          }
        }
        scanDates(orderedGeneral)
        if (latest) onLatestMessage(latest)
      }
    } catch {
      /* silent */
    }
  }, [authFetch, onLatestMessage, chatId])

  // Scroll messenger list to bottom
  const scrollToBottom = useCallback(() => {
    if (messengerLayout && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messengerLayout])

  useEffect(() => {
    loadComments()
    loadGeneralComments()
  }, [loadComments, loadGeneralComments])

  // Auto-scroll to newest message when comments load / change; flash newest reply
  useEffect(() => {
    scrollToBottom()
    const parentId = pendingReplyParentRef.current
    if (parentId) {
      const parent = currentComments.find(c => c.id === parentId)
      const replies = parent?.replies || []
      if (replies.length) {
        const newest = replies[replies.length - 1]
        pendingReplyParentRef.current = null
        setExpandedReplies(prev => new Set([...prev, parentId]))
        setFlashId(newest.id)
        scrollCommentToTop(parentId)
        const timer = setTimeout(() => setFlashId(id => id === newest.id ? null : id), 3000)
        return () => clearTimeout(timer)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComments, scrollToBottom])

  useEffect(() => {
    if (replyingTo && replyInputRef.current) replyInputRef.current.focus()
  }, [replyingTo])

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  const currentResourceType = isGeneralTab ? 'general' : resourceType
  const currentResourceId = isGeneralTab ? 'global' : resourceId
  const reloadCurrent = isGeneralTab ? loadGeneralComments : loadComments

  const handleDesktopEnter = (e, formEl) => {
    if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 640px)').matches) {
      e.preventDefault()
      formEl?.requestSubmit()
    }
  }

  /* ?????? @mention autocomplete ????????????????????????????????????????????????????????????????????????????????? */
  const handleNewContentChange = useCallback((e) => {
    const value = e.target.value
    setNewContent(value)
    const cursorPos = e.target.selectionStart ?? value.length
    const textUpToCursor = value.slice(0, cursorPos)
    const mentionMatch = textUpToCursor.match(/@(\w*)$/)
    if (mentionMatch && user) {
      setMentionQuery(mentionMatch[1])
      setMentionCursorPos(cursorPos - mentionMatch[0].length)
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
  }, [user])

  // Convert display text (@Name) back to storage tokens (@[Name|id]) before sending
  const convertMentions = useCallback((text) => {
    const map = mentionMapRef.current
    if (!text || Object.keys(map).length === 0) return text
    // Longest name first to avoid partial collisions
    const names = Object.keys(map).sort((a, b) => b.length - a.length)
    let result = text
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp(`@${escaped}`, 'g'), `@[${name}|${map[name]}]`)
    }
    return result
  }, [])

  const insertMention = useCallback((mentionUser) => {
    const before = newContent.slice(0, mentionCursorPos)
    const after = newContent.slice(mentionCursorPos + 1 + (mentionQuery || '').length)
    // Store the display-friendly @Name (not raw token) in the textarea
    mentionMapRef.current[mentionUser.full_name] = mentionUser.id
    const next = `${before}@${mentionUser.full_name} ${after}`
    setNewContent(next)
    setMentionQuery(null)
    setMentionResults([])
    setTimeout(() => newTextareaRef.current?.focus(), 0)
  }, [newContent, mentionCursorPos, mentionQuery])

  const handleNewKeyDown = useCallback((e, formEl) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        setMentionResults([])
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && mentionResults.length > 0)) {
        e.preventDefault()
        insertMention(mentionResults[0])
        return
      }
    }
    handleDesktopEnter(e, formEl)
  }, [mentionQuery, mentionResults, insertMention, handleDesktopEnter])

  // Fetch mention suggestions when query changes
  const _mentionFetchRef = useRef(null)
  useEffect(() => {
    if (mentionQuery === null) { setMentionResults([]); return }
    if (mentionQuery.length < 1) { setMentionResults([]); return }
    clearTimeout(_mentionFetchRef.current)
    _mentionFetchRef.current = setTimeout(async () => {
      const results = await searchUsers(mentionQuery, authFetch)
      setMentionResults(results || [])
    }, 180)
  }, [mentionQuery, authFetch])

  /* ?????? Helper: render comment content (parse @mentions) ?????? */
  const renderContent = (text) => {
    if (!text) return null
    // eslint-disable-next-line no-useless-escape
    const MENTION_RE = /@\[([^|\]]+)\|([^\]]+)\]/g
    const parts = []
    let last = 0; let match
    while ((match = MENTION_RE.exec(text)) !== null) {
      if (match.index > last) parts.push(text.slice(last, match.index))
      parts.push(
        <Link key={match.index} to={`/people/${match[2]}`} className="cmt-mention">@{match[1]}</Link>
      )
      last = match.index + match[0].length
    }
    if (last < text.length) parts.push(text.slice(last))
    return parts.length ? <>{parts}</> : text
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newContent.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = { content: convertMentions(newContent.trim()) }
      const replyParentId = messengerReplyTo?.parentId ?? null
      if (replyParentId) payload.parentId = replyParentId
      await createComment(currentResourceType, currentResourceId, authFetch, payload)
      setNewContent('')
      mentionMapRef.current = {}
      setMessengerReplyTo(null)
      setReplyHighlightId(null)
      if (replyParentId) pendingReplyParentRef.current = replyParentId
      await reloadCurrent()
      requestAnimationFrame(scrollToBottom)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (e, parentId) => {
    e.preventDefault()
    if (!replyContent.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await createComment(currentResourceType, currentResourceId, authFetch, {
        content: replyContent.trim(),
        parentId,
      })
      setReplyContent('')
      setReplyingTo(null)
      await reloadCurrent()
      requestAnimationFrame(scrollToBottom)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (e, commentId) => {
    e.preventDefault()
    if (!editContent.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await updateComment(commentId, authFetch, { content: editContent.trim(), version: editVersion })
      setEditingId(null)
      setEditContent('')
      setEditVersion(null)
      await reloadCurrent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId) => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await deleteComment(commentId, authFetch)
      await reloadCurrent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePin = async (commentId) => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await togglePinComment(commentId, authFetch)
      await reloadCurrent()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const scrollCommentToTop = (commentId) => {
    const list = listRef.current
    if (!list) return
    const el = list.querySelector(`[data-cmt-id="${commentId}"]`)
    if (!el) return
    list.scrollBy({ top: el.getBoundingClientRect().top - list.getBoundingClientRect().top - 8, behavior: 'smooth' })
  }

  const handleReaction = async (commentId, reactionType) => {
    setError(null)
    try {
      await toggleReaction(commentId, authFetch, reactionType)
      await reloadCurrent()
      setFlashId(commentId)
      setTimeout(() => setFlashId(id => id === commentId ? null : id), 3000)
    } catch (err) {
      setError(err.message)
    }
    setShowReactionPicker(null)
    setPickerPos(null)
  }

  const initials = (name) => {
    const parts = (name || '').split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return t('comments.justNow')
    if (diffMin < 60) return `${diffMin} min`
    if (diffHr < 24) return `${diffHr}h`
    if (diffDay < 7) return `${diffDay}d`

    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  /* ── Long-press handlers (mobile reaction picker) ── */
  // Auto-resize messenger textarea on content change
  useEffect(() => {
    if (!messengerLayout || !newTextareaRef.current) return
    const el = newTextareaRef.current
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }, [newContent, messengerLayout])

  const handleTouchStart = useCallback((commentId, e) => {
    touchMoved.current = false
    // Record start position for swipe detection
    const touch = e.touches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY, id: commentId, swiping: false }
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current && !swipeStart.current?.swiping) {
        setLongPressId(commentId)
        setShowReactionPicker(null)
        if (navigator.vibrate) navigator.vibrate(30)
      }
    }, 500)
  }, [])

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current)
    if (swipeStart.current?.swiping && swipeX >= SWIPE_THRESHOLD) {
      // Trigger reply
      const id = swipeStart.current.id
      // Find the item to determine replyTargetId
      const flatItems = flattenComments(isGeneralTab ? generalComments : comments)
      const item = flatItems.find(c => c.id === id)
      // Animate back first
      setSwipeX(0)
      setTimeout(() => setSwipeId(null), 200)
      swipeStart.current = null
      if (item) {
        const targetId = item._depth === 0 ? item.id : (item.parent_id || item.id)
        setReplyingTo(targetId)
        setReplyContent('')
      }
      return
    }
    // Snap back
    if (swipeStart.current?.swiping) {
      setSwipeX(0)
      setTimeout(() => setSwipeId(null), 200)
    } else {
      setSwipeId(null)
      setSwipeX(0)
    }
    swipeStart.current = null
  }, [swipeX, SWIPE_THRESHOLD, isGeneralTab, generalComments, comments])

  const handleTouchMove = useCallback((e) => {
    if (!swipeStart.current) return
    const touch = e.touches[0]
    const dx = touch.clientX - swipeStart.current.x
    const dy = touch.clientY - swipeStart.current.y

    // If we haven't classified the gesture yet
    if (!swipeStart.current.swiping && !touchMoved.current) {
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (absDx > 8 || absDy > 8) {
        if (absDx > absDy && dx > 0) {
          // Horizontal swipe right — enter swipe mode
          swipeStart.current.swiping = true
          clearTimeout(longPressTimer.current)
          touchMoved.current = true
        } else {
          // Vertical scroll or left swipe — abandon
          touchMoved.current = true
          clearTimeout(longPressTimer.current)
        }
      }
      return
    }

    if (swipeStart.current.swiping) {
      const clamped = Math.max(0, Math.min(dx, 100))
      setSwipeId(swipeStart.current.id)
      setSwipeX(clamped)
      // Haptic when crossing threshold
      if (clamped >= SWIPE_THRESHOLD && dx - (touch.prevDx || 0) > 0 && !swipeStart.current.hapticFired) {
        swipeStart.current.hapticFired = true
        if (navigator.vibrate) navigator.vibrate(15)
      }
      if (clamped < SWIPE_THRESHOLD) {
        swipeStart.current.hapticFired = false
      }
    }
  }, [SWIPE_THRESHOLD])

  /* ── Desktop reaction picker (opens as fixed-position portal) ── */
  const openReactionPicker = useCallback((commentId, e) => {
    if (showReactionPicker === commentId) {
      setShowReactionPicker(null)
      setPickerPos(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setShowReactionPicker(commentId)
    setPickerPos({
      bottom: window.innerHeight - rect.top + 4,
      left: rect.left,
    })
  }, [showReactionPicker])

  // Close desktop picker on outside click, scroll, or Escape
  useEffect(() => {
    if (!showReactionPicker) return
    const close = () => { setShowReactionPicker(null); setPickerPos(null) }
    const handleMouseDown = (e) => {
      if (!e.target.closest('.cmt-reaction-picker') && !e.target.closest('.cmt-reaction-trigger-wrap')) {
        close()
      }
    }
    const handleKey = (e) => { if (e.key === 'Escape') close() }
    const el = listRef.current
    if (el) el.addEventListener('scroll', close, { passive: true })
    document.addEventListener('scroll', close, { passive: true, capture: true })
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      if (el) el.removeEventListener('scroll', close)
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showReactionPicker])

  // Close long-press picker on outside tap / scroll
  useEffect(() => {
    if (!longPressId) return
    const close = () => setLongPressId(null)
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('touchstart', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [longPressId])

  // Load older messages (prepend without losing scroll position)
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder || !listRef.current) return
    setLoadingOlder(true)
    try {
      const prevScrollTop = listRef.current.scrollTop
      const prevScrollHeight = listRef.current.scrollHeight
      const rt = isGeneralTab ? 'general' : resourceType
      const ri = isGeneralTab ? 'global' : resourceId
      const older = await fetchComments(rt, ri, authFetch, { limit: 50, offset: olderOffset, order: 'desc' })
      const olderOrdered = [...older].reverse()
      if (isGeneralTab) {
        setGeneralComments(prev => [...olderOrdered, ...prev])
      } else {
        setComments(prev => [...olderOrdered, ...prev])
      }
      setOlderOffset(o => o + 50)
      setHasMoreOlder(older.length === 50)
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = prevScrollTop + (listRef.current.scrollHeight - prevScrollHeight)
        }
      })
    } catch { /* silent */ }
    finally { setLoadingOlder(false) }
  }, [loadingOlder, hasMoreOlder, isGeneralTab, resourceType, resourceId, authFetch, olderOffset])

  const toggleReplies = (id) => {
    setExpandedReplies(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderFlatComment = (item) => {
    const isOwn = user?.id === item.author.id
    const isEditingThis = editingId === item.id
    const isReplying = replyingTo === item.id
    // Always reply to the nearest top-level or depth-1 ancestor
    const replyTargetId = item._depth === 0 ? item.id : (item.parent_id || item.id)

    return (
      <div key={item.id} data-cmt-id={item.id} className={`cmt-swipe-wrap ${item._visualDepth > 0 ? 'cmt-wrap-threaded' : ''} ${item._hasChildren && item._visualDepth === 0 ? 'cmt-wrap-has-replies' : ''} ${replyHighlightId === item.id ? 'cmt-reply-target' : ''} ${flashId === item.id ? 'cmt-flash' : ''}`}>
        {/* Swipe reply indicator (stays in place behind the sliding item) */}
        {swipeId === item.id && swipeX > 10 && (
          <div className={`cmt-swipe-indicator ${swipeX >= SWIPE_THRESHOLD ? 'cmt-swipe-ready' : ''}`}
            style={{ opacity: Math.min(swipeX / SWIPE_THRESHOLD, 1), transform: `scale(${Math.min(swipeX / SWIPE_THRESHOLD, 1)})` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 00-4-4H4" />
            </svg>
          </div>
        )}
      <div
        className={`cmt-item ${item.is_pinned ? 'cmt-pinned' : ''} ${item._visualDepth > 0 ? 'cmt-threaded' : ''} ${item._hasChildren && item._visualDepth === 0 ? 'cmt-has-replies' : ''}`}
        onTouchStart={(e) => { if (!item.is_deleted) handleTouchStart(item.id, e) }}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onContextMenu={(e) => { if (longPressId) e.preventDefault() }}
        style={swipeId === item.id ? { transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' } : (swipeId === null ? {} : {})}
      >

        <div className="cmt-item-body">
          {item.is_pinned && (
            <div className="cmt-pin-badge">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1-.707.707l-.708-.707-3.535 3.536.707.707a.5.5 0 0 1-.707.707l-1.414-1.414-2.829 2.828a.5.5 0 0 1-.707 0l-.707-.707L1.414 14.5l-.707-.707 3.182-3.182-.707-.707a.5.5 0 0 1 0-.707l2.829-2.829L4.596 5.04a.5.5 0 1 1 .707-.707l.707.707L9.546 1.5l-.707-.707a.5.5 0 0 1 .283-.849l.707-.222z" />
              </svg>
              {t('comments.pinned')}
            </div>
          )}

          {/* "replying to X" for deeply nested */}
          {item._replyToName && (
            <div className="cmt-reply-to">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 10 20 15 15 20" />
                <path d="M4 4v7a4 4 0 004 4h12" />
              </svg>
              <span>{item._replyToName}</span>
            </div>
          )}

          <div className="cmt-header">
            <Link to={`/people/${item.author.id}`} className="cmt-avatar-link">
              <div className="cmt-av-wrap">
                {item.author.picture_url ? (
                  <img src={item.author.picture_url} alt={item.author.full_name} className="cmt-av cmt-av-img" />
                ) : (
                  <div className="cmt-av">{initials(item.author.full_name)}</div>
                )}
              </div>
            </Link>
            <div className="cmt-meta">
              <Link to={`/people/${item.author.id}`} className="cmt-author">{item.author.full_name}</Link>
              {item.author?.is_member && <span className="cmt-member-badge">Członek</span>}
              <span className="cmt-time">{formatTime(item.created_at)}</span>
              {item.updated_at && !item.is_deleted && <span className="cmt-edited">{t('comments.edited')}</span>}
            </div>
          </div>

          {isEditingThis ? (
            <form className="cmt-edit-form" onSubmit={(e) => handleEdit(e, item.id)}>
              <textarea ref={editInputRef} className="cmt-input" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} maxLength={2000} onKeyDown={(e) => handleDesktopEnter(e, e.target.closest('form'))} />
              <div className="cmt-edit-actions">
                <button type="submit" className="cmt-btn cmt-btn-primary" disabled={submitting || !editContent.trim()}>{t('comments.save')}</button>
                <button type="button" className="cmt-btn" onClick={() => { setEditingId(null); setEditContent(''); setEditVersion(null) }}>{t('comments.cancel')}</button>
              </div>
            </form>
          ) : (
            <div className={`cmt-content ${item.is_deleted ? 'cmt-deleted' : ''}`}>{renderContent(item.content)}</div>
          )}

          {/* Long-press reaction bar (mobile, Messenger-style) */}
          {longPressId === item.id && (
            <div className="cmt-longpress-bar" onTouchStart={(e) => e.stopPropagation()}>
              {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => {
                const myReaction = item.reactions?.find(r => r.reaction_type === type && r.reacted_by_me)
                return (
                  <button
                    key={type}
                    className={`cmt-longpress-emoji ${myReaction ? 'cmt-longpress-emoji-active' : ''}`}
                    onClick={() => { handleReaction(item.id, type); setLongPressId(null) }}
                    title={type}
                  >{emoji}</button>
                )
              })}
            </div>
          )}

          {/* Reactions */}
          {!item.is_deleted && item.reactions?.length > 0 && (
            <div className="cmt-reactions">
              {item.reactions.map((r) => (
                <button key={r.reaction_type} className={`cmt-reaction-chip ${r.reacted_by_me ? 'cmt-reaction-mine' : ''}`} onClick={() => handleReaction(item.id, r.reaction_type)} title={r.reaction_type}>
                  <span>{REACTION_EMOJIS[r.reaction_type] || r.reaction_type}</span>
                  <span className="cmt-reaction-count">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          {!item.is_deleted && !isEditingThis && user && (
            <div className="cmt-actions">
              {(!messengerLayout || item._visualDepth === 0) && (
                <button className="cmt-action-btn" onClick={() => {
                  if (messengerLayout) {
                    if (messengerReplyTo?.parentId === replyTargetId) {
                      setMessengerReplyTo(null)
                      setReplyHighlightId(null)
                    } else {
                      setMessengerReplyTo({ parentId: replyTargetId, authorName: item.author?.full_name || '' })
                      setReplyHighlightId(replyTargetId)
                      scrollCommentToTop(replyTargetId)
                      requestAnimationFrame(() => newTextareaRef.current?.focus())
                    }
                  } else {
                    setReplyingTo(isReplying ? null : replyTargetId)
                    setReplyContent('')
                  }
                }}>{t('comments.reply')}</button>
              )}

              <div className="cmt-reaction-trigger-wrap cmt-desktop-only">
                <button className="cmt-action-btn" onClick={(e) => openReactionPicker(item.id, e)}>
                  <span className="cmt-react-emoji">😀</span>
                  <span className="cmt-react-text">{t('comments.react')}</span>
                </button>
              </div>

              {isOwn && (
                <button className="cmt-action-btn" onClick={() => { setEditingId(item.id); setEditContent(item.content); setEditVersion(item.version) }}>{t('comments.edit')}</button>
              )}
              {(isOwn || isAdmin) && (
                <button className="cmt-action-btn cmt-action-danger" onClick={() => handleDelete(item.id)}>{t('comments.delete')}</button>
              )}
              {isAdmin && (
                <button className="cmt-action-btn" onClick={() => handlePin(item.id)}>{item.is_pinned ? t('comments.unpin') : t('comments.pin')}</button>
              )}
            </div>
          )}

          {/* Reply form — desktop/non-messenger only */}
          {isReplying && !messengerLayout && (
            <form className="cmt-reply-form" onSubmit={(e) => handleReply(e, replyTargetId)}>
              <textarea ref={replyInputRef} className="cmt-input cmt-input-sm" placeholder={t('comments.replyPlaceholder')} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={2} maxLength={2000} onKeyDown={(e) => handleDesktopEnter(e, e.target.closest('form'))} />
              <div className="cmt-edit-actions">
                <button type="submit" className="cmt-btn cmt-btn-primary" disabled={submitting || !replyContent.trim()}>{t('comments.send')}</button>
                <button type="button" className="cmt-btn" onClick={() => { setReplyingTo(null); setReplyContent('') }}>{t('comments.cancel')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
      </div>
    )
  }

  const renderCommentGroup = (comment) => {
    const replyCount = comment.replies?.length ?? 0
    const isExpanded = expandedReplies.has(comment.id)
    // Collect up to 3 unique reply authors for avatar stack
    const replyAvatars = []
    const seenIds = new Set()
    for (const r of (comment.replies || [])) {
      if (!seenIds.has(r.author?.id) && replyAvatars.length < 3) {
        seenIds.add(r.author?.id)
        if (r.author) replyAvatars.push(r.author)
      }
    }
    const flatComment = {
      ...comment,
      _depth: 0,
      _visualDepth: 0,
      _replyToName: null,
      _hasChildren: replyCount > 0,
    }
    return (
      <div key={comment.id} className={`cmt-group${isExpanded ? ' cmt-group-expanded' : ''}`}>
        {renderFlatComment(flatComment)}
        {replyCount > 0 && (
          <>
            <button
              className="cmt-replies-toggle"
              onClick={() => toggleReplies(comment.id)}
            >
              {!isExpanded && (
                <span className="cmt-reply-avatars">
                  {replyAvatars.map((a, i) => (
                    <span key={a.id} className="cmt-reply-av" style={{ zIndex: replyAvatars.length - i }}>
                      {a.picture_url
                        ? <img src={a.picture_url} alt={a.full_name} />
                        : <span>{initials(a.full_name)}</span>
                      }
                    </span>
                  ))}
                </span>
              )}
              <span>
                {isExpanded
                  ? 'Ukryj odpowiedzi'
                  : `${replyCount} ${replyCount === 1 ? 'odpowiedź' : 'odpowiedzi'}`}
              </span>
            </button>
            {isExpanded && (
              <div className="cmt-replies-list">
                {comment.replies.map((reply) => renderFlatComment({
                  ...reply,
                  _depth: 1,
                  _visualDepth: 1,
                  _replyToName: null,
                  _hasChildren: false,
                }))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const flatList = flattenComments(currentComments)
  const totalCount = countAll(isGeneralTab ? generalComments : comments)

  if (loading) {
    return <div className="cmt-loading">{t('comments.loading')}</div>
  }

  // No separate pinned section – pinned items stay inline (backend sorts pinned first)

  const commentForm = user ? (
    <form className="cmt-new-form" onSubmit={handleSubmit}>
      <div className="cmt-new-row">
        {!messengerLayout && (
          <div className="cmt-av-wrap">
            {user?.picture_url ? (
              <img src={user.picture_url} alt={user.full_name} className="cmt-av cmt-av-img" />
            ) : (
              <div className="cmt-av">{initials(user?.full_name)}</div>
            )}
          </div>
        )}
        <div className={`cmt-input-wrap${messengerLayout ? ' cmt-input-wrap-messenger' : ''}`}>
          {/* Messenger reply banner */}
          {messengerLayout && messengerReplyTo && (
            <div className="cmt-reply-banner">
              <span>{t('comments.replyingToLabel')} <strong>@{messengerReplyTo.authorName}</strong></span>
              <button type="button" className="cmt-reply-banner-close" onClick={() => { setMessengerReplyTo(null); setReplyHighlightId(null) }} aria-label="Anuluj odpowiedź">×</button>
            </div>
          )}
          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="cmt-mention-dropdown">
              {mentionResults.slice(0, 6).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="cmt-mention-item"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(u) }}
                  onTouchEnd={(e) => { e.preventDefault(); insertMention(u) }}
                >
                  <span className="cmt-mention-av">
                    {u.picture_url
                      ? <img src={u.picture_url} alt={u.full_name} />
                      : <span className="cmt-mention-av-fallback">{initials(u.full_name)}</span>
                    }
                  </span>
                  <span className="cmt-mention-name">{u.full_name}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={newTextareaRef}
            className={`cmt-input cmt-input-new ${messengerLayout ? 'cmt-input-messenger' : ''}`}
            placeholder={messengerReplyTo ? t('comments.replyPlaceholder') : (isGeneralTab ? t('comments.placeholderGeneral') : t('comments.placeholder'))}
            value={newContent}
            onChange={handleNewContentChange}
            rows={1}
            maxLength={2000}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck="false"
            onFocus={(e) => { if (!messengerLayout) e.target.rows = 3 }}
            onBlur={(e) => {
              if (!messengerLayout && !e.target.value.trim()) e.target.rows = 1
              // Close mention dropdown with delay (allow click to register first)
              setTimeout(() => setMentionQuery(null), 150)
            }}
            onKeyDown={(e) => handleNewKeyDown(e, e.target.closest('form'))}
          />
        </div>
        {messengerLayout && (
          <button
            type="submit"
            className="cmt-send-icon-btn"
            disabled={submitting || !newContent.trim()}
            aria-label={t('comments.send')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
      {!messengerLayout && newContent.trim() && (
        <div className="cmt-new-actions">
          <button type="submit" className="cmt-btn cmt-btn-primary" disabled={submitting}>
            {submitting ? t('comments.sending') : t('comments.send')}
          </button>
          <button type="button" className="cmt-btn" onClick={() => setNewContent('')}>
            {t('comments.cancel')}
          </button>
        </div>
      )}
    </form>
  ) : null

  return (
    <div className={`cmt-section ${messengerLayout ? 'cmt-messenger' : ''}`}>
      {!hideHeader && (
        <div className="cmt-section-header">
          <h3 className="cmt-title">{t('comments.title')}</h3>
          <span className="cmt-count">{totalCount}</span>
        </div>
      )}

      {/* Tab switcher: Event / General */}
      {!hideTabs && (
        <div className="cmt-tabs">
          <button className={`cmt-tab ${activeTab === 'event' ? 'cmt-tab-active' : ''}`} onClick={() => setActiveTab('event')}>
            {t('comments.tabEvent')}
          </button>
          <button className={`cmt-tab ${activeTab === 'general' ? 'cmt-tab-active' : ''}`} onClick={() => setActiveTab('general')}>
            {t('comments.tabGeneral')}
            {generalComments.length > 0 && <span className="cmt-tab-badge">{countAll(generalComments)}</span>}
          </button>
        </div>
      )}

      {error && <div className="cmt-error">{error}</div>}

      {messengerLayout ? (
        <>
          {/* Scrollable messages – pinned at top (via backend sort), oldest first, newest bottom */}
          <div className="cmt-list cmt-list-messenger" ref={listRef}>
            {/* Load older messages button */}
            {hasMoreOlder && (
              <button className="cmt-load-older" onClick={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? '...' : 'Starsze wiadomości'}
              </button>
            )}
            {/* Spacer pushes messages to bottom when list is short */}
            <div className="cmt-list-spacer" aria-hidden="true" />
            {currentComments.length === 0 ? (
              <div className="cmt-empty">
                <p>{isGeneralTab ? t('comments.emptyGeneral') : t('comments.empty')}</p>
              </div>
            ) : (
              currentComments.map((c) => renderCommentGroup(c))
            )}
          </div>

          {/* Input at bottom */}
          {commentForm}
        </>
      ) : (
        <>
          {/* Standard layout: form on top, newest at bottom */}
          {commentForm}

          <div className="cmt-list" ref={listRef}>
            {currentComments.length === 0 ? (
              <div className="cmt-empty">
                <p>{isGeneralTab ? t('comments.emptyGeneral') : t('comments.empty')}</p>
              </div>
            ) : (
              currentComments.map((c) => renderCommentGroup(c))
            )}
          </div>
        </>
      )}

      {/* Reaction picker rendered via portal to escape overflow containers */}
      {showReactionPicker && pickerPos && createPortal(
        <div
          className="cmt-reaction-picker"
          style={{ bottom: `${pickerPos.bottom}px`, left: `${pickerPos.left}px` }}
        >
          {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
            <button key={type} className="cmt-reaction-pick" onClick={() => handleReaction(showReactionPicker, type)} title={type}>{emoji}</button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export default CommentsSection
