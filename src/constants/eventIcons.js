/**
 * Built-in event type icon definitions.
 * Each entry has: key, label (Polish), color (Tailwind text class), and paths (SVG content as string).
 *
 * Custom icons (added by admin) are stored in localStorage via useCustomEventTypes hook.
 * Custom icons reference an entry from EXTRA_ICONS by key (iconKey field).
 */

export const BUILT_IN_EVENT_ICONS = [
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
    key: 'karate',
    label: 'Karate',
    color: 'text-cyan-500',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3L8.5 9l3.5 1.5 3.5-1.5L12 3z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8.5 9v7l3.5 4 3.5-4V9"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 12h12"/>`,
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
    key: 'medytacja',
    label: 'Medytacja',
    color: 'text-indigo-400',
    paths: `<circle cx="12" cy="5" r="2" strokeWidth="1.8"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 14c0-4 3-7 7-7s7 3 7 7"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 14h14"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 14v4l4 3 4-3v-4"/>`,
  },
  {
    key: 'kajak',
    label: 'Kajaki',
    color: 'text-cyan-400',
    paths: `<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v18"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 6l5 3 5-3"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 18l5-3 5 3"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>`,
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

/**
 * Extra SVG icon pool for custom event types (128 icons).
 * Each entry: { key, label, paths }.
 * The `key` here is used as iconKey in custom type definitions.
 * Unlike BUILT_IN_EVENT_ICONS, these don't have a fixed color — the color
 * is chosen separately when creating the custom type.
 */
export const EXTRA_ICONS = [
  // ── Fitness & Exercise ──
  { key: 'x_skakanki', label: 'Skakanka', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v10"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 8c-1 3 0 6 3 7M19 8c1 3 0 6-3 7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 20l5-4 5 4"/>' },
  { key: 'x_pilates', label: 'Pilates', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 18h16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 18v-4a5 5 0 0110 0v4"/><circle cx="12" cy="8" r="2" strokeWidth="1.8"/>' },
  { key: 'x_tai_chi', label: 'Tai Chi', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v5l-4 3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 11l4-1"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 16l2-4 2 5"/>' },
  { key: 'x_crossfit', label: 'CrossFit', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 12h16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 9v6M20 9v6M7 10v4M17 10v4"/>' },
  { key: 'x_kettlebell', label: 'Kettlebell', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 8a3 3 0 016 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 8c-1 1-2 2-2 4a7 7 0 0014 0c0-2-1-3-2-4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 8h6"/>' },
  { key: 'x_qigong', label: 'Qigong', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 12c0 0 3-3 8-3s8 3 8 3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v7l-3 5M12 16l3 5"/>' },
  { key: 'x_aerobik', label: 'Aerobik', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 10l6-3 6 3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 7v7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 15l4-1 4 1"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 20h4"/>' },
  { key: 'x_trx', label: 'TRX', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 3h8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 3v5M14 3v5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 8l-2 5h8l-2-5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 13v4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 21l3-4 3 4"/>' },
  { key: 'x_calisthenics', label: 'Kalistenika', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8h18"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 8V6M17 8V6"/><circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 8l3 5 3-5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 13v8"/>' },
  { key: 'x_hula_hoop', label: 'Hula-hoop', paths: '<circle cx="12" cy="12" r="9" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12a4 4 0 004-4"/>' },
  // ── Outdoor Fitness ──
  { key: 'x_nordic_walking', label: 'Nordic Walking', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v6l-3 5M12 12l3 5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 21l5-8M20 21l-5-8"/>' },
  { key: 'x_trekking', label: 'Trekking / Turystyka', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 20l6-12 4 4 5-9 3 17"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 20h18"/>' },
  { key: 'x_orienteering', label: 'Orientering', paths: '<circle cx="12" cy="12" r="9" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 9l6 6M15 9l-6 6"/>' },
  { key: 'x_survival', label: 'Survival', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4l-3 5h6l-3-5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 9l-5 2 3 2M15 9l5 2-3 2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 13l3 8 3-8"/>' },
  { key: 'x_oboz', label: 'Obóz / Kemping', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 19l9-14 9 14H3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-4h6v4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 5v3"/>' },
  // ── Water Sports ──
  { key: 'x_surfing', label: 'Surfing', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 18c3-5 6-5 9 0s6 5 9 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 14l8-8"/><circle cx="10" cy="10" r="1.5" strokeWidth="1.8"/>' },
  { key: 'x_windsurfing', label: 'Windsurfing', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4v16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6l-7 8h7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 20h18"/>' },
  { key: 'x_nurkowanie', label: 'Nurkowanie', paths: '<circle cx="12" cy="6" r="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 8l-2 5 4 6 4-6-2-5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 6H5a1 1 0 000 2h3"/>' },
  { key: 'x_snorkeling', label: 'Snorkeling', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 10a8 8 0 0116 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 10h4a4 4 0 008 0h4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 14v6M10 20h4"/>' },
  { key: 'x_paddleboard', label: 'Paddleboard (SUP)', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2 18h20M5 18v-2a7 7 0 0114 0v2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4v10"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 7l3-3 3 3"/>' },
  { key: 'x_zeglowanie', label: 'Żeglarstwo', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v12"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 15L12 3l7 12H5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 19h16"/>' },
  { key: 'x_wioslarstwo', label: 'Wiosłowanie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 19l14-14"/><ellipse cx="5.5" cy="19.5" rx="2.5" ry="1.5" strokeWidth="1.8"/><ellipse cx="19.5" cy="4.5" rx="2" ry="1.2" transform="rotate(-45 19.5 4.5)" strokeWidth="1.8"/>' },
  { key: 'x_wakeboard', label: 'Wakeboard', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 18c3-4 5-4 8-4s5 0 8 4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 14l8-8"/><circle cx="11" cy="7" r="2" strokeWidth="1.8"/>' },
  { key: 'x_kajak_gorski', label: 'Kajak górski', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 6h8l2 8H6z"/>' },
  // ── Winter Sports ──
  { key: 'x_lyzwy', label: 'Łyżwiarstwo', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 19h14"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 19v-4l3-4h6v4"/><circle cx="12" cy="7" r="1.5" strokeWidth="1.8"/>' },
  { key: 'x_hokej', label: 'Hokej na lodzie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 4l12 12"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 14v4a2 2 0 004 0"/><circle cx="19" cy="16" r="2" fill="currentColor" stroke="none"/>' },
  { key: 'x_sanki', label: 'Sanki / Zjazd', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 19h16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 19v-5h12v5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 14V9l4-4 4 4v5"/>' },
  { key: 'x_narciarstwo_biegowe', label: 'Narciarstwo biegowe', paths: '<circle cx="14" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 8l4-2 3 4-4 4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 21l19-2"/>' },
  // ── Racket & Precision ──
  { key: 'x_badminton', label: 'Badminton', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 21l8-8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7a5 5 0 017 7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 6l3-3-3 3z"/>' },
  { key: 'x_pingpong', label: 'Ping-pong', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20l8-8"/><ellipse cx="10" cy="14" rx="5" ry="3" transform="rotate(-45 10 14)" strokeWidth="1.8"/><circle cx="17" cy="7" r="2.5" strokeWidth="1.8"/>' },
  { key: 'x_padel', label: 'Padel', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20l8-8"/><rect x="9" y="8" width="8" height="9" rx="2" transform="rotate(-45 13 12)" strokeWidth="1.8"/><circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none"/>' },
  { key: 'x_szermierka', label: 'Szermierka', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20L18 6"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 6h3v3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 11a3 3 0 000 4"/>' },
  { key: 'x_golf', label: 'Golf', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v14"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l7 4-7 4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 17a6 6 0 0012 0"/>' },
  { key: 'x_kregle', label: 'Kręgle', paths: '<circle cx="12" cy="6" r="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 9v8h6V9"/><ellipse cx="12" cy="19" rx="4" ry="1.5" strokeWidth="1.8"/>' },
  { key: 'x_lucznictwo', label: 'Łucznictwo', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 12a8 8 0 0116 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4v16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 8l3-4 3 4"/>' },
  { key: 'x_strzelectwo', label: 'Strzelectwo / Paintball', paths: '<circle cx="12" cy="12" r="9" strokeWidth="1.8"/><circle cx="12" cy="12" r="5" strokeWidth="1.8"/><circle cx="12" cy="12" r="2" strokeWidth="1.8"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/>' },
  { key: 'x_frisbee', label: 'Frisbee', paths: '<ellipse cx="12" cy="12" rx="9" ry="4" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 12c0-2 4-4 9-4s9 2 9 4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 11c1-1 3-1.5 5-1.5"/>' },
  { key: 'x_darts', label: 'Darts', paths: '<circle cx="12" cy="12" r="9" strokeWidth="1.8"/><circle cx="12" cy="12" r="5" strokeWidth="1.8"/><circle cx="12" cy="12" r="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3V1M19.7 4.3l1.4-1.4"/>' },
  // ── Martial Arts ──
  { key: 'x_judo', label: 'Judo / Jiu-jitsu', paths: '<circle cx="8" cy="4" r="1.5" strokeWidth="1.8"/><circle cx="16" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 6l4 6-4 6M16 6l-4 6 4 6"/>' },
  { key: 'x_aikido', label: 'Aikido', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6l-4 5 5 3 5-3-4-5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 14l-3 5M16 14l3 5"/>' },
  { key: 'x_zapasy', label: 'Zapasy / Wrestling', paths: '<circle cx="8" cy="4" r="1.5" strokeWidth="1.8"/><circle cx="16" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 8l3 5-3 5M19 8l-3 5 3 5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 13h14"/>' },
  { key: 'x_muay_thai', label: 'Muay Thai / Kickboxing', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 8a3 3 0 013-3h2a3 3 0 013 3v3a3 3 0 01-3 3h-2a3 3 0 01-3-3V8z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 11l-4 5M14 11l4 5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 19h8"/>' },
  // ── Nature & Outdoor ──
  { key: 'x_ogrodnictwo', label: 'Ogrodnictwo', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 19c-3-1-7-4-7-9a7 7 0 0114 0c0 5-4 8-7 9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 10v9"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 13l3-3 3 3"/>' },
  { key: 'x_grzybobranie', label: 'Grzybobranie / Foraging', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 13a7 7 0 0114 0H5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 13v6a2 2 0 004 0v-6"/>' },
  { key: 'x_birdwatching', label: 'Obserwacja ptaków', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 10a5 5 0 0110 0H3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 10a5 5 0 0110 0h-10z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 10v4M18 10v4M4 18h8M12 18h8"/>' },
  { key: 'x_astronomia', label: 'Astronomia / Obserwacja nieba', paths: '<circle cx="12" cy="12" r="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>' },
  { key: 'x_geocaching', label: 'Geocaching', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 22s-8-5-8-12a8 8 0 0116 0c0 7-8 12-8 12z"/><circle cx="12" cy="10" r="3" strokeWidth="1.8"/>' },
  { key: 'x_latawiec', label: 'Latawiec', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l7 9-7 9-7-9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 21l3 2-1-2 1-2-3 2z"/>' },
  { key: 'x_piknik', label: 'Piknik', paths: '<rect x="3" y="14" width="18" height="2" rx="1" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 14l3-8M18 14l-3-8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 6h6"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 19h8"/>' },
  { key: 'x_psi_spacer', label: 'Spacer z psem', paths: '<circle cx="16" cy="5" r="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M14 7l-3 3-4 1-2 5 3 4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 13c2-1 4 0 5 2"/>' },
  { key: 'x_jazda_konna', label: 'Jazda konna', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 17c2-4 5-5 7-5s5 1 7 5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 12c0-4 3-8 8-8"/><circle cx="17" cy="5" r="2" strokeWidth="1.8"/>' },
  { key: 'x_hammock', label: 'Hamak / Relaks w naturze', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 8v10M20 8v10"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 10c3 5 10 5 16 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16c3-5 10-5 16 0"/>' },
  // ── Wellness ──
  { key: 'x_sauna', label: 'Sauna', paths: '<rect x="3" y="8" width="18" height="11" rx="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 8V5M12 8V4M17 8V6"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 14h10"/>' },
  { key: 'x_masaz', label: 'Masaż', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 12a6 6 0 0012 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12v-2a4 4 0 018 0v2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 19l2-5h10l2 5M4 19h16"/>' },
  { key: 'x_oddech', label: 'Ćwiczenia oddechowe', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4a4 4 0 000 8 4 4 0 000-8z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 15a9 9 0 0016 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 19a7 7 0 0012 0"/>' },
  { key: 'x_spa', label: 'SPA', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3c-3 2-5 5-5 9a5 5 0 0010 0c0-4-2-7-5-9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v9M8 19h8"/>' },
  { key: 'x_kapiel_zimna', label: 'Zimna kąpiel / Cold plunge', paths: '<rect x="4" y="10" width="16" height="10" rx="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 10V7M12 10V5M16 10V7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 15l2-2 2 2 2-2 2 2"/>' },
  { key: 'x_nidra', label: 'Yoga Nidra / Relaks', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16h16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 16v-3a6 6 0 0112 0v3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 12a2 2 0 004 0"/>' },
  { key: 'x_journal', label: 'Journaling / Dziennik', paths: '<rect x="4" y="3" width="16" height="18" rx="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 8h8M8 12h8M8 16h5"/>' },
  { key: 'x_dzwiekoterapia', label: 'Dźwiękoterapia', paths: '<circle cx="12" cy="12" r="4" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 9a8 8 0 000 6M19 9a8 8 0 010 6"/>' },
  { key: 'x_kapiel_lesna', label: 'Kąpiel leśna (Shinrin-yoku)', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l4 7h-8l4-7z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 9l-3 6h12l-3-6"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v6M9 21h6"/>' },
  { key: 'x_mindfulness', label: 'Mindfulness / Uważność', paths: '<circle cx="12" cy="12" r="9" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12a3 3 0 006 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v1M12 15v1"/>' },
  // ── Creative & Artistic ──
  { key: 'x_rysowanie', label: 'Rysowanie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20l4-4L20 4l-4 4L4 20z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20h4v-4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M14 8l2 2"/>' },
  { key: 'x_malarstwo', label: 'Malarstwo', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 8h8l4-4 4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 14a3 3 0 003 3 3 3 0 003-3H9z"/>' },
  { key: 'x_ceramika', label: 'Ceramika / Garncarstwo', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 14a4 4 0 008 0V8H8v6z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 8h10M6 18h12"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3v5"/>' },
  { key: 'x_rzezba', label: 'Rzeźba', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 4h6l6 6v10H6V4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4v6h6"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 13l2 2 5-5"/>' },
  { key: 'x_fotografia', label: 'Fotografia', paths: '<rect x="3" y="7" width="18" height="14" rx="2" strokeWidth="1.8"/><circle cx="12" cy="14" r="4" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 7l1-3h4l1 3"/>' },
  { key: 'x_pisanie', label: 'Pisanie kreatywne', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 20h9"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
  { key: 'x_dziewiarstwo', label: 'Dziewiarstwo / Szydełkowanie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 15a3 3 0 113 3H5v-3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 18l10-10"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 6a3 3 0 113 3"/>' },
  { key: 'x_origami', label: 'Origami', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 4h16v16L12 4 4 20h16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20l8-8"/>' },
  { key: 'x_kaligrafia', label: 'Kaligrafia', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 4c0 8 12 8 12 16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20h16M6 12c3-2 9-2 12 0"/>' },
  { key: 'x_bizuteria', label: 'Biżuteria artystyczna', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 9l4-6 4 6-4 11L8 9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 9h14"/>' },
  { key: 'x_stolarstwo', label: 'Stolarstwo / Rękodzieło', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 7h16a1 1 0 010 2H4a1 1 0 010-2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 9v10M18 9v10M4 19h16"/>' },
  { key: 'x_wyszywanie', label: 'Wyszywanie / Hafciarstwo', paths: '<circle cx="12" cy="12" r="4" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2v4M12 18v4M2 12h4M18 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>' },
  // ── Music & Performance ──
  { key: 'x_spiew', label: 'Śpiew / Vocal', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 10v1a7 7 0 01-14 0v-1"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 18v4M8 22h8"/>' },
  { key: 'x_chor', label: 'Chór / Śpiew grupowy', paths: '<circle cx="6" cy="6" r="2" strokeWidth="1.8"/><circle cx="12" cy="6" r="2" strokeWidth="1.8"/><circle cx="18" cy="6" r="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16V9a2 2 0 012-2M10 16V9a2 2 0 012-2M16 16V9a2 2 0 012-2M3 16h18"/>' },
  { key: 'x_gitara', label: 'Gitara / Muzyka', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 18V5l12-3v13"/><circle cx="6" cy="18" r="3" strokeWidth="1.8"/><circle cx="18" cy="15" r="3" strokeWidth="1.8"/>' },
  { key: 'x_fortepian', label: 'Fortepian / Instrument klawiszowy', paths: '<rect x="2" y="8" width="20" height="12" rx="2" strokeWidth="1.8"/><rect x="4" y="8" width="3" height="7" rx="0.5" fill="currentColor" stroke="none"/><rect x="9" y="8" width="3" height="7" rx="0.5" fill="currentColor" stroke="none"/><rect x="15" y="8" width="3" height="7" rx="0.5" fill="currentColor" stroke="none"/>' },
  { key: 'x_perkusja', label: 'Perkusja', paths: '<ellipse cx="12" cy="12" rx="8" ry="4" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 12v4c0 2 3.6 4 8 4s8-2 8-4v-4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 6l-2-3M16 6l2-3"/>' },
  { key: 'x_karaoke', label: 'Karaoke', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 9v2a5 5 0 0010 0V9"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 16v3M8 21h8M19 5l2-2M19 9l2 2"/>' },
  { key: 'x_improwizacja', label: 'Teatr improwizowany', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 9h8M8 13h5"/><rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="1.8"/><circle cx="17" cy="13" r="2" strokeWidth="1.8"/>' },
  // ── Social & Entertainment ──
  { key: 'x_escape_room', label: 'Escape Room', paths: '<rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9V7M12 15v2M9 12H7M17 12h-2"/>' },
  { key: 'x_vr', label: 'Wirtualna rzeczywistość (VR)', paths: '<rect x="2" y="8" width="20" height="10" rx="4" strokeWidth="1.8"/><circle cx="8" cy="13" r="2.5" strokeWidth="1.8"/><circle cx="16" cy="13" r="2.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.5 13h3"/>' },
  { key: 'x_kino_domowe', label: 'Kino domowe / Seans', paths: '<rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="1.8"/><path d="M9 9l6 3-6 3V9z" fill="currentColor" stroke="none"/>' },
  { key: 'x_muzeum', label: 'Muzeum / Galeria', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 21h18M3 9h18M6 9V21M18 9v12M12 9v12M3 9l9-6 9 6"/>' },
  { key: 'x_speed_dating', label: 'Speed Dating', paths: '<circle cx="8" cy="9" r="3" strokeWidth="1.8"/><circle cx="16" cy="9" r="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 19a3 3 0 016 0M13 19a3 3 0 016 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v3"/>' },
  { key: 'x_networking', label: 'Networking / Spotkania', paths: '<circle cx="12" cy="4" r="2" strokeWidth="1.8"/><circle cx="4" cy="17" r="2" strokeWidth="1.8"/><circle cx="20" cy="17" r="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6l-6 9M12 6l6 9M6 17h12"/>' },
  { key: 'x_book_club', label: 'Klub Książki', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 19.5V4.5A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7h8M8 11h6"/>' },
  { key: 'x_debata', label: 'Debata / Dyskusja', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/>' },
  { key: 'x_szachy', label: 'Szachy / Gry strategiczne', paths: '<rect x="8" y="2" width="8" height="6" rx="1" strokeWidth="1.8"/><rect x="5" y="8" width="14" height="4" rx="1" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 12v8M17 12v8M4 20h16"/>' },
  { key: 'x_gry_karciane', label: 'Gry karciane', paths: '<rect x="3" y="4" width="11" height="15" rx="1.5" strokeWidth="1.8" transform="rotate(-10 3 4)"/><rect x="10" y="4" width="11" height="15" rx="1.5" strokeWidth="1.8" transform="rotate(10 10 4)"/>' },
  { key: 'x_gry_wideo', label: 'Gry wideo / e-sport', paths: '<rect x="2" y="6" width="20" height="12" rx="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 12h4M8 10v4"/><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="11" r="1" fill="currentColor" stroke="none"/>' },
  { key: 'x_larp', label: 'LARP / Odgrywanie ról', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 4l-4 16M17 4l4 16M5 10h14M5 7h5l2-3 2 3h5"/>' },
  { key: 'x_petanque', label: 'Pétanque / Bule', paths: '<circle cx="7" cy="17" r="3" strokeWidth="1.8"/><circle cx="14" cy="15" r="3" strokeWidth="1.8"/><circle cx="10" cy="11" r="3" strokeWidth="1.8"/><circle cx="19" cy="9" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 21h17"/>' },
  // ── Adventure & Extreme ──
  { key: 'x_parkour', label: 'Parkour', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 18l5-5 4 3 5-8 5 4"/><circle cx="14" cy="5" r="1.5" strokeWidth="1.8"/>' },
  { key: 'x_paragliding', label: 'Paralotniarstwo', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 11a9 9 0 0118 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 11l9 7 9-7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 18v3"/>' },
  { key: 'x_via_ferrata', label: 'Via Ferrata / Wspinaczka', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 20L15 4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l6-2M7 16h4"/><circle cx="16" cy="5" r="2" strokeWidth="1.8"/>' },
  { key: 'x_zipline', label: 'Tyrolka / Zipline', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 6l18 12"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 10a2 2 0 004 0l-2-5z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 12l-3 6"/>' },
  { key: 'x_speleologia', label: 'Speleologia / Jaskinie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 20C3 10 7 3 12 3s9 7 9 17H3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 20v-5l3-4 3 4v5"/>' },
  { key: 'x_deskorolka', label: 'Deskorolka / Skateboard', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16h16"/><ellipse cx="8" cy="17.5" rx="2" ry="1.5" strokeWidth="1.8"/><ellipse cx="16" cy="17.5" rx="2" ry="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 12l5-8 5 8"/>' },
  { key: 'x_rolki', label: 'Rolki / Rollerblady', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 20h10M8 20v-6l3-5h2l3 5v6"/><circle cx="9.5" cy="21.5" r="1.5" strokeWidth="1.8"/><circle cx="14.5" cy="21.5" r="1.5" strokeWidth="1.8"/>' },
  // ── Community & Food ──
  { key: 'x_sadzenie_drzew', label: 'Sadzenie drzew / Ekologia', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 22v-8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 14c0-4 3-7 7-7s7 3 7 7c-2 0-5-1-7-1s-5 1-7 1z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 10l5-5 5 5"/>' },
  { key: 'x_sprzatanie', label: 'Sprzątanie terenu / Wolontariat', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20l4-12h8l4 12M4 20h16"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 14h6M10 8l2-5 2 5"/>' },
  { key: 'x_gotowanie_wspolne', label: 'Wspólne gotowanie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 11h18v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 11V5M15 11V5M12 11V7"/>' },
  { key: 'x_pieczenie', label: 'Pieczenie / Ciasteczka', paths: '<ellipse cx="12" cy="17" rx="8" ry="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 17V9h16v8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 9l8-5 8 5"/>' },
  { key: 'x_degustacja_wina', label: 'Degustacja wina', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 3h8l2 9a6 6 0 01-12 0L8 3z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 18v3M9 21h6"/>' },
  { key: 'x_kawiarnia', label: 'Spotkanie przy kawie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 8h11v5a5 5 0 01-5 5H11a5 5 0 01-5-5V8z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 9h2a2 2 0 010 4h-2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 21h16"/>' },
  { key: 'x_herbata', label: 'Ceremonia herbaty', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 8h12v5a6 6 0 01-12 0V8z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 9h2a2 2 0 010 4h-2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 20h14"/>' },
  { key: 'x_grillowanie', label: 'Grillowanie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8h18M6 8l3 12M18 8l-3 12M12 8v12"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 3l2 3M12 3v3M17 3l-2 3"/>' },
  { key: 'x_koktajle', label: 'Warsztaty koktajlowe / Mixologia', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 3h8l-4 9-4-9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 12v7M9 19h6"/>' },
  // ── Learning & Development ──
  { key: 'x_szkolenie', label: 'Szkolenie / Kurs', paths: '<rect x="3" y="4" width="18" height="14" rx="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 9h10M7 13h6"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 20l4-2 4 2"/>' },
  { key: 'x_coaching', label: 'Coaching / Mentoring', paths: '<circle cx="12" cy="7" r="4" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 11v4M9 22l3-7 3 7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 6l3-2M17 9l3 1"/>' },
  { key: 'x_programowanie', label: 'Programowanie / Tech', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 9l-4 3 4 3M16 9l4 3-4 3M14 6l-4 12"/>' },
  { key: 'x_nauka_jezykow', label: 'Nauka języków', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 5h7M9 3v2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M11 11c0-2-1-5-5-5a5 5 0 000 10c2 0 4-1 5-3"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 8l8 8M16 8h5v5"/>' },
  { key: 'x_public_speaking', label: 'Wystąpienia publiczne', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3a9 9 0 000 18H3l4-4"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 10h8M8 14h5"/>' },
  { key: 'x_pierwsza_pomoc', label: 'Pierwsza pomoc / CPR', paths: '<rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v8M8 12h8"/>' },
  { key: 'x_gotowanie_zdrowe', label: 'Zdrowe gotowanie / Dieta', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3c-4 3-5 7-5 9a5 5 0 0010 0c0-2-1-6-5-9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 12v9M9 17l3-2 3 2"/>' },
  // ── Special & Spiritual ──
  { key: 'x_retret', label: 'Retret / Odosobnienie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>' },
  { key: 'x_ceremonia', label: 'Ceremonia / Rytuał', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4" strokeWidth="1.8"/>' },
  { key: 'x_zumba', label: 'Zumba / Taniec latynoamerykański', paths: '<circle cx="9" cy="4" r="1.5" strokeWidth="1.8"/><circle cx="15" cy="5" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 6l-2 7 4 3 3-3-2-7M15 7l2 5-2 4M6 20l5-4 5 4"/>' },
  { key: 'x_pilka_reczna', label: 'Piłka ręczna', paths: '<circle cx="12" cy="12" r="9" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 7l3 5-3 5M12 12h4"/>' },
  { key: 'x_rugby', label: 'Rugby / Futbol', paths: '<ellipse cx="12" cy="12" rx="9" ry="6" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6v12M6 9l12 6M6 15l12-6"/>' },
  { key: 'x_baseball', label: 'Baseball', paths: '<circle cx="12" cy="12" r="9" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5c2 3 2 8 0 14M15 5c-2 3-2 8 0 14"/>' },
  { key: 'x_pilka_wodna', label: 'Piłka wodna', paths: '<circle cx="12" cy="9" r="5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 21c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>' },
  { key: 'x_akrobatyka', label: 'Akrobatyka / Gimnastyka', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 6l4 4-4 3-4-3 4-4z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 13l-3 7M16 13l3 7M9 20h6"/>' },
  { key: 'x_longboard', label: 'Longboard', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 15h18"/><ellipse cx="7" cy="16.5" rx="2" ry="1.5" strokeWidth="1.8"/><ellipse cx="17" cy="16.5" rx="2" ry="1.5" strokeWidth="1.8"/><circle cx="12" cy="9" r="3" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 9l-4 6M15 9l4 6"/>' },
  { key: 'x_hulajnoga', label: 'Hulajnoga / Scooter', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 19h14M12 5v14M8 5h8"/><circle cx="7" cy="20" r="2" strokeWidth="1.8"/><circle cx="17" cy="20" r="2" strokeWidth="1.8"/>' },
  { key: 'x_tenis_stolowy', label: 'Tenis stołowy', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 3h18v2H3zM3 5l9 12L3 5zM21 5l-9 12 9-12z"/><circle cx="18" cy="17" r="2.5" strokeWidth="1.8"/>' },
  { key: 'x_pilates_na_wode', label: 'Aqua Fitness / Pilates w wodzie', paths: '<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2 21c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><circle cx="12" cy="9" r="4" strokeWidth="1.8"/>' },
  { key: 'x_cheerleading', label: 'Cheerleading / Pom-pom', paths: '<circle cx="12" cy="4" r="1.5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M6 6l4 4M18 6l-4 4M12 8v7M9 20l3-5 3 5M4 14l4-2M20 14l-4-2"/>' },
  { key: 'x_pilka_nozna_salowa', label: 'Futsal / Piłka nożna halowa', paths: '<rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8"/><circle cx="12" cy="12" r="5" strokeWidth="1.8"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 7v10M7 12h10"/>' },
]

/** Map from extra icon key → definition for fast lookup */
export const EXTRA_ICON_MAP = Object.fromEntries(
  EXTRA_ICONS.map((icon) => [icon.key, icon])
)
