import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import useDropdownViewportClamp from '../../hooks/useDropdownViewportClamp'
import styles from '../../styles/modules/components/LanguageSelector.module.css'

function LanguageIcon({ className = styles.icon }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeWidth={2} strokeLinecap="round" d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9M12 3c-2.5 2.5-4 5.7-4 9s1.5 6.5 4 9" />
    </svg>
  )
}

function LanguageSelector({ compact = false }) {
  const { currentLanguage, changeLanguage, languages, currentLanguageData } = useLanguage()
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const isMenuOpen = isOpen
  const languageOptions = useMemo(() => Object.values(languages), [languages])
  const menuStyle = useDropdownViewportClamp({
    isOpen: isMenuOpen,
    containerRef: dropdownRef,
    triggerRef,
    menuRef,
    preferredAlign: 'right',
  })

  const closeMenu = useCallback(() => setIsOpen(false), [])
  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), [])

  const handleTriggerKeyDown = useCallback((event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen(true)
    }
  }, [])

  const handleMenuKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      triggerRef.current?.focus()
    }
  }, [closeMenu])

  const handleSelectLanguage = useCallback((languageCode) => {
    changeLanguage(languageCode)
    closeMenu()
  }, [changeLanguage, closeMenu])

  useEffect(() => {
    if (!isMenuOpen) return undefined

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeMenu()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [isMenuOpen, closeMenu])

  return (
    <div className={`${styles.root} ${compact ? styles.compactRoot : ''}`} ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isMenuOpen}
        aria-controls={listboxId}
        className={styles.trigger}
      >
        <LanguageIcon />
        <span className={styles.label}>
          {currentLanguageData.name}
        </span>
        <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isMenuOpen && (
        <div
          ref={menuRef}
          style={menuStyle}
          className={styles.menu}
          id={listboxId}
          role="listbox"
          onKeyDown={handleMenuKeyDown}
        >
          {languageOptions.map((lang) => (
            <button
              type="button"
              key={lang.code}
              role="option"
              aria-selected={currentLanguage === lang.code}
              onClick={() => handleSelectLanguage(lang.code)}
              className={`${styles.menuItem} ${currentLanguage === lang.code ? styles.menuItemSelected : ''}`}
            >
              <LanguageIcon />
              <span className={styles.menuItemLabel}>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(LanguageSelector)
