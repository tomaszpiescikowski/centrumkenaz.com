import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import { useCustomEventTypes } from '../../hooks/useCustomEventTypes'
import { BUILT_IN_EVENT_ICONS, ICON_MAP, EXTRA_ICONS, EXTRA_ICON_MAP } from '../../constants/eventIcons'
import AuthGateCard from '../../components/ui/AuthGateCard'

function IconPreviewSvg({ iconKey, color = '', paths = '', className = '' }) {
  const resolvedPaths = paths || ICON_MAP[iconKey]?.paths || EXTRA_ICON_MAP[iconKey]?.paths || ''
  const resolvedColor = color || ICON_MAP[iconKey]?.color || ''
  if (!resolvedPaths) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={`h-6 w-6 ${resolvedColor} ${className}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: resolvedPaths }}
    />
  )
}

/** Searchable grid for picking one of the 128 EXTRA_ICONS */
function ExtraIconPicker({ value, onChange }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return EXTRA_ICONS
    return EXTRA_ICONS.filter(
      (i) => i.label.toLowerCase().includes(q) || i.key.includes(q)
    )
  }, [search])

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Szukaj ikony..."
        className="ui-input text-sm"
      />
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-1">
        {filtered.map((icon) => {
          const isSelected = value === icon.key
          return (
            <button
              key={icon.key}
              type="button"
              title={icon.label}
              onClick={() => onChange(icon.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all
                ${isSelected
                  ? 'border-navy bg-navy/10 dark:border-cream dark:bg-cream/10'
                  : 'border-transparent hover:border-navy/30 dark:hover:border-cream/30 hover:bg-navy/5 dark:hover:bg-cream/5'
                }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="h-6 w-6"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: icon.paths }}
              />
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-navy/50 dark:text-cream/50 py-4 text-center">Brak wyników</p>
        )}
      </div>
    </div>
  )
}

function AdminIconManager() {
  const { user, isAuthenticated, login, authFetch } = useAuth()
  const { t } = useLanguage()
  const { showSuccess, showError, showConfirm } = useNotification()
  const { customTypes, loading, addCustomType, removeCustomType, DEFAULT_COLORS } = useCustomEventTypes({ authFetch })

  const [form, setForm] = useState({ label: '', iconKey: '', color: DEFAULT_COLORS[0] })
  const [formError, setFormError] = useState('')
  const [adding, setAdding] = useState(false)

  const isAdmin = user?.role === 'admin'

  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title="Zarządzanie kategoriami"
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/icons' })}
      />
    )
  }

  if (!isAdmin) {
    return (
      <AuthGateCard
        title="Zarządzanie kategoriami"
        message={t('admin.notAuthorized')}
        actionLabel={t('admin.backToDashboard')}
        actionTo="/admin"
      />
    )
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setFormError('')
    setAdding(true)
    try {
      const result = await addCustomType({ label: form.label, iconKey: form.iconKey, color: form.color })
      if (result?.error) {
        setFormError(result.error)
        return
      }
      showSuccess('Nowa kategoria dodana.')
      setForm({ label: '', iconKey: '', color: DEFAULT_COLORS[0] })
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = (key, label) => {
    showConfirm(`Usunąć typ „${label}"? Istniejące wydarzenia zmienią typ na „inne".`, {
      actions: [
        { label: t('common.close'), variant: 'neutral' },
        {
          label: 'Usuń',
          variant: 'danger',
          onClick: async () => {
            try {
              await removeCustomType(key)
              showSuccess('Typ usunięty.')
            } catch (err) {
              showError(err.message || 'Nie udało się usunąć typu.')
            }
          },
        },
      ],
    })
  }

  // Preview auto-generated key based on current label
  const previewKey = form.label
    .trim().toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').replace(/^_+|_+$/g,'')

  return (
    <div className="page-shell">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-navy/70 dark:text-cream/70">
        <span>←</span> {t('admin.backToDashboard')}
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">Kategorie wydarzeń</h1>
        <p className="mt-1 text-navy/60 dark:text-cream/60 text-sm">
          Przeglądaj wbudowane kategorie i zarządzaj własnymi kategoriami wydarzeń.
        </p>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-navy/15 dark:border-cream/15 bg-navy/5 dark:bg-cream/5 px-4 py-3 text-sm text-navy/70 dark:text-cream/70">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-navy/50 dark:text-cream/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="leading-relaxed">
            <span className="font-semibold text-navy dark:text-cream">Wbudowane kategorie</span> są zawsze dostępne i nie można ich usunąć.{' '}
            <span className="font-semibold text-navy dark:text-cream">Własne kategorie</span> tworzysz poniżej — są zapisane w bazie danych i widoczne dla wszystkich adminów na wszystkich urządzeniach.{' '}
            Usunięcie własnej kategorii zmienia kategorię wszystkich powiązanych wydarzeń na „inne".
          </p>
        </div>
      </div>

      {/* ── Built-in icons ── */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-navy dark:text-cream mb-4">
          Wbudowane kategorie ({BUILT_IN_EVENT_ICONS.length})
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {BUILT_IN_EVENT_ICONS.map((icon) => (
            <div
              key={icon.key}
              className="flex flex-col items-center gap-2 rounded-2xl border border-navy/10 dark:border-cream/10 bg-navy/5 dark:bg-cream/5 p-4 text-center"
            >
              <span className={icon.color}>
                <IconPreviewSvg iconKey={icon.key} className="h-8 w-8" />
              </span>
              <span className="text-xs font-medium text-navy/80 dark:text-cream/80 leading-snug break-words w-full">
                {icon.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Custom icons ── */}
      <section className="mb-10">
        <h2 className="text-base font-bold text-navy dark:text-cream mb-1">
          Własne kategorie ({customTypes.length})
        </h2>
        <p className="text-xs text-navy/50 dark:text-cream/50 mb-4">
          Zapisane w bazie danych — widoczne dla wszystkich adminów. Ikona SVG wybrana z puli 128 wzorów.
        </p>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-navy/20 dark:border-cream/20 p-6 text-center text-sm text-navy/50 dark:text-cream/50">
            Ładowanie…
          </div>
        ) : customTypes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy/20 dark:border-cream/20 p-6 text-center text-sm text-navy/50 dark:text-cream/50">
            Brak własnych kategorii. Dodaj pierwszą poniżej.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {customTypes.map((ct) => {
              const extraIcon = EXTRA_ICON_MAP[ct.iconKey]
              return (
                <div
                  key={ct.key}
                  className="relative flex flex-col items-center gap-2 rounded-2xl border border-navy/10 dark:border-cream/10 bg-navy/5 dark:bg-cream/5 p-4 text-center group"
                >
                  <span className={ct.color}>
                    {extraIcon ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="h-8 w-8"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: extraIcon.paths }}
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
                        <circle cx="12" cy="12" r="9" strokeWidth="2.2"/>
                      </svg>
                    )}
                  </span>
                  <span className="text-xs font-medium text-navy/80 dark:text-cream/80 leading-snug break-words w-full">
                    {ct.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(ct.key, ct.label)}
                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow"
                    aria-label={`Usuń ${ct.label}`}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Add new custom type ── */}
      <section>
        <h2 className="text-base font-bold text-navy dark:text-cream mb-4">Dodaj nową kategorię</h2>
        <form onSubmit={handleAdd} className="page-card space-y-4">
          {/* Label */}
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

          {/* Auto-generated key preview */}
          {previewKey && (
            <p className="text-xs text-navy/50 dark:text-cream/50 -mt-2">
              Klucz (ID): <code className="font-mono">{previewKey}</code>
            </p>
          )}

          {/* SVG icon picker */}
          <div className="flex flex-col gap-1.5 text-sm text-navy dark:text-cream">
            <span>Ikona</span>
            <ExtraIconPicker
              value={form.iconKey}
              onChange={(key) => setForm((p) => ({ ...p, iconKey: key }))}
            />
            {!form.iconKey && (
              <p className="text-[11px] text-navy/40 dark:text-cream/40">Kliknij ikonę, żeby ją wybrać</p>
            )}
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-1.5 text-sm text-navy dark:text-cream">
            <span>Kolor</span>
            <div className="flex flex-wrap items-center gap-2">
              {DEFAULT_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  title={col.replace('text-', '').replace('-500', '')}
                  onClick={() => setForm((p) => ({ ...p, color: col }))}
                  className={`h-8 w-8 rounded-full border-2 transition-all flex items-center justify-center ${
                    form.color === col
                      ? 'border-navy dark:border-cream scale-110'
                      : 'border-navy/20 dark:border-cream/20'
                  }`}
                >
                  <span className={`block h-5 w-5 rounded-full ring-2 ring-black/30 dark:ring-white/30 ${col.replace('text-', 'bg-')}`} />
                </button>
              ))}

              {/* Live preview */}
              {form.iconKey && (
                <div className="ml-3 flex flex-col items-center gap-1.5 rounded-2xl border border-navy/10 dark:border-cream/10 bg-navy/5 dark:bg-cream/5 px-4 py-3 min-w-[72px]">
                  <span className={form.color}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      className="h-8 w-8"
                      dangerouslySetInnerHTML={{ __html: EXTRA_ICON_MAP[form.iconKey]?.paths || '' }}
                    />
                  </span>
                  {form.label && (
                  <span className="text-xs font-medium text-navy/80 dark:text-cream/80 leading-snug text-center max-w-[72px] break-words">
                    {form.label}
                  </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}

          <button
            type="submit"
            disabled={!form.iconKey || adding}
            className="w-full sm:w-auto btn-primary px-6 py-2.5 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? 'Dodawanie…' : 'Dodaj kategorię'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default AdminIconManager
