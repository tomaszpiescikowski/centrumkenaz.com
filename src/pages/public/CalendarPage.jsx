import { useLanguage } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import Calendar from '../../components/calendar/Calendar'

function CalendarPage() {
  const { t } = useLanguage()
  const { isAuthenticated, login, user } = useAuth()
  const isPendingApproval = isAuthenticated && user?.account_status !== 'active'
  const isCalendarLocked = !isAuthenticated || isPendingApproval

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-3 sm:px-4 sm:py-6">
      <div className="relative min-h-0 flex-1">
        <div className={isCalendarLocked ? 'pointer-events-none select-none blur-[3px]' : ''}>
          <Calendar className="h-full min-h-0" />
        </div>
        {isCalendarLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-navy/20 bg-cream/85 p-5 text-center shadow-xl dark:border-cream/20 dark:bg-navy/85">
              <p className="text-xl font-black text-navy dark:text-cream">
                {isPendingApproval ? t('calendar.pendingRequiredTitle') : t('calendar.loginRequiredTitle')}
              </p>
              <p className="mt-2 text-navy/80 dark:text-cream/80">
                {isPendingApproval ? t('calendar.pendingRequiredBody') : t('calendar.loginRequiredBody')}
              </p>
              {isPendingApproval ? (
                <Link
                  to="/pending-approval"
                  className="btn-primary mt-4 px-6 py-3 font-bold"
                >
                  {t('calendar.pendingRequiredButton')}
                </Link>
              ) : (
                <button
                  onClick={() => login({ returnTo: '/calendar' })}
                  className="btn-primary mt-4 px-6 py-3 font-bold"
                >
                  {t('calendar.loginRequiredButton')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CalendarPage
