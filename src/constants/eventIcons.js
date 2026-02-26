/**
 * Built-in event type icon definitions.
 * Each entry has: key, label (Polish), color (Tailwind text class), and paths (SVG content as string).
 *
 * Custom icons (added by admin) are stored in localStorage via useCustomEventTypes hook
 * and are represented by an emoji rather than SVG paths.
 */

export const BUILT_IN_EVENT_ICONS = [
  {
    key: 'karate',
    label: 'Karate',
    color: 'text-cyan-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3L8.5 9l3.5 1.5 3.5-1.5L12 3z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8.5 9v7l3.5 4 3.5-4V9"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 12h12"/>`,
  },
  {
    key: 'mors',
    label: 'Morsowanie',
    color: 'text-blue-400',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7l4-4 4 4"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 13c2-2 4-2 6 0s4 2 6 0"/>`,
  },
  {
    key: 'planszowki',
    label: 'Planszówki',
    color: 'text-violet-500',
    paths: `<rect x="3" y="3" width="8" height="8" rx="1.5" strokeWidth="1.8"/>
            <rect x="13" y="3" width="8" height="8" rx="1.5" strokeWidth="1.8"/>
            <rect x="3" y="13" width="8" height="8" rx="1.5" strokeWidth="1.8"/>
            <rect x="13" y="13" width="8" height="8" rx="1.5" strokeWidth="1.8"/>
            <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="7" cy="17" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="14.5" cy="14.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="19.5" cy="14.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="14.5" cy="19.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="19.5" cy="19.5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="17" cy="17" r="1" fill="currentColor" stroke="none"/>`,
  },
  {
    key: 'ognisko',
    label: 'Ognisko',
    color: 'text-orange-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 22c-4.4 0-7-3-7-6 0-2.2 1.2-4.2 3-5.5 1-0.7 1.7-1.8 2-3 0.5 1.5 1.5 2.8 3 3.5C14.5 12 16 13.8 16 16c0 3-2.6 6-4 6z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 22c-1.5 0-2.5-1.5-2.5-3.5S10.5 15 12 14c1.5 1 2.5 2.5 2.5 4.5S13.5 22 12 22z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 19h-4M20 19h-4"/>`,
  },
  {
    key: 'spacer',
    label: 'Spacer',
    color: 'text-green-500',
    paths: `<circle cx="12" cy="4" r="1.8" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 9l3 2 3-2"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 11v5"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 22l3-6 3 6"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 14l3-3"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M18 14l-3-3"/>`,
  },
  {
    key: 'joga',
    label: 'Joga',
    color: 'text-pink-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4a2 2 0 100 4 2 2 0 000-4z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 14c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 14l3 4h10l3-4"/>`,
  },
  {
    key: 'wyjazd',
    label: 'Wyjazd',
    color: 'text-amber-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 9l-8-6-8 6"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 9v11a1 1 0 001 1h4v-5h6v5h4a1 1 0 001-1V9"/>`,
  },
  {
    key: 'boks',
    label: 'Boks',
    color: 'text-red-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 8a3 3 0 013-3h3a3 3 0 013 3v4a3 3 0 01-3 3H9a3 3 0 01-3-3V8z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 9h2a2 2 0 012 2v1a2 2 0 01-2 2h-2"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 15l-1 5M16 15l1 5M7 20h10"/>`,
  },
  {
    key: 'silownia',
    label: 'Siłownia',
    color: 'text-slate-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 12h12"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 9v6M20 9v6"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2 10.5v3M22 10.5v3"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 9v6M18 9v6"/>`,
  },
  {
    key: 'bieganie',
    label: 'Bieganie',
    color: 'text-lime-500',
    paths: `<circle cx="14" cy="4" r="1.8" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 9.5l4-2 2.5 3-3 2.5"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6.5 8l3.5 1.5"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.5 13L11 20"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 16.5l3-3.5"/>`,
  },
  {
    key: 'rower',
    label: 'Rower / MTB',
    color: 'text-teal-500',
    paths: `<circle cx="6" cy="16" r="4" strokeWidth="1.8"/>
            <circle cx="18" cy="16" r="4" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 16l6-8 6 8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8h3M9 8l-3 8"/>`,
  },
  {
    key: 'pilka_nozna',
    label: 'Piłka nożna',
    color: 'text-green-600',
    paths: `<circle cx="12" cy="12" r="9" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/>`,
  },
  {
    key: 'koszykowka',
    label: 'Koszykówka',
    color: 'text-orange-400',
    paths: `<circle cx="12" cy="12" r="9" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 12h18"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3c2.5 3 2.5 6 0 9s-2.5 6 0 9"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3c-2.5 3-2.5 6 0 9s2.5 6 0 9"/>`,
  },
  {
    key: 'tenis',
    label: 'Tenis / Squash',
    color: 'text-yellow-500',
    paths: `<circle cx="12" cy="12" r="9" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3.5 7c3 2 3 6 0 8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20.5 7c-3 2-3 6 0 8"/>`,
  },
  {
    key: 'siatkowka',
    label: 'Siatkówka',
    color: 'text-yellow-400',
    paths: `<circle cx="12" cy="10" r="7" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 10h14"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v14"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 19h16"/>`,
  },
  {
    key: 'plywanie',
    label: 'Pływanie',
    color: 'text-blue-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>
            <circle cx="13" cy="7" r="2" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 10l5-3 3 5"/>`,
  },
  {
    key: 'wspinaczka',
    label: 'Wspinaczka',
    color: 'text-stone-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 21l6-8 4 3 5-10 3 15"/>
            <circle cx="9" cy="7" r="1.5" strokeWidth="1.8"/>`,
  },
  {
    key: 'narty',
    label: 'Narty / Snowboard',
    color: 'text-sky-400',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20l16-12"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2 21h20"/>
            <circle cx="14" cy="6" r="2" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8l2 4-3 2"/>`,
  },
  {
    key: 'kajak',
    label: 'Kajak / Woda',
    color: 'text-cyan-400',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v18"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 6l5 3 5-3"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 18l5-3 5 3"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>`,
  },
  {
    key: 'taniec',
    label: 'Taniec',
    color: 'text-fuchsia-500',
    paths: `<circle cx="9" cy="4" r="1.5" strokeWidth="1.8"/>
            <circle cx="16" cy="6" r="1.5" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 6v6l-3 6"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 10l3 2"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 8v5l3 7"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 13l-3-1"/>`,
  },
  {
    key: 'muzyka',
    label: 'Muzyka / Koncert',
    color: 'text-purple-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 18V6l12-3v12"/>
            <circle cx="6" cy="18" r="3" strokeWidth="1.8"/>
            <circle cx="18" cy="15" r="3" strokeWidth="1.8"/>`,
  },
  {
    key: 'kino',
    label: 'Kino / Film',
    color: 'text-neutral-500',
    paths: `<rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2 8h20M2 16h20M8 4v16M16 4v16"/>`,
  },
  {
    key: 'teatr',
    label: 'Teatr',
    color: 'text-rose-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 9a4 4 0 008 0"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 5h12v10a6 6 0 01-12 0V5z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5V3M15 5V3"/>`,
  },
  {
    key: 'warsztaty',
    label: 'Warsztaty',
    color: 'text-amber-600',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>`,
  },
  {
    key: 'gotowanie',
    label: 'Gotowanie',
    color: 'text-orange-400',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 10V6a4 4 0 118 0v4"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 10h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 14v2"/>`,
  },
  {
    key: 'medytacja',
    label: 'Medytacja',
    color: 'text-indigo-400',
    paths: `<circle cx="12" cy="5" r="2" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 14c0-4 3-7 7-7s7 3 7 7"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 14h14"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 14v4l4 3 4-3v-4"/>`,
  },
  {
    key: 'fitness',
    label: 'Fitness / Aerobik',
    color: 'text-pink-400',
    paths: `<circle cx="12" cy="5" r="2" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 12l6-7 6 7"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 20l3-8 3 8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 15h4M16 15h4"/>`,
  },
  {
    key: 'paintball',
    label: 'Paintball / Laser',
    color: 'text-red-400',
    paths: `<circle cx="12" cy="12" r="3" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12"/>`,
  },
  {
    key: 'wolontariat',
    label: 'Wolontariat',
    color: 'text-emerald-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>`,
  },
  {
    key: 'integracja',
    label: 'Integracja',
    color: 'text-sky-500',
    paths: `<circle cx="9" cy="7" r="3" strokeWidth="1.8"/>
            <circle cx="15" cy="7" r="3" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 20a6 6 0 0112 0"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 11c3.3 0 6 2.7 6 6"/>`,
  },
  {
    key: 'inne',
    label: 'Inne',
    color: 'text-gray-400',
    paths: `<circle cx="12" cy="12" r="9" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4M12 16h.01"/>`,
  },
]

/** Map from key → icon definition for fast lookup */
export const ICON_MAP = Object.fromEntries(
  BUILT_IN_EVENT_ICONS.map((icon) => [icon.key, icon])
)

/** All built-in keys in order */
export const BUILT_IN_KEYS = BUILT_IN_EVENT_ICONS.map((i) => i.key)

/** Tailwind color for a given key (falls back to gray) */
export function getIconColor(key, customTypes = []) {
  if (ICON_MAP[key]) return ICON_MAP[key].color
  const custom = customTypes.find((c) => c.key === key)
  return custom?.color || 'text-gray-400'
}

/** Label for a given key */
export function getIconLabel(key, customTypes = []) {
  if (ICON_MAP[key]) return ICON_MAP[key].label
  const custom = customTypes.find((c) => c.key === key)
  return custom?.label || key
}
