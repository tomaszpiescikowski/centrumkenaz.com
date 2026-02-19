export function compareValues(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  const aStr = String(a)
  const bStr = String(b)
  return aStr.localeCompare(bStr, 'pl', { numeric: true, sensitivity: 'base' })
}
