import { useAuth } from '../../context/AuthContext'
import Calendar from '../../components/calendar/Calendar'

function CalendarPage() {
  const { isAuthenticated, user } = useAuth()
  const isPendingApproval = isAuthenticated && user?.account_status !== 'active'
  const isCalendarLocked = !isAuthenticated || isPendingApproval

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-3 pb-10 sm:flex sm:flex-col sm:min-h-0 sm:overflow-hidden sm:px-4 sm:py-6">
      <div className="relative sm:min-h-0 sm:flex-1">
        <div className={isCalendarLocked ? 'pointer-events-none select-none blur-[3px]' : ''}>
          <Calendar className="sm:h-full sm:min-h-0" />
        </div>
      </div>
    </div>
  )
}

export default CalendarPage
