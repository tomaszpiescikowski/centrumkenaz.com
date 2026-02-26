import { useRef, useState, useCallback } from 'react'

/**
 * DatePickerField
 *
 * For type="datetime-local" we render:
 *   <input type="date">  +  a custom text-based 24h time input
 *
 * Native type="time" shows AM/PM on devices with a 12-hour system clock
 * (iOS, Android en-US, etc.) — there is no reliable way to override this
 * via lang/locale attributes. We therefore replace it with a plain text
 * input (inputMode="numeric") that always accepts and displays HH:MM in
 * 24-hour format.
 *
 * The combined value emitted via onChange uses the same "YYYY-MM-DDTHH:MM"
 * format that datetime-local would produce, so callers need no changes.
 *
 * For type="date" (no time part needed) the original single-input behaviour
 * is preserved.
 */

/**
 * Format a raw digit string (up to 4 digits) into HH:MM display text.
 * "1930" → "19:30", "9" → "9", "19" → "19", "193" → "19:3"
 */
function formatTimeDigits(digits) {
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
}

/**
 * Parse a display string like "19:30" or "1930" into a valid "HH:MM" string.
 * Returns null if not a valid 24h time.
 */
function parseTimeInput(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length < 4) return null
  const hh = parseInt(digits.slice(0, 2), 10)
  const mm = parseInt(digits.slice(2, 4), 10)
  if (hh > 23 || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Custom 24h time input. Renders type="text" with inputMode="numeric".
 * Accepts digits only; auto-inserts ":" after the hour digits.
 * Emits the time value (HH:MM) via onTimeChange when valid, or '' when empty.
 */
function TimeInput24h({ value, onTimeChange, required, className }) {
  // Local display state so we can show partial input (e.g. "19" before ":30")
  const [display, setDisplay] = useState(() => value || '')

  // Keep display in sync when value is set externally (e.g. form reset)
  const prevValue = useRef(value)
  if (prevValue.current !== value) {
    prevValue.current = value
    // Only overwrite display if it doesn't already represent the same time
    if (parseTimeInput(display) !== value) {
      setDisplay(value || '')
    }
  }

  const handleChange = useCallback((e) => {
    const raw = e.target.value
    // Strip anything that isn't a digit or colon
    const digits = raw.replace(/\D/g, '').slice(0, 4)

    // Clamp digits to valid 24h time ranges as the user types,
    // so invalid values like "01:77" never appear in the display.
    let clamped = digits
    if (digits.length >= 2) {
      const hh = Math.min(parseInt(digits.slice(0, 2), 10), 23)
      clamped = String(hh).padStart(2, '0') + digits.slice(2)
    }
    if (digits.length === 4) {
      const mm = Math.min(parseInt(digits.slice(2, 4), 10), 59)
      clamped = clamped.slice(0, 2) + String(mm).padStart(2, '0')
    } else if (digits.length === 3) {
      // First minute digit > 5 would always yield mm >= 60, so clamp it to 5
      if (parseInt(digits[2], 10) > 5) clamped = clamped.slice(0, 2) + '5'
    }

    const formatted = formatTimeDigits(clamped)
    setDisplay(formatted)

    const parsed = parseTimeInput(clamped)
    onTimeChange(parsed || '')
  }, [onTimeChange])

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="GG:MM"
      maxLength={5}
      value={display}
      onChange={handleChange}
      required={required}
      className={className}
      style={{ minWidth: 0 }}
    />
  )
}

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
  // Ref for the date input (or the single plain-date input).
  const dateRef = useRef(null)

  if (type === 'datetime-local') {
    const { datePart, timePart } = splitDateTimeValue(value)

    const handleDateChange = (e) => {
      const combined = combineDateTimeValue(e.target.value, timePart)
      onChange({ target: { value: combined } })
    }

    const handleTimeChange = (newTimePart) => {
      const combined = combineDateTimeValue(datePart, newTimePart)
      onChange({ target: { value: combined } })
    }

    const openDatePicker = () => {
      const el = dateRef.current
      if (!el) return
      if (typeof el.showPicker === 'function') { el.showPicker(); return }
      el.focus(); el.click()
    }

    return (
      <div className="flex flex-wrap gap-2 min-w-0">
        {/* Date part */}
        <div className="relative flex-1 min-w-[140px]">
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

        {/* Time part — custom text input, always 24h regardless of device locale */}
        <div className="relative w-24">
          <TimeInput24h
            value={timePart}
            onTimeChange={handleTimeChange}
            required={required}
            className={`ui-input ${inputClassName}`}
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