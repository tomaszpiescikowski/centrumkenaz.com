import { useAuth } from '../../context/AuthContext'
import Calendar from '../../components/calendar/Calendar'

function CalendarPage() {
  const { isAuthenticated, user } = useAuth()
  const isPendingApproval = isAuthenticated && user?.account_status !== 'active'
  const isCalendarLocked = !isAuthenticated || isPendingApproval

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-3 sm:px-4 sm:py-6">
      <div className="relative min-h-0 flex-1">
        <div className={isCalendarLocked ? 'pointer-events-none select-none blur-[3px]' : ''}>
          <Calendar className="h-full min-h-0" />
        </div>
      </div>
    </div>
  )
}

export default CalendarPage
