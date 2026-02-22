import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

const GATED_PATHS = new Set(['/calendar', '/panel', '/chat'])
const PATH_NS = { '/calendar': 'calendar', '/panel': 'panel', '/chat': 'comments' }

function PendingApprovalOverlay() {
  const { isAuthenticated, user, login } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()

  const isPendingApproval = isAuthenticated && user?.account_status !== 'active'
  const isGated = !isAuthenticated || isPendingApproval

  if (!isGated || !GATED_PATHS.has(pathname)) return null

  const ns = PATH_NS[pathname] ?? 'calendar'

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-40 flex flex-col items-center pt-[38.2svh] sm:top-16 sm:pt-[calc(38.2svh-4rem)]">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-navy/20 bg-cream/85 p-5 text-center shadow-xl dark:border-cream/20 dark:bg-navy/85 backdrop-blur-sm">
        {isPendingApproval ? (
          <>
            <p className="text-xl font-black text-navy dark:text-cream">
              {t(`${ns}.pendingRequiredTitle`)}
            </p>
            <p className="mt-2 text-navy/80 dark:text-cream/80">
              {t(`${ns}.pendingRequiredBody`)}
            </p>
            <Link
              to="/pending-approval"
              className="btn-primary mt-4 px-6 py-3 font-bold"
            >
              {t(`${ns}.pendingRequiredButton`)}
            </Link>
          </>
        ) : (
          <>
            <p className="text-xl font-black text-navy dark:text-cream">
              {t(`${ns}.loginRequiredTitle`)}
            </p>
            <p className="mt-2 text-navy/80 dark:text-cream/80">
              {t(`${ns}.loginRequiredBody`)}
            </p>
            <button
              onClick={() => login({ returnTo: pathname })}
              className="btn-primary mt-4 px-6 py-3 font-bold"
            >
              {t(`${ns}.loginRequiredButton`)}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default PendingApprovalOverlay
