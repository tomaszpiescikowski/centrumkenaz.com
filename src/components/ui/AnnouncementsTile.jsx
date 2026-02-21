import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { fetchAnnouncements } from '../../api/announcements'

function AnnouncementsTile() {
  const { t } = useLanguage()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchAnnouncements()
        if (!cancelled) setAnnouncements(data)
      } catch {
        if (!cancelled) setAnnouncements([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <p className="px-5 py-4 text-navy/60 dark:text-cream/60">{t('common.loading')}</p>
    )
  }

  if (announcements.length === 0) {
    return (
      <div className="px-5 py-4">
        <div className="rounded-2xl border border-dashed border-navy/20 p-6 dark:border-cream/20">
          <p className="text-navy/70 dark:text-cream/70">{t('announcements.empty')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-navy/10 overflow-y-auto dark:divide-cream/10">
      {announcements.map((a) => (
        <div key={a.id} className="px-5 py-3.5">
          <div className="flex items-start gap-3">
            {a.author?.picture_url ? (
              <img
                src={a.author.picture_url}
                alt={a.author.full_name || ''}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy dark:bg-cream/15 dark:text-cream">
                {(a.author?.full_name || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-bold text-navy dark:text-cream">
                  {a.author?.full_name || t('announcements.unknownAuthor')}
                </span>
                <span className="text-xs text-navy/50 dark:text-cream/50">
                  {formatAnnouncementDate(a.created_at)}
                </span>
              </div>
              <h3 className="mt-1 text-base font-bold text-navy dark:text-cream leading-snug">
                {a.title}
              </h3>
              <p className="mt-1 whitespace-pre-line text-sm text-navy/70 dark:text-cream/70 leading-relaxed">
                {a.content}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatAnnouncementDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default AnnouncementsTile
