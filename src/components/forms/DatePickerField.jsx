import { useRef } from 'react'

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
    <div className="relative">
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className={`ui-input ui-input-date ${inputClassName}`}
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
