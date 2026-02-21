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
 * @param {object} [params] - { offset, limit }
 */
export async function fetchComments(resourceType, resourceId, authFetch, params = {}) {
  const query = new URLSearchParams()
  if (params.offset != null) query.set('offset', params.offset)
  if (params.limit != null) query.set('limit', params.limit)
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
 * Toggle pin on a comment (admin only).
 */
export async function togglePinComment(commentId, authFetch) {
  const res = await requestWithAuth(authFetch, `${API_URL}/comments/${commentId}/pin`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to toggle pin')
  }
  return res.json()
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
