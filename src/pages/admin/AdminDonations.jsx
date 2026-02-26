import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import {
  cancelDonation,
  confirmDonation,
  fetchAdminDonationSettings,
  fetchAdminDonationStats,
  fetchAdminDonations,
  updateAdminDonationSettings,
} from '../../api/donations'
import AuthGateCard from '../../components/ui/AuthGateCard'
import ConfirmActionModal from '../../components/ui/ConfirmActionModal'
import ViewCard from '../../components/ui/ViewCard'

/* ────────────────────── helpers ────────────────────────── */

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtAmount(str) {
  const n = parseFloat(str)
  if (Number.isNaN(n)) return '—'
  return `${n.toFixed(2)} PLN`
}

const STATUS_BADGE = {
  pending_verification: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  cancelled: 'bg-navy/5 text-navy/60 dark:bg-cream/5 dark:text-cream/60 border-navy/15 dark:border-cream/15',
}

function StatusBadge({ status, t }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[status] || STATUS_BADGE.cancelled}`}>
      {t(`adminDonations.status.${status}`) || status}
    </span>
  )
}

/* ────────────────────── tabs ─────────────────────────────── */

const VIEWS = ['pending', 'all', 'settings', 'stats']

function TabBar({ active, setActive, pendingCount, t }) {
  const tabs = [
    { key: 'pending', label: t('adminDonations.tabs.pending'), badge: pendingCount },
    { key: 'all', label: t('adminDonations.tabs.all') },
    { key: 'settings', label: t('adminDonations.tabs.settings') },
    { key: 'stats', label: t('adminDonations.tabs.stats') },
  ]
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => setActive(tab.key)}
          className={`relative shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            active === tab.key
              ? 'bg-navy text-cream dark:bg-cream dark:text-navy'
              : 'bg-navy/8 text-navy/70 dark:bg-cream/8 dark:text-cream/70 hover:bg-navy/15 dark:hover:bg-cream/15'
          }`}
        >
          {tab.label}
          {tab.badge > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white min-w-[18px]">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ────────────────────── donation row ─────────────────────── */

function DonationRow({ donation, onConfirm, onCancel, t }) {
  const isPending = donation.status === 'pending_verification'
  return (
    <div className="page-subcard" data-no-hover="true">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={donation.status} t={t} />
            <span className="text-sm font-bold text-navy dark:text-cream">
              {fmtAmount(donation.amount)}
            </span>
            {donation.points_awarded > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                +{donation.points_awarded} pkt
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-navy/70 dark:text-cream/70 break-all">
            {donation.transfer_reference}
          </p>
          {(donation.user_full_name || donation.donor_name) && (
            <p className="text-xs text-navy/60 dark:text-cream/60">
              👤 {donation.user_full_name || donation.donor_name}
              {donation.user_email && ` (${donation.user_email})`}
              {!donation.user_id && ` · ${t('adminDonations.anonymous')}`}
            </p>
          )}
          {donation.donor_email && !donation.user_email && (
            <p className="text-xs text-navy/60 dark:text-cream/60">✉ {donation.donor_email}</p>
          )}
          {donation.admin_note && (
            <p className="text-xs italic text-navy/50 dark:text-cream/50">"{donation.admin_note}"</p>
          )}
          <p className="text-[11px] text-navy/40 dark:text-cream/40">{fmtDate(donation.created_at)}</p>
        </div>
        {isPending && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onConfirm(donation)}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              {t('adminDonations.confirm')}
            </button>
            <button
              type="button"
              onClick={() => onCancel(donation)}
              className="rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              {t('adminDonations.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────── settings form ───────────────────── */

function SettingsForm({ authFetch, t, showSuccess, showError }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    points_per_zloty: 1,
    min_amount: 5,
    suggested_amounts_str: '10, 20, 50, 100',
    is_enabled: true,
    account_number: '',
    payment_title: '',
    bank_owner_name: '',
    bank_owner_address: '',
    message: '',
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchAdminDonationSettings(authFetch)
        if (!cancelled) {
          setForm({
            points_per_zloty: data.points_per_zloty ?? 1,
            min_amount: data.min_amount ?? 5,
            suggested_amounts_str: (data.suggested_amounts ?? [10, 20, 50, 100]).join(', '),
            is_enabled: data.is_enabled ?? true,
            account_number: data.account_number ?? '',
            payment_title: data.payment_title ?? '',
            bank_owner_name: data.bank_owner_name ?? '',
            bank_owner_address: data.bank_owner_address ?? '',
            message: data.message ?? '',
          })
        }
      } catch (err) {
        if (!cancelled) showError(err.message || t('adminDonations.settings.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authFetch, showError, t])

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSave = async (e) => {
    e.preventDefault()
    const suggested = form.suggested_amounts_str
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0)
    try {
      setSaving(true)
      await updateAdminDonationSettings(authFetch, {
        points_per_zloty: parseFloat(form.points_per_zloty) || 0,
        min_amount: parseFloat(form.min_amount) || 5,
        suggested_amounts: suggested,
        is_enabled: form.is_enabled,
        account_number: form.account_number || null,
        payment_title: form.payment_title || null,
        bank_owner_name: form.bank_owner_name || null,
        bank_owner_address: form.bank_owner_address || null,
        message: form.message || null,
      })
      showSuccess(t('adminDonations.settings.saved'))
    } catch (err) {
      showError(err.message || t('adminDonations.settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-navy/60 dark:text-cream/60">{t('common.loading')}</p>

  const fieldClass = 'w-full rounded-xl border border-navy/20 dark:border-cream/20 bg-transparent px-4 py-3 text-sm text-navy dark:text-cream placeholder-navy/40 dark:placeholder-cream/40 focus:outline-none focus:ring-2 focus:ring-navy/30 dark:focus:ring-cream/30'
  const labelClass = 'block text-sm font-semibold text-navy dark:text-cream mb-1.5'
  const hintClass = 'mt-1 text-xs text-navy/50 dark:text-cream/50'

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Points & amounts */}
      <section className="page-subcard space-y-5" data-no-hover="true">
        <h3 className="text-sm font-bold text-navy dark:text-cream">{t('adminDonations.settings.rewardsSection')}</h3>

        <div>
          <label className={labelClass}>{t('adminDonations.settings.isEnabled')}</label>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              role="switch"
              aria-checked={form.is_enabled}
              onClick={() => set('is_enabled', !form.is_enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${form.is_enabled ? 'bg-emerald-500' : 'bg-navy/20 dark:bg-cream/20'}`}
            >
              <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${form.is_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-navy/70 dark:text-cream/70">
              {form.is_enabled ? t('adminDonations.settings.enabled') : t('adminDonations.settings.disabled')}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t('adminDonations.settings.pointsPerZloty')}</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.points_per_zloty}
              onChange={(e) => set('points_per_zloty', e.target.value)}
              className={fieldClass}
            />
            <p className={hintClass}>{t('adminDonations.settings.pointsPerZlotyHint')}</p>
          </div>
          <div>
            <label className={labelClass}>{t('adminDonations.settings.minAmount')}</label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.min_amount}
              onChange={(e) => set('min_amount', e.target.value)}
              className={fieldClass}
            />
            <p className={hintClass}>{t('adminDonations.settings.minAmountHint')}</p>
          </div>
        </div>

        <div>
          <label className={labelClass}>{t('adminDonations.settings.suggestedAmounts')}</label>
          <input
            type="text"
            value={form.suggested_amounts_str}
            onChange={(e) => set('suggested_amounts_str', e.target.value)}
            placeholder="10, 20, 50, 100"
            className={fieldClass}
          />
          <p className={hintClass}>{t('adminDonations.settings.suggestedAmountsHint')}</p>
        </div>
      </section>

      {/* Bank details */}
      <section className="page-subcard space-y-4" data-no-hover="true">
        <h3 className="text-sm font-bold text-navy dark:text-cream">{t('adminDonations.settings.bankSection')}</h3>

        <div>
          <label className={labelClass}>{t('adminDonations.settings.accountNumber')}</label>
          <input type="text" value={form.account_number} onChange={(e) => set('account_number', e.target.value)} placeholder="PL 00 0000 0000 0000 0000 0000 0000" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{t('adminDonations.settings.paymentTitle')}</label>
          <input type="text" value={form.payment_title} onChange={(e) => set('payment_title', e.target.value)} placeholder="Wsparcie Kenaz" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{t('adminDonations.settings.bankOwnerName')}</label>
          <input type="text" value={form.bank_owner_name} onChange={(e) => set('bank_owner_name', e.target.value)} placeholder="Stowarzyszenie Kenaz" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{t('adminDonations.settings.bankOwnerAddress')}</label>
          <textarea rows={2} value={form.bank_owner_address} onChange={(e) => set('bank_owner_address', e.target.value)} className={`${fieldClass} resize-none`} />
        </div>
      </section>

      {/* Public message */}
      <section className="page-subcard" data-no-hover="true">
        <h3 className="text-sm font-bold text-navy dark:text-cream mb-4">{t('adminDonations.settings.messageSection')}</h3>
        <textarea
          rows={4}
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder={t('adminDonations.settings.messagePlaceholder')}
          className={`${fieldClass} resize-none`}
        />
        <p className={hintClass}>{t('adminDonations.settings.messageHint')}</p>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-navy text-cream dark:bg-cream dark:text-navy px-8 py-3 text-sm font-bold disabled:opacity-50 transition-opacity"
      >
        {saving ? t('common.loading') : t('adminDonations.settings.save')}
      </button>
    </form>
  )
}

