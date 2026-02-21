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

function CommentsSection({ resourceType, resourceId }) {
  const { user, authFetch } = useAuth()
  const { t } = useLanguage()
  const isAdmin = user?.role === 'admin'

  const [comments, setComments] = useState([])
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

  const replyInputRef = useRef(null)
  const editInputRef = useRef(null)

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

  useEffect(() => {
    loadComments()
  }, [loadComments])

  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      replyInputRef.current.focus()
    }
  }, [replyingTo])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newContent.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await createComment(resourceType, resourceId, authFetch, { content: newContent.trim() })
      setNewContent('')
      await loadComments()
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
      await createComment(resourceType, resourceId, authFetch, {
        content: replyContent.trim(),
        parentId,
      })
      setReplyContent('')
      setReplyingTo(null)
      await loadComments()
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
      await updateComment(commentId, authFetch, {
        content: editContent.trim(),
        version: editVersion,
      })
      setEditingId(null)
      setEditContent('')
      setEditVersion(null)
      await loadComments()
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
      await loadComments()
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
      await loadComments()
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
      await loadComments()
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

  const renderComment = (comment, depth = 0) => {
    const isOwn = user?.id === comment.author.id
    const isEditing = editingId === comment.id
    const isReplying = replyingTo === comment.id
    const maxDepth = 3

    return (
      <div
        key={comment.id}
        className={`cmt-item ${comment.is_pinned ? 'cmt-pinned' : ''} ${depth > 0 ? 'cmt-reply' : ''}`}
        style={depth > 0 ? { marginLeft: Math.min(depth, maxDepth) * 1.5 + 'rem' } : undefined}
      >
        {comment.is_pinned && (
          <div className="cmt-pin-badge">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1-.707.707l-.708-.707-3.535 3.536.707.707a.5.5 0 0 1-.707.707l-1.414-1.414-2.829 2.828a.5.5 0 0 1-.707 0l-.707-.707L1.414 14.5l-.707-.707 3.182-3.182-.707-.707a.5.5 0 0 1 0-.707l2.829-2.829L4.596 5.04a.5.5 0 1 1 .707-.707l.707.707L9.546 1.5l-.707-.707a.5.5 0 0 1 .283-.849l.707-.222z" />
            </svg>
            {t('comments.pinned')}
          </div>
        )}

        <div className="cmt-header">
          <Link to={`/people/${comment.author.id}`} className="cmt-avatar-link">
            <div className="cmt-av-wrap">
              {comment.author.picture_url ? (
                <img
                  src={comment.author.picture_url}
                  alt={comment.author.full_name}
                  className="cmt-av cmt-av-img"
                />
              ) : (
                <div className="cmt-av">{initials(comment.author.full_name)}</div>
              )}
            </div>
          </Link>
          <div className="cmt-meta">
            <Link to={`/people/${comment.author.id}`} className="cmt-author">
              {comment.author.full_name}
            </Link>
            <span className="cmt-time">{formatTime(comment.created_at)}</span>
            {comment.updated_at && !comment.is_deleted && (
              <span className="cmt-edited">{t('comments.edited')}</span>
            )}
          </div>
        </div>

        {isEditing ? (
          <form className="cmt-edit-form" onSubmit={(e) => handleEdit(e, comment.id)}>
            <textarea
              ref={editInputRef}
              className="cmt-input"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              maxLength={2000}
            />
            <div className="cmt-edit-actions">
              <button type="submit" className="cmt-btn cmt-btn-primary" disabled={submitting || !editContent.trim()}>
                {t('comments.save')}
              </button>
              <button
                type="button"
                className="cmt-btn"
                onClick={() => { setEditingId(null); setEditContent(''); setEditVersion(null) }}
              >
                {t('comments.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className={`cmt-content ${comment.is_deleted ? 'cmt-deleted' : ''}`}>
            {comment.content}
          </div>
        )}

        {/* Reactions display */}
        {!comment.is_deleted && comment.reactions && comment.reactions.length > 0 && (
          <div className="cmt-reactions">
            {comment.reactions.map((r) => (
              <button
                key={r.reaction_type}
                className={`cmt-reaction-chip ${r.reacted_by_me ? 'cmt-reaction-mine' : ''}`}
                onClick={() => handleReaction(comment.id, r.reaction_type)}
                title={r.reaction_type}
              >
                <span>{REACTION_EMOJIS[r.reaction_type] || r.reaction_type}</span>
                <span className="cmt-reaction-count">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions row */}
        {!comment.is_deleted && !isEditing && (
          <div className="cmt-actions">
            <button
              className="cmt-action-btn"
              onClick={() => {
                setReplyingTo(isReplying ? null : comment.id)
                setReplyContent('')
              }}
            >
              {t('comments.reply')}
            </button>

            <div className="cmt-reaction-trigger-wrap">
              <button
                className="cmt-action-btn"
                onClick={() => setShowReactionPicker(showReactionPicker === comment.id ? null : comment.id)}
              >
                😀
              </button>
              {showReactionPicker === comment.id && (
                <div className="cmt-reaction-picker">
                  {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                    <button
                      key={type}
                      className="cmt-reaction-pick"
                      onClick={() => handleReaction(comment.id, type)}
                      title={type}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isOwn && (
              <button
                className="cmt-action-btn"
                onClick={() => {
                  setEditingId(comment.id)
                  setEditContent(comment.content)
                  setEditVersion(comment.version)
                }}
              >
                {t('comments.edit')}
              </button>
            )}

            {(isOwn || isAdmin) && (
              <button className="cmt-action-btn cmt-action-danger" onClick={() => handleDelete(comment.id)}>
                {t('comments.delete')}
              </button>
            )}

            {isAdmin && (
              <button className="cmt-action-btn" onClick={() => handlePin(comment.id)}>
                {comment.is_pinned ? t('comments.unpin') : t('comments.pin')}
              </button>
            )}
          </div>
        )}

        {/* Reply form */}
        {isReplying && (
          <form className="cmt-reply-form" onSubmit={(e) => handleReply(e, comment.id)}>
            <textarea
              ref={replyInputRef}
              className="cmt-input cmt-input-sm"
              placeholder={t('comments.replyPlaceholder')}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={2}
              maxLength={2000}
            />
            <div className="cmt-edit-actions">
              <button type="submit" className="cmt-btn cmt-btn-primary" disabled={submitting || !replyContent.trim()}>
                {t('comments.send')}
              </button>
              <button
                type="button"
                className="cmt-btn"
                onClick={() => { setReplyingTo(null); setReplyContent('') }}
              >
                {t('comments.cancel')}
              </button>
            </div>
          </form>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="cmt-replies">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="cmt-loading">{t('comments.loading')}</div>
  }

  return (
    <div className="cmt-section">
      <div className="cmt-section-header">
        <h3 className="cmt-title">{t('comments.title')}</h3>
        <span className="cmt-count">{comments.length}</span>
      </div>

      {error && <div className="cmt-error">{error}</div>}

      {/* New comment form */}
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
            placeholder={t('comments.placeholder')}
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

      {/* Comments list */}
      <div className="cmt-list">
        {comments.length === 0 ? (
          <div className="cmt-empty">
            <p>{t('comments.empty')}</p>
          </div>
        ) : (
          comments.map((c) => renderComment(c))
        )}
      </div>
    </div>
  )
}

export default CommentsSection
