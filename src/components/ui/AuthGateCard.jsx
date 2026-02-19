import { Link } from 'react-router-dom'

function AuthGateCard({ title, message, actionLabel, actionTo, onAction, centered = false }) {
  const cardClassName = `page-card ${centered ? 'text-center' : ''}`.trim()
  const actionClassName = `btn-primary px-5 py-3 font-semibold ${centered ? 'mx-auto' : ''}`.trim()

  return (
    <div className="page-shell">
      <div className={cardClassName}>
        <h1 className="mb-2 text-2xl font-black text-navy dark:text-cream">{title}</h1>
        <p className="mb-6 text-navy/70 dark:text-cream/70">{message}</p>
        {actionTo ? (
          <Link to={actionTo} className={actionClassName}>
            {actionLabel}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className={actionClassName}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export default AuthGateCard
