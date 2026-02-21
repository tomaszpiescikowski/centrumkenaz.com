import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { API_URL } from '../../api/config'

function ParticipantsTable({
  eventId,
  maxParticipants,
  onUpdate,
  refreshKey = 0,
  compact = false,
  className = '',
}) {
  const { t } = useLanguage()
  const { user, authFetch, isAuthenticated } = useAuth()
  const [participants, setParticipants] = useState([])
  const [waitlistParticipants, setWaitlistParticipants] = useState([])
  const [loading, setLoading] = useState(true)

  const getNameParts = (fullName) => {
    const normalized = (fullName || '').trim()
    if (!normalized) {
      return { first: '', last: '' }
    }
    const parts = normalized.split(/\s+/)
    if (parts.length === 1) {
      return { first: parts[0], last: '' }
    }
    return { first: parts[0], last: parts.slice(1).join(' ') }
  }

  const fetchParticipants = useCallback(async (signal) => {
    if (!isAuthenticated) {
      setParticipants([])
      setWaitlistParticipants([])
      if (onUpdate) onUpdate(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [participantsResponse, waitlistResponse] = await Promise.all([
        authFetch(`${API_URL}/events/${eventId}/participants`),
        authFetch(`${API_URL}/events/${eventId}/waitlist`),
      ])

      if (signal?.aborted) return

      const participantsData = participantsResponse.ok ? await participantsResponse.json() : []
      const waitlistData = waitlistResponse.ok ? await waitlistResponse.json() : []

      setParticipants(participantsData)
      setWaitlistParticipants(waitlistData)
      if (onUpdate) {
        onUpdate(participantsData.length)
      }
    } catch (error) {
      if (signal?.aborted) return
      console.error('Failed to fetch participants:', error)
      setParticipants([])
      setWaitlistParticipants([])
      if (onUpdate) onUpdate(0)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [isAuthenticated, authFetch, eventId, onUpdate])

  useEffect(() => {
    const controller = new AbortController()
    fetchParticipants(controller.signal)
    return () => controller.abort()
  }, [fetchParticipants, refreshKey])

  const spotsAvailable = maxParticipants ? maxParticipants - participants.length : null

  if (loading) {
    return (
      <div className={`rounded-2xl border border-navy/10 bg-cream/75 dark:border-cream/15 dark:bg-navy/75 animate-pulse ${compact ? 'p-5' : 'p-8'} ${className}`}>
        <div className="h-6 bg-navy/10 dark:bg-cream/20 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-navy/10 dark:bg-cream/20 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex h-full min-h-0 flex-col rounded-2xl border border-navy/10 bg-cream/75 dark:border-cream/15 dark:bg-navy/75 ${compact ? 'p-5' : 'p-8'} ${className}`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-4' : 'mb-6'}`}>
        <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-black text-navy dark:text-cream`}>
          {t('participants.title')}
        </h2>
        {maxParticipants && (
          <div className="text-right">
            <span className={`${compact ? 'text-2xl' : 'text-3xl'} font-black text-navy dark:text-cream`}>
              {participants.length}
            </span>
            <span className="text-navy/50 dark:text-cream/50">
              /{maxParticipants}
            </span>
            {spotsAvailable !== null && spotsAvailable > 0 && (
              <p className={`${compact ? 'text-xs' : 'text-sm'} text-green-600 dark:text-green-400`}>
                {t('participants.spotsAvailable').replace('{count}', String(spotsAvailable))}
              </p>
            )}
            {spotsAvailable === 0 && (
              <p className={`${compact ? 'text-xs' : 'text-sm'} text-red-500`}>
                {t('participants.noSpots')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Participants list */}
      {participants.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-lg border border-navy/10 dark:border-cream/15">
            <div className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-navy/10 bg-navy/5 px-2 dark:border-cream/10 dark:bg-cream/5 ${compact ? 'py-1' : 'py-1.5'}`}>
              <span className="w-6 text-center text-[10px] font-semibold uppercase tracking-wide text-navy/60 dark:text-cream/60">•</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-navy/60 dark:text-cream/60">{t('account.name')}</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-navy/60 dark:text-cream/60">{t('participants.pointsAbbr')}</span>
            </div>

            {participants.map((participant) => {
              const isMember = Boolean(participant.is_member)
              const points = Number(participant.points || 0)
              const fallbackInitial = (participant.full_name || '?').trim().charAt(0).toUpperCase() || '?'
              const avatarUrl = participant.picture_url || (user && participant.user_id === user.id ? user.picture_url : null)
              return (
                <Link
                  key={participant.id}
                  to={`/people/${participant.user_id}`}
                  className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-navy/10 px-2 text-navy transition hover:bg-navy/5 dark:border-cream/10 dark:text-cream dark:hover:bg-cream/5 ${compact ? 'py-1.5' : 'py-2'}`}
                >
                  <div className="flex w-6 items-center justify-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={participant.full_name || 'User'}
                        className="h-4 w-4 min-h-4 min-w-4 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-navy/15 text-[9px] font-bold text-navy/80 dark:bg-cream/20 dark:text-cream/80">
                        {fallbackInitial}
                      </span>
                    )}
                  </div>

                  <div className="truncate text-xs font-semibold leading-none">
                    {participant.full_name}
                  </div>

                  <div className="min-w-[2.75rem] text-right text-[11px] font-semibold">
                    {isMember ? (
                      <span className="text-amber-500 dark:text-amber-300">{points}</span>
                    ) : (
                      <span className="text-navy/30 dark:text-cream/30">-</span>
                    )}
                  </div>
                </Link>
              )
            })}

            {maxParticipants && spotsAvailable > 0 && Array.from({ length: Math.min(spotsAvailable, compact ? 10 : 14) }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-dashed border-navy/10 px-2 text-navy/35 dark:border-cream/10 dark:text-cream/35 ${compact ? 'py-1.5' : 'py-2'}`}
              >
                <span className="w-6 text-center text-[10px] font-semibold">+</span>
                <span className="truncate text-xs">{t('participants.freeSpot')}</span>
                <span className="min-w-[2.75rem] text-right text-[11px]">-</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`text-center text-navy/50 dark:text-cream/50 ${compact ? 'py-5' : 'py-8'}`}>
          <p>{t('participants.emptyTitle')}</p>
          <p className={`${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'}`}>{t('participants.emptySubtitle')}</p>
        </div>
      )}

      {waitlistParticipants.length > 0 && (
        <div className={`${compact ? 'mt-4' : 'mt-6'} min-h-0 flex-1 overflow-y-auto pr-1`}>
          <h3 className={`${compact ? 'mb-2 text-sm' : 'mb-3 text-base'} font-black text-navy dark:text-cream`}>
            {t('registration.waitlistTitle')}
          </h3>
          <div className="overflow-hidden rounded-lg border border-navy/10 dark:border-cream/15">
            <div className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-navy/10 bg-navy/5 px-2 dark:border-cream/10 dark:bg-cream/5 ${compact ? 'py-1' : 'py-1.5'}`}>
              <span className="w-6 text-center text-[10px] font-semibold uppercase tracking-wide text-navy/60 dark:text-cream/60">•</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-navy/60 dark:text-cream/60">{t('account.name')}</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-wide text-navy/60 dark:text-cream/60">{t('participants.pointsAbbr')}</span>
            </div>
            {waitlistParticipants.map((participant) => {
              const isMember = Boolean(participant.is_member)
              const points = Number(participant.points || 0)
              const fallbackInitial = (participant.full_name || '?').trim().charAt(0).toUpperCase() || '?'
              const avatarUrl = participant.picture_url || (user && participant.user_id === user.id ? user.picture_url : null)
              return (
                <Link
                  key={`waitlist-${participant.id}`}
                  to={`/people/${participant.user_id}`}
                  className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-navy/10 px-2 text-navy transition hover:bg-navy/5 dark:border-cream/10 dark:text-cream dark:hover:bg-cream/5 ${compact ? 'py-1.5' : 'py-2'}`}
                >
                  <div className="flex w-6 items-center justify-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={participant.full_name || 'User'}
                        className="h-4 w-4 min-h-4 min-w-4 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-navy/15 text-[9px] font-bold text-navy/80 dark:bg-cream/20 dark:text-cream/80">
                        {fallbackInitial}
                      </span>
                    )}
                  </div>

                  <div className="truncate text-xs font-semibold leading-none">
                    {participant.full_name}
                  </div>

                  <div className="min-w-[2.75rem] text-right text-[11px] font-semibold">
                    {isMember ? (
                      <span className="text-amber-500 dark:text-amber-300">{points}</span>
                    ) : (
                      <span className="text-navy/30 dark:text-cream/30">-</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ParticipantsTable
