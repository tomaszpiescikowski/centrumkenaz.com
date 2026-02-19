import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useCity } from '../../context/CityContext'
import { useLanguage } from '../../context/LanguageContext'
import useDropdownViewportClamp from '../../hooks/useDropdownViewportClamp'
import styles from '../../styles/modules/components/CitySelector.module.css'

function CitySelector({ compact = false }) {
  const { cities, selectedCity, selectCity, loading } = useCity()
  const { t } = useLanguage()
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const isDisabled = loading || cities.length === 0
  const isMenuOpen = isOpen && !isDisabled
  const selectedLabel = useMemo(
    () => selectedCity?.name || t('nav.city'),
    [selectedCity?.name, t],
  )
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

  useEffect(() => {
    if (!isMenuOpen) return undefined

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeMenu()
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [isMenuOpen, closeMenu])

  return (
    <div className={`${styles.root} ${compact ? styles.compactRoot : ''}`} ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('nav.city')}
        aria-haspopup="listbox"
        aria-expanded={isOpen && !isDisabled}
        aria-controls={listboxId}
        disabled={isDisabled}
        onClick={toggleMenu}
        onKeyDown={handleTriggerKeyDown}
        className={styles.trigger}
      >
        <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className={styles.label}>
          {selectedLabel}
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
          {cities.map((city) => (
            <button
              type="button"
              key={city.slug}
              role="option"
              aria-selected={selectedCity?.slug === city.slug}
              onClick={() => {
                selectCity(city.slug)
                closeMenu()
              }}
              className={`${styles.menuItem} ${selectedCity?.slug === city.slug ? styles.menuItemSelected : ''}`}
            >
              <span className={styles.menuItemLabel}>{city.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(CitySelector)
