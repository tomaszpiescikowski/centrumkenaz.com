import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
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

function CommentsSection({ resourceType, resourceId, activeTab: externalTab, onTabChange, hideHeader, hideTabs, messengerLayout }) {
  const { user, authFetch } = useAuth()
  const { t } = useLanguage()
  const isAdmin = user?.role === 'admin'

  const [comments, setComments] = useState([])
  const [generalComments, setGeneralComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newContent, setNewContent] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editVersion, setEditVersion] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showReactionPicker, setShowReactionPicker] = useState(null)
  const [longPressId, setLongPressId] = useState(null)
  const [internalTab, setInternalTab] = useState('event')

  const activeTab = externalTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab

  const replyInputRef = useRef(null)
  const editInputRef = useRef(null)
  const listRef = useRef(null)
  const longPressTimer = useRef(null)
  const touchMoved = useRef(false)

  const isGeneralTab = activeTab === 'general'
  const currentComments = isGeneralTab ? generalComments : comments

  const loadComments = useCallback(async () => {
    try {
      const data = await fetchComments(resourceType, resourceId, authFetch)
      setComments(data)
    } catch {
      setError(t('comments.loadError'))
    } finally {
      setLoading(false)
    }
  }, [resourceType, resourceId, authFetch, t])

  const loadGeneralComments = useCallback(async () => {
    try {
      const data = await fetchComments('general', 'global', authFetch)
      setGeneralComments(data)
    } catch {
      /* silent */
    }
  }, [authFetch])

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

  // Auto-scroll to newest message when comments load / change
  useEffect(() => {
    scrollToBottom()
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newContent.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await createComment(currentResourceType, currentResourceId, authFetch, { content: newContent.trim() })
      setNewContent('')
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

  const handleReaction = async (commentId, reactionType) => {
    setError(null)
    try {
      await toggleReaction(commentId, authFetch, reactionType)
      await reloadCurrent()
    } catch (err) {
      setError(err.message)
    }
    setShowReactionPicker(null)
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
  const handleTouchStart = useCallback((commentId) => {
    touchMoved.current = false
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        setLongPressId(commentId)
        setShowReactionPicker(null)
        // Light haptic if available
        if (navigator.vibrate) navigator.vibrate(30)
      }
    }, 500)
  }, [])

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  const handleTouchMove = useCallback(() => {
    touchMoved.current = true
    clearTimeout(longPressTimer.current)
  }, [])

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

  const renderFlatComment = (item) => {
    const isOwn = user?.id === item.author.id
    const isEditingThis = editingId === item.id
    const isReplying = replyingTo === item.id
    // Always reply to the nearest top-level or depth-1 ancestor
    const replyTargetId = item._depth === 0 ? item.id : (item.parent_id || item.id)

    return (
      <div
        key={item.id}
        className={`cmt-item ${item.is_pinned ? 'cmt-pinned' : ''} ${item._visualDepth > 0 ? 'cmt-threaded' : ''}`}
        onTouchStart={(e) => { if (!item.is_deleted) handleTouchStart(item.id) }}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onContextMenu={(e) => { if (longPressId) e.preventDefault() }}
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
              <span className="cmt-time">{formatTime(item.created_at)}</span>
              {item.updated_at && !item.is_deleted && <span className="cmt-edited">{t('comments.edited')}</span>}
            </div>
          </div>

          {isEditingThis ? (
            <form className="cmt-edit-form" onSubmit={(e) => handleEdit(e, item.id)}>
              <textarea ref={editInputRef} className="cmt-input" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} maxLength={2000} />
              <div className="cmt-edit-actions">
                <button type="submit" className="cmt-btn cmt-btn-primary" disabled={submitting || !editContent.trim()}>{t('comments.save')}</button>
                <button type="button" className="cmt-btn" onClick={() => { setEditingId(null); setEditContent(''); setEditVersion(null) }}>{t('comments.cancel')}</button>
              </div>
            </form>
          ) : (
            <div className={`cmt-content ${item.is_deleted ? 'cmt-deleted' : ''}`}>{item.content}</div>
          )}

          {/* Long-press reaction bar (mobile, Messenger-style) */}
          {longPressId === item.id && (
            <div className="cmt-longpress-bar" onTouchStart={(e) => e.stopPropagation()}>
              {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                <button
                  key={type}
                  className="cmt-longpress-emoji"
                  onClick={() => { handleReaction(item.id, type); setLongPressId(null) }}
                  title={type}
                >{emoji}</button>
              ))}
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
              <button className="cmt-action-btn" onClick={() => { setReplyingTo(isReplying ? null : replyTargetId); setReplyContent('') }}>{t('comments.reply')}</button>

              <div className="cmt-reaction-trigger-wrap">
                <button className="cmt-action-btn" onClick={() => setShowReactionPicker(showReactionPicker === item.id ? null : item.id)}>
                  <span className="cmt-react-emoji">😀</span>
                  <span className="cmt-react-text">{t('comments.react')}</span>
                </button>
                {showReactionPicker === item.id && (
                  <div className="cmt-reaction-picker">
                    {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                      <button key={type} className="cmt-reaction-pick" onClick={() => handleReaction(item.id, type)} title={type}>{emoji}</button>
                    ))}
                  </div>
                )}
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

          {/* Reply form */}
          {isReplying && (
            <form className="cmt-reply-form" onSubmit={(e) => handleReply(e, replyTargetId)}>
              <textarea ref={replyInputRef} className="cmt-input cmt-input-sm" placeholder={t('comments.replyPlaceholder')} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={2} maxLength={2000} />
              <div className="cmt-edit-actions">
                <button type="submit" className="cmt-btn cmt-btn-primary" disabled={submitting || !replyContent.trim()}>{t('comments.send')}</button>
                <button type="button" className="cmt-btn" onClick={() => { setReplyingTo(null); setReplyContent('') }}>{t('comments.cancel')}</button>
              </div>
            </form>
          )}
        </div>
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
        <div className="cmt-av-wrap">
          {user?.picture_url ? (
            <img src={user.picture_url} alt={user.full_name} className="cmt-av cmt-av-img" />
          ) : (
            <div className="cmt-av">{initials(user?.full_name)}</div>
          )}
        </div>
        <textarea
          className="cmt-input cmt-input-new"
          placeholder={isGeneralTab ? t('comments.placeholderGeneral') : t('comments.placeholder')}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={1}
          maxLength={2000}
          onFocus={(e) => { e.target.rows = 3 }}
          onBlur={(e) => { if (!e.target.value.trim()) e.target.rows = 1 }}
        />
      </div>
      {newContent.trim() && (
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
            {flatList.length === 0 ? (
              <div className="cmt-empty">
                <p>{isGeneralTab ? t('comments.emptyGeneral') : t('comments.empty')}</p>
              </div>
            ) : (
              flatList.map((item) => renderFlatComment(item))
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
            {flatList.length === 0 ? (
              <div className="cmt-empty">
                <p>{isGeneralTab ? t('comments.emptyGeneral') : t('comments.empty')}</p>
              </div>
            ) : (
              flatList.map((item) => renderFlatComment(item))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default CommentsSection
