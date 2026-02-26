import { memo } from 'react'
import styles from '../../styles/modules/components/EventIcon.module.css'
import { ICON_MAP } from '../../constants/eventIcons'

const SIZE_CLASSES = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
}

/**
 * Renders an event icon.
 * - For built-in types: renders SVG paths from eventIcons catalogue.
 * - For custom types (emoji-based): renders the emoji in a wrapper.
 * - Falls back to a generic circle/dot icon for unknown keys.
 *
 * @param {string} type - event_type key
 * @param {'xs'|'sm'|'md'|'lg'} size
 * @param {Array} customTypes - array from useCustomEventTypes, for emoji lookup
 */
function EventIcon({ type, size = 'md', customTypes = [] }) {
  const iconClassName = `${styles.icon} ${SIZE_CLASSES[size] || styles.sizeMd}`

  // Built-in SVG icon
  const builtIn = ICON_MAP[type]
  if (builtIn) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className={iconClassName}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: builtIn.paths }}
      />
    )
  }

  // Custom emoji icon
  const custom = customTypes.find((c) => c.key === type)
  if (custom?.emoji) {
    const emojiSizeMap = { xs: 'text-xs', sm: 'text-base', md: 'text-xl', lg: 'text-3xl' }
    return (
      <span
        role="img"
        aria-label={custom.label}
        className={`inline-flex items-center justify-center leading-none ${emojiSizeMap[size] || 'text-xl'}`}
      >
        {custom.emoji}
      </span>
    )
  }

  // Fallback generic icon
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClassName}>
      <circle cx="12" cy="12" r="9" strokeWidth="1.8"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4M12 16h.01"/>
    </svg>
  )
}

export default memo(EventIcon)

