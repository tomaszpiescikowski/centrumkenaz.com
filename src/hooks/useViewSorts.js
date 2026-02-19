import { useCallback, useState } from 'react'

function useViewSorts(createDefaultSorts) {
  const [sortByView, setSortByView] = useState(() => createDefaultSorts())

  const toggleSort = useCallback((view, key) => {
    setSortByView((prev) => {
      const current = Array.isArray(prev[view]) ? prev[view] : []
      const existingIndex = current.findIndex((item) => item.key === key)

      if (existingIndex === -1) {
        return {
          ...prev,
          [view]: [...current, { key, direction: 'asc' }],
        }
      }

      const existing = current[existingIndex]
      if (existing.direction === 'asc') {
        const next = [...current]
        next[existingIndex] = { ...existing, direction: 'desc' }
        return {
          ...prev,
          [view]: next,
        }
      }

      return {
        ...prev,
        [view]: current.filter((item) => item.key !== key),
      }
    })
  }, [])

  return { sortByView, toggleSort }
}

export default useViewSorts
