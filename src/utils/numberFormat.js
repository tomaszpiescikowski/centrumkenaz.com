export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const normalized = value.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return normalized ? Number(normalized[0]) : 0
}

export function parsePercent(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const normalized = value.replace('%', '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatPercent(value, digits = 1) {
  const safe = Number.isFinite(value) ? value : 0
  return `${safe.toFixed(digits)}%`
}

export function formatAmount(value) {
  return `${value.toFixed(2)} PLN`
}
