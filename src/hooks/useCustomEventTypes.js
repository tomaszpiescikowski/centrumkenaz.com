import { useState, useCallback } from 'react'
import { BUILT_IN_KEYS } from '../constants/eventIcons'

const STORAGE_KEY = 'kenaz.customEventTypes'

const DEFAULT_COLORS = [
  'text-red-500', 'text-orange-500', 'text-amber-500', 'text-yellow-500',
  'text-lime-500', 'text-green-500', 'text-teal-500', 'text-cyan-500',
  'text-blue-500', 'text-indigo-500', 'text-violet-500', 'text-purple-500',
  'text-fuchsia-500', 'text-pink-500', 'text-rose-500', 'text-slate-500',
]

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw).filter(
      (t) => t && t.key && t.label && t.emoji && !BUILT_IN_KEYS.includes(t.key)
    )
  } catch {
    return []
  }
}

function save(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

/**
 * Hook for managing admin-defined custom event types.
 * Persisted in localStorage.
 *
 * Each custom type: { key: string, label: string, emoji: string, color: string }
 */
export function useCustomEventTypes() {
  const [customTypes, setCustomTypes] = useState(load)

  const addCustomType = useCallback(({ key, label, emoji, color }) => {
    const trimmedKey = key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!trimmedKey || !label.trim() || !emoji) return { error: 'Wypełnij wszystkie pola.' }
    if (BUILT_IN_KEYS.includes(trimmedKey)) return { error: 'Ta nazwa jest już zajęta przez wbudowany typ.' }

    setCustomTypes((prev) => {
      if (prev.find((t) => t.key === trimmedKey)) return prev
      const next = [...prev, { key: trimmedKey, label: label.trim(), emoji, color: color || 'text-gray-400' }]
      save(next)
      return next
    })
    return { ok: true, key: trimmedKey }
  }, [])

  const removeCustomType = useCallback((key) => {
    setCustomTypes((prev) => {
      const next = prev.filter((t) => t.key !== key)
      save(next)
      return next
    })
  }, [])

  const updateCustomType = useCallback((key, patch) => {
    setCustomTypes((prev) => {
      const next = prev.map((t) => t.key === key ? { ...t, ...patch } : t)
      save(next)
      return next
    })
  }, [])

  return { customTypes, addCustomType, removeCustomType, updateCustomType, DEFAULT_COLORS }
}
