import { useState } from 'react'
import { BUILT_IN_EVENT_ICONS, ICON_MAP, EXTRA_ICON_MAP } from '../../constants/eventIcons'

/**
 * Visual grid picker for selecting an event type icon.
 * Shows built-in icons + custom types from admin.
 *
 * @param {string} value - currently selected type key
 * @param {Function} onChange - called with new key
 * @param {Array} customTypes - from useCustomEventTypes()
 */
function EventIconPicker({ value, onChange, customTypes = [], compact = false }) {
  const [search, setSearch] = useState('')

  const allOptions = [
    ...BUILT_IN_EVENT_ICONS,
    ...customTypes.map((c) => ({ key: c.key, label: c.label, color: c.color, iconKey: c.iconKey })),
  ]

  const filtered = search.trim()
    ? allOptions.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()) || o.key.includes(search.toLowerCase()))
    : allOptions

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Szukaj ikony..."
        className="ui-input text-sm"
      />
      <div className={`grid gap-2 max-h-72 overflow-y-auto pr-1 ${compact ? 'grid-cols-4' : 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8'}`}>
        {filtered.map((opt) => {
          const isSelected = value === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              title={opt.label}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all text-center
                ${isSelected
                  ? 'border-navy bg-navy/10 dark:border-cream dark:bg-cream/10'
                  : 'border-transparent hover:border-navy/30 dark:hover:border-cream/30 hover:bg-navy/5 dark:hover:bg-cream/5'
                }`}
            >
              <span className={`${opt.color}`}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="h-7 w-7"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: opt.iconKey
                      ? (EXTRA_ICON_MAP[opt.iconKey]?.paths || '')
                      : (ICON_MAP[opt.key]?.paths || '')
                  }}
                />
              </span>
              <span className="text-[9px] leading-tight text-navy/60 dark:text-cream/60 break-words w-full">{opt.label}</span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-navy/50 dark:text-cream/50 py-4 text-center">Brak wyników</p>
        )}
      </div>
      {value && (
        <p className="text-xs text-navy/50 dark:text-cream/50">
          Wybrano: <strong>{allOptions.find((o) => o.key === value)?.label || value}</strong>
        </p>
      )}
    </div>
  )
}

export default EventIconPicker
