import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import useDropdownViewportClamp from '../../hooks/useDropdownViewportClamp'
import styles from '../../styles/modules/components/CustomSelect.module.css'

/**
 * Generic custom dropdown select component.
 * Inherits the visual style of CitySelector / LanguageSelector – custom popup,
 * no native <select> widget.
 *
 * @param {Array<{value: string, label: string}>} options
 * @param {string}   value          – currently selected value
 * @param {function} onChange       – called with the new value string
 * @param {string}   [placeholder]  – label shown when nothing is selected
 * @param {boolean}  [isInvalid]    – highlights the trigger in red
 * @param {string}   [preferredAlign] – 'left' | 'right' (menu alignment)
 * @param {string}   [className]    – extra class applied to the root wrapper
 */
function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = '—',
  isInvalid = false,
  preferredAlign = 'left',
  className = '',
}) {
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const isMenuOpen = isOpen

  const selectedOption = options.find((o) => o.value === value)
  const hasSelection = Boolean(selectedOption)
  const selectedLabel = selectedOption?.label ?? placeholder

  const menuStyle = useDropdownViewportClamp({
    isOpen: isMenuOpen,
    containerRef: dropdownRef,
    triggerRef,
    menuRef,
    preferredAlign,
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
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [isMenuOpen, closeMenu])

  return (
    <div
      className={`${styles.root} ${className}`}
      ref={dropdownRef}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isMenuOpen}
        aria-controls={listboxId}
        onClick={toggleMenu}
        onKeyDown={handleTriggerKeyDown}
        className={[
          styles.trigger,
          isInvalid ? styles.triggerInvalid : '',
        ].filter(Boolean).join(' ')}
      >
        <span className={`${styles.label} ${hasSelection ? '' : styles.labelPlaceholder}`}>
          {selectedLabel}
        </span>
        <svg
          className={styles.chevron}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
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
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value)
                closeMenu()
              }}
              className={[
                styles.menuItem,
                value === option.value ? styles.menuItemSelected : '',
              ].filter(Boolean).join(' ')}
            >
              <span className={styles.menuItemLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(CustomSelect)