/* ────────────────────── stats view ──────────────────────── */

function StatsView({ authFetch, t, showError }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchAdminDonationStats(authFetch)
        if (!cancelled) setStats(data)
      } catch (err) {
        if (!cancelled) showError(err.message || 'Błąd statystyk')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authFetch, showError])

  if (loading) return <p className="text-sm text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
  if (!stats) return null

  const cards = [
    { label: t('adminDonations.stats.pendingCount'), value: stats.pending_count, accent: 'amber' },
    { label: t('adminDonations.stats.totalCount'), value: stats.total_confirmed_count, accent: 'emerald' },
    { label: t('adminDonations.stats.totalAmount'), value: fmtAmount(stats.total_confirmed_amount), accent: 'emerald' },
    { label: t('adminDonations.stats.totalPoints'), value: `${stats.total_points_awarded} pkt`, accent: 'amber' },
    { label: t('adminDonations.stats.monthCount'), value: stats.month_count, accent: 'blue' },
    { label: t('adminDonations.stats.monthAmount'), value: fmtAmount(stats.month_amount), accent: 'blue' },
  ]

  const accentMap = {
    amber: 'border-amber-200 dark:border-amber-700/40 bg-amber-50/80 dark:bg-amber-900/15',
    emerald: 'border-emerald-200 dark:border-emerald-700/40 bg-emerald-50/80 dark:bg-emerald-900/15',
    blue: 'border-blue-200 dark:border-blue-700/40 bg-blue-50/80 dark:bg-blue-900/15',
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-2xl border p-5 ${accentMap[card.accent]}`}>
          <p className="text-xs text-navy/60 dark:text-cream/60 font-medium">{card.label}</p>
          <p className="mt-1 text-2xl font-black text-navy dark:text-cream">{card.value}</p>
        </div>
      ))}
    </div>
  )
}

/* ────────────────────── main component ──────────────────── */

function AdminDonations() {
  const { user, isAuthenticated, authFetch, login } = useAuth()
  const { t } = useLanguage()
  const { showError, showSuccess } = useNotification()

  const [searchParams, setSearchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const activeView = VIEWS.includes(requestedView) ? requestedView : 'pending'

  const setView = (v) => setSearchParams({ view: v }, { replace: false })

  const [donationsPending, setDonationsPending] = useState([])
  const [donationsAll, setDonationsAll] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Confirm/cancel modal state
  const [confirmModal, setConfirmModal] = useState(null) // { donation, action: 'confirm'|'cancel' }
  const [modalNote, setModalNote] = useState('')
  const [actioning, setActioning] = useState(false)

  const isAdmin = user?.role === 'admin'

  const loadDonations = async (view) => {
    if (view !== 'pending' && view !== 'all') return
    setLoadingList(true)
    try {
      if (view === 'pending') {
        const data = await fetchAdminDonations(authFetch, 'pending_verification')
        setDonationsPending(data)
        setPendingCount(data.length)
      } else {
        const [pending, all] = await Promise.all([
          fetchAdminDonations(authFetch, 'pending_verification'),
          fetchAdminDonations(authFetch, null),
        ])
        setDonationsAll(all)
        setPendingCount(pending.length)
      }
    } catch (err) {
      showError(err.message || 'Błąd ładowania donacji')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return
    loadDonations(activeView)
  }, [activeView, isAuthenticated, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmClick = (donation) => {
    setModalNote('')
    setConfirmModal({ donation, action: 'confirm' })
  }
  const handleCancelClick = (donation) => {
    setModalNote('')
    setConfirmModal({ donation, action: 'cancel' })
  }

  const handleModalSubmit = async () => {
    if (!confirmModal) return
    const { donation, action } = confirmModal
    try {
      setActioning(true)
      if (action === 'confirm') {
        const res = await confirmDonation(authFetch, donation.id, modalNote)
        showSuccess(
          res.points_awarded > 0
            ? t('adminDonations.confirmedWithPoints', { points: res.points_awarded })
            : t('adminDonations.confirmed')
        )
      } else {
        await cancelDonation(authFetch, donation.id, modalNote)
        showSuccess(t('adminDonations.cancelled'))
      }
      setConfirmModal(null)
      await loadDonations(activeView)
    } catch (err) {
      showError(err.message || 'Błąd')
    } finally {
      setActioning(false)
    }
  }

  /* Auth guards */
  if (!isAuthenticated) {
    return (
      <AuthGateCard
        title={t('adminDonations.title')}
        message={t('admin.loginRequired')}
        actionLabel={t('admin.loginButton')}
        onAction={() => login({ returnTo: '/admin/donations' })}
      />
    )
  }
  if (!isAdmin) {
    return (
      <AuthGateCard
        title={t('adminDonations.title')}
        message={t('admin.notAuthorized')}
        actionLabel={t('common.backToCalendar')}
        actionTo="/calendar"
      />
    )
  }

  const displayDonations = activeView === 'pending' ? donationsPending : donationsAll

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy dark:text-cream">
            {t('adminDonations.title')}
          </h1>
          <p className="text-navy/60 dark:text-cream/60 text-sm mt-1">
            {t('adminDonations.subtitle')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <TabBar active={activeView} setActive={setView} pendingCount={pendingCount} t={t} />

      {/* Content */}
      {(activeView === 'pending' || activeView === 'all') && (
        <div>
          {loadingList ? (
            <p className="text-sm text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
          ) : displayDonations.length === 0 ? (
            <div className="page-card text-center py-10">
              <p className="text-navy/50 dark:text-cream/50 text-sm">
                {activeView === 'pending' ? t('adminDonations.noPending') : t('adminDonations.noAll')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayDonations.map((d) => (
                <DonationRow
                  key={d.id}
                  donation={d}
                  onConfirm={handleConfirmClick}
                  onCancel={handleCancelClick}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'settings' && (
        <SettingsForm authFetch={authFetch} t={t} showSuccess={showSuccess} showError={showError} />
      )}

      {activeView === 'stats' && (
        <StatsView authFetch={authFetch} t={t} showError={showError} />
      )}

      {/* Confirm/cancel modal */}
      <ConfirmActionModal
        open={!!confirmModal}
        onCancel={() => setConfirmModal(null)}
        onConfirm={handleModalSubmit}
        title={
          confirmModal?.action === 'confirm'
            ? t('adminDonations.modal.confirmTitle')
            : t('adminDonations.modal.cancelTitle')
        }
        description={
          confirmModal?.action === 'confirm'
            ? t('adminDonations.modal.confirmBody', { amount: fmtAmount(confirmModal?.donation?.amount), ref: confirmModal?.donation?.transfer_reference })
            : t('adminDonations.modal.cancelBody', { ref: confirmModal?.donation?.transfer_reference })
        }
        confirmLabel={
          confirmModal?.action === 'confirm'
            ? t('adminDonations.confirm')
            : t('adminDonations.cancel')
        }
        variant={confirmModal?.action === 'cancel' ? 'danger' : 'default'}
        loading={actioning}
      />
    </div>
  )
}

export default AdminDonations
