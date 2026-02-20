import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

function LoginButton() {
  const { user, isAuthenticated, login, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-navy/20 dark:bg-cream/20 animate-pulse" />
    )
  }

  if (isAuthenticated && user) {
    const firstName = user.full_name?.split(' ')[0] || t('nav.myAccount')
    const accountTarget = user.account_status === 'active' ? '/me' : '/pending-approval'

    return (
      <Link
        to={accountTarget}
        className="btn-nav h-10 gap-3 justify-start pl-1.5 pr-4"
        aria-label={t('nav.myAccount')}
      >
        {user.picture_url ? (
          <img
            src={user.picture_url}
            alt={user.full_name}
            className="h-8 w-8 min-h-8 min-w-8 rounded-full border-2 border-navy/20 dark:border-cream/30 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy dark:bg-cream/15 dark:text-cream border-2 border-navy/20 dark:border-cream/30">
            {user.full_name?.charAt(0) || '?'}
          </div>
        )}
        <span className="max-w-[9rem] truncate">
          {firstName}
        </span>
      </Link>
    )
  }

  return (
    <button
      onClick={login}
      aria-label={t('auth.openLogin')}
      className="btn-nav h-10 px-4 transition-colors"
    >
      <span>{t('auth.openLogin')}</span>
    </button>
  )
}

export default LoginButton
