import { memo } from 'react'
import styles from '../../styles/modules/components/EventIcon.module.css'

const SIZE_CLASSES = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
}

const ICON_CONTENT = {
  karate: (
    <>
      <path d="M12 2L8 8l4 2 4-2-4-6z" />
      <path d="M8 8v8l4 6 4-6V8" />
      <path d="M8 12h8" />
    </>
  ),
  mors: (
    <>
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="8" cy="16" r="2" />
      <circle cx="16" cy="16" r="2" />
      <path d="M8 10v4M16 10v4M10 8h4M10 16h4" />
    </>
  ),
  planszowki: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <circle cx="17" cy="7" r="1" fill="currentColor" />
      <circle cx="7" cy="17" r="1" fill="currentColor" />
    </>
  ),
  ognisko: (
    <>
      <path d="M12 22c-4 0-7-3-7-7 0-2 1-4 3-6 1.5-1.5 2-3 2-5 0 3 2 5 4 5s4-2 4-5c0 2 .5 3.5 2 5 2 2 3 4 3 6 0 4-3 7-7 7z" />
      <path d="M12 22c-2 0-3-2-3-4s1-3 3-4c2 1 3 2 3 4s-1 4-3 4z" />
    </>
  ),
  spacer: (
    <>
      <path d="M4 20L8 16M8 16L12 20M8 16V8" />
      <path d="M12 20L16 16M16 16L20 20M16 16V8" />
      <path d="M8 8L12 4L16 8" />
    </>
  ),
  joga: (
    <>
      <path d="M12 4a2 2 0 100 4 2 2 0 000-4z" />
      <path d="M12 10v4M8 14h8M10 18l2-4 2 4" />
    </>
  ),
  wyjazd: (
    <>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
      <path d="M9 22v-6h6v6" />
    </>
  ),
  inne: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" />
    </>
  ),
}

function EventIcon({ type, size = 'md' }) {
  const iconClassName = `${styles.icon} ${SIZE_CLASSES[size] || styles.sizeMd}`
  const iconContent = ICON_CONTENT[type] || <circle cx="12" cy="12" r="8" />

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClassName}>
      {iconContent}
    </svg>
  )
}

export default memo(EventIcon)
