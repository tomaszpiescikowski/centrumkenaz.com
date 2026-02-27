/**
 * Built-in event type icon definitions.
 * Each entry has: key, label (Polish), color (Tailwind text class), and emoji.
 *
 * Custom icons (added by admin) are stored in the database via the /event-types API
 * and fetched via the useCustomEventTypes hook. Custom icons reference an entry from
 * EXTRA_ICONS by key (icon_key field).
 */

export const BUILT_IN_EVENT_ICONS = [
  { key: 'mors',       label: 'Morsowanie', color: 'text-blue-400',   emoji: '🏊' },
  { key: 'karate',     label: 'Karate',     color: 'text-cyan-500',   emoji: '🥋' },
  { key: 'spacer',     label: 'Spacer',     color: 'text-green-500',  emoji: '🚶' },
  { key: 'joga',       label: 'Joga',       color: 'text-pink-500',   emoji: '🧘' },
  { key: 'wyjazd',     label: 'Wyjazd',     color: 'text-amber-500',  emoji: '✈️' },
  { key: 'bieganie',   label: 'Bieganie',   color: 'text-lime-500',   emoji: '🏃' },
  { key: 'planszowki', label: 'Planszówki', color: 'text-violet-500', emoji: '🎲' },
  { key: 'ognisko',    label: 'Ognisko',    color: 'text-orange-500', emoji: '🔥' },
  { key: 'medytacja',  label: 'Medytacja',  color: 'text-indigo-400', emoji: '🪷' },
  { key: 'kajak',      label: 'Kajaki',     color: 'text-cyan-400',   emoji: '🛶' },
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
 * Extra emoji icon pool for custom event types (128 icons).
 * Each entry: { key, label, emoji }.
 * The `key` here is used as iconKey in custom type definitions.
 * Unlike BUILT_IN_EVENT_ICONS, these don't have a fixed color — the color
 * is chosen separately when creating the custom type.
 */
export const EXTRA_ICONS = [
  // ── Fitness & Exercise ──
  { key: 'x_skakanki',          label: 'Skakanka',                            emoji: '🤸' },
  { key: 'x_pilates',           label: 'Pilates',                             emoji: '🤸‍♀️' },
  { key: 'x_tai_chi',           label: 'Tai Chi',                             emoji: '🌿' },
  { key: 'x_crossfit',          label: 'CrossFit',                            emoji: '💪' },
  { key: 'x_kettlebell',        label: 'Kettlebell',                          emoji: '🏋️' },
  { key: 'x_qigong',            label: 'Qigong',                              emoji: '🤲' },
  { key: 'x_aerobik',           label: 'Aerobik',                             emoji: '💃' },
  { key: 'x_trx',               label: 'TRX',                                 emoji: '💪' },
  { key: 'x_calisthenics',      label: 'Kalistenika',                         emoji: '🤸' },
  { key: 'x_hula_hoop',         label: 'Hula-hoop',                           emoji: '🤸' },
  // ── Outdoor Fitness ──
  { key: 'x_nordic_walking',    label: 'Nordic Walking',                      emoji: '🚶' },
  { key: 'x_trekking',          label: 'Trekking / Turystyka',                emoji: '🥾' },
  { key: 'x_orienteering',      label: 'Orientering',                         emoji: '🧭' },
  { key: 'x_survival',          label: 'Survival',                            emoji: '🏕️' },
  { key: 'x_oboz',              label: 'Obóz / Kemping',                      emoji: '⛺' },
  // ── Water Sports ──
  { key: 'x_surfing',           label: 'Surfing',                             emoji: '🏄' },
  { key: 'x_windsurfing',       label: 'Windsurfing',                         emoji: '🌊' },
  { key: 'x_nurkowanie',        label: 'Nurkowanie',                          emoji: '🤿' },
  { key: 'x_snorkeling',        label: 'Snorkeling',                          emoji: '🤿' },
  { key: 'x_paddleboard',       label: 'Paddleboard (SUP)',                   emoji: '🏄' },
  { key: 'x_zeglowanie',        label: 'Żeglarstwo',                          emoji: '⛵' },
  { key: 'x_wioslarstwo',       label: 'Wiosłowanie',                         emoji: '🚣' },
  { key: 'x_wakeboard',         label: 'Wakeboard',                           emoji: '🏄' },
  { key: 'x_kajak_gorski',      label: 'Kajak górski',                        emoji: '🛶' },
  // ── Winter Sports ──
  { key: 'x_lyzwy',             label: 'Łyżwiarstwo',                         emoji: '⛸️' },
  { key: 'x_hokej',             label: 'Hokej na lodzie',                     emoji: '🏒' },
  { key: 'x_sanki',             label: 'Sanki / Zjazd',                       emoji: '🛷' },
  { key: 'x_narciarstwo_biegowe', label: 'Narciarstwo biegowe',               emoji: '⛷️' },
  // ── Racket & Precision ──
  { key: 'x_badminton',         label: 'Badminton',                           emoji: '🏸' },
  { key: 'x_pingpong',          label: 'Ping-pong',                           emoji: '🏓' },
  { key: 'x_padel',             label: 'Padel',                               emoji: '🎾' },
  { key: 'x_szermierka',        label: 'Szermierka',                          emoji: '🤺' },
  { key: 'x_golf',              label: 'Golf',                                emoji: '⛳' },
  { key: 'x_kregle',            label: 'Kręgle',                              emoji: '🎳' },
  { key: 'x_lucznictwo',        label: 'Łucznictwo',                          emoji: '🏹' },
  { key: 'x_strzelectwo',       label: 'Strzelectwo / Paintball',             emoji: '🎯' },
  { key: 'x_frisbee',           label: 'Frisbee',                             emoji: '🥏' },
  { key: 'x_darts',             label: 'Darts',                               emoji: '🎯' },
  // ── Martial Arts ──
  { key: 'x_judo',              label: 'Judo / Jiu-jitsu',                    emoji: '🥋' },
  { key: 'x_aikido',            label: 'Aikido',                              emoji: '🥋' },
  { key: 'x_zapasy',            label: 'Zapasy / Wrestling',                  emoji: '🤼' },
  { key: 'x_muay_thai',         label: 'Muay Thai / Kickboxing',              emoji: '🥊' },
  // ── Nature & Outdoor ──
  { key: 'x_ogrodnictwo',       label: 'Ogrodnictwo',                         emoji: '🌱' },
  { key: 'x_grzybobranie',      label: 'Grzybobranie / Foraging',             emoji: '🍄' },
  { key: 'x_birdwatching',      label: 'Obserwacja ptaków',                   emoji: '🦅' },
  { key: 'x_astronomia',        label: 'Astronomia / Obserwacja nieba',       emoji: '🔭' },
  { key: 'x_geocaching',        label: 'Geocaching',                          emoji: '🗺️' },
  { key: 'x_latawiec',          label: 'Latawiec',                            emoji: '🪁' },
  { key: 'x_piknik',            label: 'Piknik',                              emoji: '🧺' },
  { key: 'x_psi_spacer',        label: 'Spacer z psem',                       emoji: '🐕' },
  { key: 'x_jazda_konna',       label: 'Jazda konna',                         emoji: '🐎' },
  { key: 'x_hammock',           label: 'Hamak / Relaks w naturze',            emoji: '🌿' },
  // ── Wellness ──
  { key: 'x_sauna',             label: 'Sauna',                               emoji: '🧖' },
  { key: 'x_masaz',             label: 'Masaż',                               emoji: '💆' },
  { key: 'x_oddech',            label: 'Ćwiczenia oddechowe',                 emoji: '🫁' },
  { key: 'x_spa',               label: 'SPA',                                 emoji: '🛁' },
  { key: 'x_kapiel_zimna',      label: 'Zimna kąpiel / Cold plunge',          emoji: '🧊' },
  { key: 'x_nidra',             label: 'Yoga Nidra / Relaks',                 emoji: '😴' },
  { key: 'x_journal',           label: 'Journaling / Dziennik',               emoji: '📖' },
  { key: 'x_dzwiekoterapia',    label: 'Dźwiękoterapia',                      emoji: '🎵' },
  { key: 'x_kapiel_lesna',      label: 'Kąpiel leśna (Shinrin-yoku)',         emoji: '🌲' },
  { key: 'x_mindfulness',       label: 'Mindfulness / Uważność',              emoji: '🧠' },
  // ── Creative & Artistic ──
  { key: 'x_rysowanie',         label: 'Rysowanie',                           emoji: '✏️' },
  { key: 'x_malarstwo',         label: 'Malarstwo',                           emoji: '🎨' },
  { key: 'x_ceramika',          label: 'Ceramika / Garncarstwo',              emoji: '🏺' },
  { key: 'x_rzezba',            label: 'Rzeźba',                              emoji: '🗿' },
  { key: 'x_fotografia',        label: 'Fotografia',                          emoji: '📷' },
  { key: 'x_pisanie',           label: 'Pisanie kreatywne',                   emoji: '✍️' },
  { key: 'x_dziewiarstwo',      label: 'Dziewiarstwo / Szydełkowanie',        emoji: '🧶' },
  { key: 'x_origami',           label: 'Origami',                             emoji: '🦢' },
  { key: 'x_kaligrafia',        label: 'Kaligrafia',                          emoji: '🖊️' },
  { key: 'x_bizuteria',         label: 'Biżuteria artystyczna',               emoji: '💎' },
  { key: 'x_stolarstwo',        label: 'Stolarstwo / Rękodzieło',             emoji: '🔨' },
  { key: 'x_wyszywanie',        label: 'Wyszywanie / Hafciarstwo',            emoji: '🪡' },
  // ── Music & Performance ──
  { key: 'x_spiew',             label: 'Śpiew / Vocal',                       emoji: '🎤' },
  { key: 'x_chor',              label: 'Chór / Śpiew grupowy',                emoji: '🎼' },
  { key: 'x_gitara',            label: 'Gitara / Muzyka',                     emoji: '🎸' },
  { key: 'x_fortepian',         label: 'Fortepian / Instrument klawiszowy',   emoji: '🎹' },
  { key: 'x_perkusja',          label: 'Perkusja',                            emoji: '🥁' },
  { key: 'x_karaoke',           label: 'Karaoke',                             emoji: '🎤' },
  { key: 'x_improwizacja',      label: 'Teatr improwizowany',                 emoji: '🎭' },
  // ── Social & Entertainment ──
  { key: 'x_escape_room',       label: 'Escape Room',                         emoji: '🔐' },
  { key: 'x_vr',                label: 'Wirtualna rzeczywistość (VR)',         emoji: '🥽' },
  { key: 'x_kino_domowe',       label: 'Kino domowe / Seans',                 emoji: '🎬' },
  { key: 'x_muzeum',            label: 'Muzeum / Galeria',                    emoji: '🏛️' },
  { key: 'x_speed_dating',      label: 'Speed Dating',                        emoji: '💘' },
  { key: 'x_networking',        label: 'Networking / Spotkania',              emoji: '🤝' },
  { key: 'x_book_club',         label: 'Klub Książki',                        emoji: '📚' },
  { key: 'x_debata',            label: 'Debata / Dyskusja',                   emoji: '💬' },
  { key: 'x_szachy',            label: 'Szachy / Gry strategiczne',           emoji: '♟️' },
  { key: 'x_gry_karciane',      label: 'Gry karciane',                        emoji: '🃏' },
  { key: 'x_gry_wideo',         label: 'Gry wideo / e-sport',                 emoji: '🎮' },
  { key: 'x_larp',              label: 'LARP / Odgrywanie ról',               emoji: '⚔️' },
  { key: 'x_petanque',          label: 'Pétanque / Bule',                     emoji: '🎯' },
  // ── Adventure & Extreme ──
  { key: 'x_parkour',           label: 'Parkour',                             emoji: '🏃' },
  { key: 'x_paragliding',       label: 'Paralotniarstwo',                     emoji: '🪂' },
  { key: 'x_via_ferrata',       label: 'Via Ferrata / Wspinaczka',            emoji: '🧗' },
  { key: 'x_zipline',           label: 'Tyrolka / Zipline',                   emoji: '🪂' },
  { key: 'x_speleologia',       label: 'Speleologia / Jaskinie',              emoji: '🦇' },
  { key: 'x_deskorolka',        label: 'Deskorolka / Skateboard',             emoji: '🛹' },
  { key: 'x_rolki',             label: 'Rolki / Rollerblady',                 emoji: '🛼' },
  // ── Community & Food ──
  { key: 'x_sadzenie_drzew',    label: 'Sadzenie drzew / Ekologia',           emoji: '🌳' },
  { key: 'x_sprzatanie',        label: 'Sprzątanie terenu / Wolontariat',     emoji: '🧹' },
  { key: 'x_gotowanie_wspolne', label: 'Wspólne gotowanie',                   emoji: '🍳' },
  { key: 'x_pieczenie',         label: 'Pieczenie / Ciasteczka',              emoji: '🧁' },
  { key: 'x_degustacja_wina',   label: 'Degustacja wina',                     emoji: '🍷' },
  { key: 'x_kawiarnia',         label: 'Spotkanie przy kawie',                emoji: '☕' },
  { key: 'x_herbata',           label: 'Ceremonia herbaty',                   emoji: '🍵' },
  { key: 'x_grillowanie',       label: 'Grillowanie',                         emoji: '🍖' },
  { key: 'x_koktajle',          label: 'Warsztaty koktajlowe / Mixologia',    emoji: '🍹' },
  // ── Learning & Development ──
  { key: 'x_szkolenie',         label: 'Szkolenie / Kurs',                    emoji: '📋' },
  { key: 'x_coaching',          label: 'Coaching / Mentoring',                emoji: '🎯' },
  { key: 'x_programowanie',     label: 'Programowanie / Tech',                emoji: '💻' },
  { key: 'x_nauka_jezykow',     label: 'Nauka języków',                       emoji: '🌍' },
  { key: 'x_public_speaking',   label: 'Wystąpienia publiczne',               emoji: '🎙️' },
  { key: 'x_pierwsza_pomoc',    label: 'Pierwsza pomoc / CPR',                emoji: '🩺' },
  { key: 'x_gotowanie_zdrowe',  label: 'Zdrowe gotowanie / Dieta',            emoji: '🥗' },
  // ── Special & Spiritual ──
  { key: 'x_retret',            label: 'Retret / Odosobnienie',               emoji: '🏔️' },
  { key: 'x_ceremonia',         label: 'Ceremonia / Rytuał',                  emoji: '🕯️' },
  { key: 'x_zumba',             label: 'Zumba / Taniec latynoamerykański',    emoji: '💃' },
  { key: 'x_pilka_reczna',      label: 'Piłka ręczna',                        emoji: '🤾' },
  { key: 'x_rugby',             label: 'Rugby / Futbol',                      emoji: '🏉' },
  { key: 'x_baseball',          label: 'Baseball',                            emoji: '⚾' },
  { key: 'x_pilka_wodna',       label: 'Piłka wodna',                         emoji: '🏊' },
  { key: 'x_akrobatyka',        label: 'Akrobatyka / Gimnastyka',             emoji: '🤸' },
  { key: 'x_longboard',         label: 'Longboard',                           emoji: '🛹' },
  { key: 'x_hulajnoga',         label: 'Hulajnoga / Scooter',                 emoji: '🛴' },
  { key: 'x_tenis_stolowy',     label: 'Tenis stołowy',                       emoji: '🏓' },
  { key: 'x_pilates_na_wode',   label: 'Aqua Fitness / Pilates w wodzie',     emoji: '🏊' },
  { key: 'x_cheerleading',      label: 'Cheerleading / Pom-pom',              emoji: '📣' },
  { key: 'x_pilka_nozna_salowa', label: 'Futsal / Piłka nożna halowa',        emoji: '⚽' },
]

/** Map from extra icon key → definition for fast lookup */
export const EXTRA_ICON_MAP = Object.fromEntries(
  EXTRA_ICONS.map((icon) => [icon.key, icon])
)
