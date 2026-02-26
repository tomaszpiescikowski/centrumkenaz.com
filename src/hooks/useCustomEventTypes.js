import { useState, useCallback } from 'react'
import { BUILT_IN_KEYS, EXTRA_ICON_MAP } from '../constants/eventIcons'

const STORAGE_KEY = 'kenaz.customEventTypes'

export const DEFAULT_COLORS = [
  'text-red-500', 'text-orange-500', 'text-amber-500', 'text-yellow-500',
  'text-lime-500', 'text-green-500', 'text-teal-500', 'text-cyan-500',
  'text-blue-500', 'text-indigo-500', 'text-violet-500', 'text-purple-500',
  'text-fuchsia-500', 'text-pink-500', 'text-rose-500', 'text-slate-500',
]

/**
 * Converts a display label into a safe slug key.
 * Handles Polish diacritics and special characters.
 */
function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
    .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    // Only keep entries with the new schema (iconKey, not emoji)
    return JSON.parse(raw).filter(
      (t) => t && t.key && t.label && t.iconKey && !BUILT_IN_KEYS.includes(t.key)
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
 * Each custom type: { key: string, label: string, iconKey: string, color: string }
 * - key is auto-generated as a slug from the label
 * - iconKey references an entry in EXTRA_ICONS
 */
export function useCustomEventTypes() {
  const [customTypes, setCustomTypes] = useState(load)

  const addCustomType = useCallback(({ label, iconKey, color }) => {
    if (!label?.trim()) return { error: 'Podaj nazwę aktywności.' }
    if (!iconKey) return { error: 'Wybierz ikonę.' }
    if (!EXTRA_ICON_MAP[iconKey]) return { error: 'Nieprawidłowa ikona.' }

    const generatedKey = slugify(label)
    if (!generatedKey) return { error: 'Nazwa jest nieprawidłowa (nie można wygenerować klucza).' }
    if (BUILT_IN_KEYS.includes(generatedKey)) return { error: 'Taka aktywność istnieje już wśród wbudowanych typów.' }

    let finalKey = generatedKey
    setCustomTypes((prev) => {
      // Ensure uniqueness by appending a counter if needed
      let candidate = generatedKey
      let counter = 2
      while (prev.find((t) => t.key === candidate)) {
        candidate = `${generatedKey}_${counter++}`
      }
      finalKey = candidate
      const next = [...prev, { key: candidate, label: label.trim(), iconKey, color: color || DEFAULT_COLORS[0] }]
      save(next)
      return next
    })
    return { ok: true, key: finalKey }
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
