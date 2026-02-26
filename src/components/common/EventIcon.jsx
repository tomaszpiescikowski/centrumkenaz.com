import { memo } from 'react'
import styles from '../../styles/modules/components/EventIcon.module.css'
import { ICON_MAP, EXTRA_ICON_MAP } from '../../constants/eventIcons'

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

  // Custom type SVG icon (via EXTRA_ICONS pool)
  const custom = customTypes.find((c) => c.key === type)
  if (custom?.iconKey) {
    const extraIcon = EXTRA_ICON_MAP[custom.iconKey]
    if (extraIcon) {
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className={iconClassName}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: extraIcon.paths }}
        />
      )
    }
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

