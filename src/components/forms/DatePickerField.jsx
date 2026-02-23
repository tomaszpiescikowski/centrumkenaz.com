import { useRef } from 'react'

/**
 * DatePickerField
 *
 * For type="datetime-local" we render two separate native inputs:
 *   <input type="date">  +  <input type="time">
 *
 * This is the ONLY cross-browser reliable way to guarantee a 24-hour time
 * picker. Chrome ignores every locale hint (html[lang], input[lang], etc.)
 * for datetime-local and always uses the OS/browser UI locale. Separate
 * type="time" inputs are always rendered in 24h format regardless of locale.
 *
 * The combined value emitted via onChange uses the same "YYYY-MM-DDTHH:MM"
 * format that datetime-local would produce, so callers need no changes.
 *
 * For type="date" (no time part needed) the original single-input behaviour
 * is preserved.
 */

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
)

function splitDateTimeValue(value) {
  if (!value) return { datePart: '', timePart: '' }
  const sep = value.indexOf('T')
  if (sep === -1) return { datePart: value, timePart: '' }
  return {
    datePart: value.slice(0, sep),
    timePart: value.slice(sep + 1, sep + 6), // HH:MM only
  }
}

function combineDateTimeValue(datePart, timePart) {
  if (!datePart) return ''
  return timePart ? `${datePart}T${timePart}` : datePart
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
  // All refs declared unconditionally to satisfy React's rules of hooks.
  const dateRef = useRef(null)  // date part (or single date input)
  const timeRef = useRef(null)  // time part (datetime-local split only)

  if (type === 'datetime-local') {
    const { datePart, timePart } = splitDateTimeValue(value)

    const handleDateChange = (e) => {
      const combined = combineDateTimeValue(e.target.value, timePart)
      onChange({ target: { value: combined } })
    }

    const handleTimeChange = (e) => {
      const combined = combineDateTimeValue(datePart, e.target.value)
      onChange({ target: { value: combined } })
    }

    const openDatePicker = () => {
      const el = dateRef.current
      if (!el) return
      if (typeof el.showPicker === 'function') { el.showPicker(); return }
      el.focus(); el.click()
    }

    return (
      <div className="flex gap-2 min-w-0">
        {/* Date part */}
        <div className="relative flex-1 min-w-0">
          <input
            ref={dateRef}
            type="date"
            value={datePart}
            onChange={handleDateChange}
            required={required}
            className={`ui-input ui-input-date ${inputClassName}`}
            style={{ minWidth: 0 }}
          />
          <button
            type="button"
            onClick={openDatePicker}
            aria-label={buttonLabel}
            className="ui-input-picker-button"
          >
            <CalendarIcon />
          </button>
        </div>

        {/* Time part — type="time" is always 24h regardless of browser locale */}
        <div className="relative w-28 shrink-0">
          <input
            ref={timeRef}
            type="time"
            value={timePart}
            onChange={handleTimeChange}
            required={required}
            className={`ui-input ${inputClassName}`}
            style={{ minWidth: 0 }}
          />
        </div>
      </div>
    )
  }

  // Plain date-only input
  const openPicker = () => {
    const el = dateRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') { el.showPicker(); return }
    el.focus(); el.click()
  }

  return (
    <div className="relative w-full min-w-0">
      <input
        ref={dateRef}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
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
        <CalendarIcon />
      </button>
    </div>
  )
}

export default DatePickerField
