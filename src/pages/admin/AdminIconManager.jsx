import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { useCustomEventTypes } from '../../hooks/useCustomEventTypes'
import { BUILT_IN_EVENT_ICONS, ICON_MAP } from '../../constants/eventIcons'
import AuthGateCard from '../../components/ui/AuthGateCard'

const EMOJI_SUGGESTIONS = ['🏃', '⚽', '🏐', '🏀', '🎾', '🏊', '🚵', '🧗', '🤸', '🥋', '🎭', '🎸', '🎨', '🍳', '☕', '🌿', '🏕', '🎯', '🎲', '🧘', '💃', '🥊', '🏋️', '⛷️', '🚣', '🤼', '🏇', '🤾', '🎿', '🧩']

function IconPreviewSvg({ iconKey, className = '' }) {
  const icon = ICON_MAP[iconKey]
  if (!icon) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={`h-6 w-6 ${icon.color} ${className}`}
      dangerouslySetInnerHTML={{ __html: icon.paths }}
    />
  )
}

function AdminIconManager() {
  const { user, isAuthenticated, login } = useAuth()
  const { t } = useLanguage()
  const { showSuccess, showError } = useNotification()
  const { customTypes, addCustomType, removeCustomType, DEFAULT_COLORS } = useCustomEventTypes()

  const [form, setForm] = useState({ key: '', label: '', emoji: '', color: DEFAULT_COLORS[0] })
  const [formError, setFormError] = useState('')

  const isAdmin = user?.role === 'admin'

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title="Zarządzanie ikonami"
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/icons' })}
      />
    )
  }

  if (!isAdmin) {
    return (
      <AuthGateCard
        title="Zarządzanie ikonami"
        message={t('admin.notAuthorized')}
        actionLabel={t('admin.backToDashboard')}
        actionTo="/admin"
      />
    )
  }

  const handleAdd = (e) => {
    e.preventDefault()
    setFormError('')
    const result = addCustomType(form)
    if (result?.error) {
      setFormError(result.error)
      return
    }
    showSuccess('Nowy typ aktywności dodany.')
    setForm({ key: '', label: '', emoji: '', color: DEFAULT_COLORS[0] })
  }

  const handleRemove = (key, label) => {
    if (!window.confirm(`Usunąć typ „${label}"? Nie wpłynie to na istniejące wydarzenia.`)) return
    removeCustomType(key)
    showSuccess('Typ usunięty.')
  }

  return (
    <div className="page-shell">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70">
        <span>←</span> {t('admin.backToDashboard')}
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">Ikony aktywności</h1>
        <p className="mt-1 text-navy/60 dark:text-cream/60 text-sm">
          Przeglądaj wbudowane ikony i dodawaj własne typy aktywności dla nowych wydarzeń.
        </p>
      </div>

      {/* ── Built-in icons ── */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-navy dark:text-cream mb-4">
          Wbudowane ikony ({BUILT_IN_EVENT_ICONS.length})
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {BUILT_IN_EVENT_ICONS.map((icon) => (
            <div
              key={icon.key}
              className="flex flex-col items-center gap-2 rounded-2xl border border-navy/10 dark:border-cream/10 bg-navy/5 dark:bg-cream/5 p-3 text-center"
            >
              <span className={icon.color}>
                <IconPreviewSvg iconKey={icon.key} />
              </span>
              <span className="text-[10px] font-medium text-navy/70 dark:text-cream/70 leading-tight break-words w-full">
                {icon.label}
              </span>
              <code className="text-[8px] text-navy/30 dark:text-cream/30 break-all">{icon.key}</code>
            </div>
          ))}
        </div>
      </section>

      {/* ── Custom icons ── */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-navy dark:text-cream mb-1">
          Twoje ikony ({customTypes.length})
        </h2>
        <p className="text-xs text-navy/50 dark:text-cream/50 mb-4">
          Własne typy zapisywane lokalnie w przeglądarce. Emoji wyświetla się zamiast ikony SVG.
        </p>

        {customTypes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy/20 dark:border-cream/20 p-6 text-center text-sm text-navy/50 dark:text-cream/50">
            Brak własnych ikon. Dodaj pierwszą poniżej.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {customTypes.map((ct) => (
              <div
                key={ct.key}
                className="relative flex flex-col items-center gap-2 rounded-2xl border border-navy/10 dark:border-cream/10 bg-navy/5 dark:bg-cream/5 p-3 text-center group"
              >
                <span className="text-2xl leading-none">{ct.emoji}</span>
                <span className="text-[10px] font-medium text-navy/70 dark:text-cream/70 leading-tight break-words w-full">
                  {ct.label}
                </span>
                <code className="text-[8px] text-navy/30 dark:text-cream/30 break-all">{ct.key}</code>
                <button
                  type="button"
                  onClick={() => handleRemove(ct.key, ct.label)}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow"
                  aria-label={`Usuń ${ct.label}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Add new custom type ── */}
      <section>
        <h2 className="text-base font-bold text-navy dark:text-cream mb-4">Dodaj nowy typ aktywności</h2>
        <form onSubmit={handleAdd} className="page-card space-y-4 max-w-lg">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-navy dark:text-cream">
              Nazwa wyświetlana
              <input
                type="text"
                className="ui-input"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="np. Piłka ręczna"
                required
                maxLength={40}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-navy dark:text-cream">
              Klucz (ID)
              <input
                type="text"
                className="ui-input"
                value={form.key}
                onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                placeholder="np. pilka_reczna"
                required
                maxLength={30}
                pattern="[a-zA-Z0-9_ ]+"
              />
              <p className="text-[10px] text-navy/40 dark:text-cream/40">Małe litery, bez polskich znaków. Spacje → _</p>
            </label>
          </div>

          {/* Emoji picker */}
          <div className="flex flex-col gap-1.5 text-sm text-navy dark:text-cream">
            <span>Emoji (ikona)</span>
            <div className="flex flex-wrap gap-2">
              {EMOJI_SUGGESTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, emoji: em }))}
                  className={`text-xl p-1.5 rounded-lg border-2 transition-all ${form.emoji === em ? 'border-navy dark:border-cream bg-navy/10' : 'border-transparent hover:bg-navy/10 dark:hover:bg-cream/10'}`}
                >
                  {em}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="ui-input mt-1 w-20 text-center text-xl"
              value={form.emoji}
              onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))}
              placeholder="🏆"
              required
              maxLength={4}
            />
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-1.5 text-sm text-navy dark:text-cream">
            <span>Kolor</span>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: col }))}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${form.color === col ? 'border-navy dark:border-cream scale-110' : 'border-transparent'}`}
                >
                  <span className={`block h-5 w-5 rounded-full mx-auto ${col.replace('text-', 'bg-')}`} />
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}

          <button
            type="submit"
            className="btn-primary px-6 py-2.5 rounded-full font-semibold"
          >
            Dodaj typ aktywności
          </button>
        </form>
      </section>
    </div>
  )
}

export default AdminIconManager
