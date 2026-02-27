import { memo } from 'react'
import { ICON_MAP, EXTRA_ICON_MAP } from '../../constants/eventIcons'

const SIZE_MAP = {
  xs: '0.9rem',
  sm: '1.1rem',
  md: '1.4rem',
  lg: '1.9rem',
}

/**
 * Renders an event category icon as an emoji.
 * - For built-in types: uses the emoji from ICON_MAP.
 * - For custom types:  looks up EXTRA_ICON_MAP via customTypes[].iconKey.
 * - Falls back to 📅 for unknown keys.
 *
 * @param {string} type        - event_type key
 * @param {'xs'|'sm'|'md'|'lg'} size
 * @param {Array}  customTypes - array from useCustomEventTypes, for emoji lookup
 */
function EventIcon({ type, size = 'md', customTypes = [] }) {
  const fontSize = SIZE_MAP[size] || SIZE_MAP.md
  const style = { fontSize, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }

  // Built-in emoji
  const builtIn = ICON_MAP[type]
  if (builtIn?.emoji) {
    return <span role="img" aria-label={builtIn.label} style={style}>{builtIn.emoji}</span>
  }

  // Custom type emoji (via EXTRA_ICONS pool)
  const custom = customTypes.find((c) => c.key === type)
  if (custom?.iconKey) {
    const extraIcon = EXTRA_ICON_MAP[custom.iconKey]
    if (extraIcon?.emoji) {
      return <span role="img" aria-label={extraIcon.label} style={style}>{extraIcon.emoji}</span>
    }
  }

  // Fallback
  return <span role="img" aria-label="event" style={style}>📅</span>
}

export default memo(EventIcon)

