import { useState, useEffect, useCallback } from 'react'
import { EXTRA_ICON_MAP } from '../constants/eventIcons'
import { fetchEventTypes, createEventType, deleteEventType } from '../api/eventTypes'

export const DEFAULT_COLORS = [
  'text-red-500', 'text-orange-500', 'text-amber-500', 'text-yellow-500',
  'text-lime-500', 'text-green-500', 'text-teal-500', 'text-cyan-500',
  'text-blue-500', 'text-indigo-500', 'text-violet-500', 'text-purple-500',
  'text-fuchsia-500', 'text-pink-500', 'text-rose-500', 'text-slate-500',
]

/**
 * Hook for managing admin-defined custom event types.
 * Data is persisted in the database and shared across all admin browsers.
 *
 * @param {{ authFetch?: Function }} options
 *   Pass `authFetch` from AuthContext when you need to add/remove types (admin only).
 *   For read-only consumers (EventDetail, pickers) you can call the hook with no args.
 *
 * Each custom type: { key: string, label: string, icon_key: string, color: string }
 */
export function useCustomEventTypes({ authFetch } = {}) {
  const [customTypes, setCustomTypes] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const data = await fetchEventTypes()
      // Normalise: the backend uses icon_key; keep both so legacy consumers work
      setCustomTypes(data.map((t) => ({ ...t, iconKey: t.icon_key })))
    } catch (err) {
      // Non-critical — keep the previous list intact rather than wiping to []
      console.warn('[useCustomEventTypes] fetch failed:', err?.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const addCustomType = useCallback(async ({ label, iconKey, color }) => {
    if (!authFetch) return { error: 'Nie zalogowano.' }
    if (!label?.trim()) return { error: 'Podaj nazwę kategorii.' }
    if (!iconKey) return { error: 'Wybierz ikonę.' }
    if (!EXTRA_ICON_MAP[iconKey]) return { error: 'Nieprawidłowa ikona.' }
    try {
      const result = await createEventType(authFetch, {
        label: label.trim(),
        icon_key: iconKey,
        color: color || DEFAULT_COLORS[0],
      })
      await reload()
      return { ok: true, key: result.key }
    } catch (err) {
      return { error: err.message || 'Nie udało się dodać typu.' }
    }
  }, [authFetch, reload])

  const removeCustomType = useCallback(async (key) => {
    if (!authFetch) return
    await deleteEventType(authFetch, key)
    await reload()
  }, [authFetch, reload])

  return { customTypes, loading, addCustomType, removeCustomType, DEFAULT_COLORS }
}

