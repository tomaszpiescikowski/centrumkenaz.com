import { API_URL } from './config'

function requestWithAuth(authFetch, url, options = {}) {
  if (authFetch) return authFetch(url, options)
  return fetch(url, options)
}

/**
 * Fetch comments for a resource.
 * @param {string} resourceType - e.g. "event"
 * @param {string} resourceId - resource UUID
 * @param {Function} authFetch - authenticated fetch
 * @param {object} [params] - { offset, limit, order }
 */
export async function fetchComments(resourceType, resourceId, authFetch, params = {}) {
  const query = new URLSearchParams()
  if (params.offset != null) query.set('offset', params.offset)
  if (params.limit != null) query.set('limit', params.limit)
  if (params.order != null) query.set('order', params.order)
  if (params.before_ts != null) query.set('before_ts', params.before_ts)
  if (params.after_ts != null) query.set('after_ts', params.after_ts)
  const qs = query.toString() ? `?${query.toString()}` : ''
  const res = await requestWithAuth(authFetch, `${API_URL}/comments/${resourceType}/${resourceId}${qs}`)
  if (!res.ok) throw new Error('Failed to fetch comments')
  return res.json()
}

/**
 * Create a new comment.
 */
export async function createComment(resourceType, resourceId, authFetch, { content, parentId }) {
  const body = { content }
  if (parentId) body.parent_id = parentId
  const res = await requestWithAuth(authFetch, `${API_URL}/comments/${resourceType}/${resourceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to create comment')
  }
  return res.json()
}

/**
 * Edit a comment (optimistic locking).
 */
export async function updateComment(commentId, authFetch, { content, version }) {
  const res = await requestWithAuth(authFetch, `${API_URL}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, version }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to update comment')
  }
  return res.json()
}

/**
 * Soft-delete a comment.
 */
export async function deleteComment(commentId, authFetch) {
  const res = await requestWithAuth(authFetch, `${API_URL}/comments/${commentId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to delete comment')
  }
}


/**
 * Toggle a reaction on a comment.
 */
export async function toggleReaction(commentId, authFetch, reactionType) {
  const res = await requestWithAuth(authFetch, `${API_URL}/comments/${commentId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction_type: reactionType }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to toggle reaction')
  }
  return res.json()
}

/**
 * Lightweight polling check — ask the server which chats have new messages.
 * @param {Function} authFetch - authenticated fetch
 * @param {Record<string, string>} sinceMap - { chatId: latestKnownISOTimestamp }
 * @returns {Promise<Record<string, string>>} chats that have new activity → their latest timestamp
 */
export async function checkNewMessages(authFetch, sinceMap) {
  const res = await requestWithAuth(authFetch, `${API_URL}/comments/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chats: sinceMap }),
  })
  if (!res.ok) return {}
  return res.json()
}
