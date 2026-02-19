export function toLocalDateKey(input) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input)
  if (Number.isNaN(date.getTime())) return null

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

