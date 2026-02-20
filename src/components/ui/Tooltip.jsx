import { useState, useRef } from 'react'

/**
 * Instant custom tooltip that replaces native `title` attributes.
 * Shows immediately on hover/focus with no browser delay.
 */
export default function Tooltip({ text, children, className = '' }) {
  const [visible, setVisible] = useState(false)
  const wrapperRef = useRef(null)

  if (!text) return children

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg
            bg-navy text-cream dark:bg-cream dark:text-navy
            px-3 py-2 text-xs leading-relaxed shadow-lg
            pointer-events-none whitespace-pre-line"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy dark:border-t-cream" />
        </span>
      )}
    </span>
  )
}
