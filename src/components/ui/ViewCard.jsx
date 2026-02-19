import { memo } from 'react'
import { Link } from 'react-router-dom'

function ViewCard({ title, description, onClick, isActive = false, to, className = '' }) {
  const variantClass = isActive ? 'ui-view-card-active' : 'ui-view-card-idle'
  const sharedClassName = `ui-view-card ${variantClass} ${className}`.trim()

  if (to) {
    return (
      <Link to={to} className={sharedClassName}>
        <h2 className="ui-view-card-title">{title}</h2>
        <p className="ui-view-card-description">{description}</p>
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={sharedClassName}>
      <h2 className="ui-view-card-title">{title}</h2>
      <p className="ui-view-card-description">{description}</p>
    </button>
  )
}

export default memo(ViewCard)
