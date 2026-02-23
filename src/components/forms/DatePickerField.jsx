import { useRef } from 'react'
import { useLanguage } from '../../context/LanguageContext'

/**
 * Maps app language codes to BCP47 locale tags that guarantee a 24-hour clock
 * and DD/MM/YYYY date order in <input type="datetime-local">.
 *
 * Chrome (and most Chromium-based browsers) determines the picker format from
 * the `lang` attribute on the *input element itself*, NOT from <html lang>.
 * Setting it here is therefore the only reliable cross-browser fix.
 */
const LANG_TO_INPUT_LOCALE = {
  pl: 'pl-PL',
  en: 'en-GB',   // en-GB → 24 h + DD/MM/YYYY (en-US would give 12 h + MM/DD)
  zh: 'zh-CN',
  nl: 'nl-NL',
  it: 'it-IT',
  szl: 'pl-PL',
}

function DatePickerField({
  type = 'date',
  value,
  onChange,
  required = false,
  inputClassName = '',
  buttonLabel = 'Open date picker',
  ...rest
}) {
  const inputRef = useRef(null)
  const { currentLanguage } = useLanguage()
  const inputLang = LANG_TO_INPUT_LOCALE[currentLanguage] || 'pl-PL'

  const openPicker = () => {
    const input = inputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    input.focus()
    input.click()
  }

  return (
    <div className="relative w-full min-w-0">
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        lang={inputLang}
        className={`ui-input ui-input-date ${inputClassName}`}
        style={{ minWidth: 0 }}
        {...rest}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label={buttonLabel}
        className="ui-input-picker-button"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>
    </div>
  )
}

export default DatePickerField
