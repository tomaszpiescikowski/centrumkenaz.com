import { useLanguage } from '../../context/LanguageContext'
import { useNotification } from '../../context/NotificationContext'
import styles from '../../styles/modules/components/NotificationBanner.module.css'

function NotificationBanner() {
  const { t } = useLanguage()
  const { notification, clearNotification } = useNotification()

  if (!notification) return null

  const isError = notification.type === 'error'
  const isSuccess = notification.type === 'success'
  const isWarning = notification.type === 'warning'
  const isConfirm = notification.type === 'confirm'
  const variantClass = isError
    ? styles.error
    : isSuccess
      ? styles.success
      : isWarning || isConfirm
        ? styles.warning
        : styles.info
  const defaultTitle = isError
    ? t('notifications.errorTitle')
    : isSuccess
      ? t('notifications.successTitle')
      : isWarning
        ? t('notifications.infoTitle')
        : isConfirm
        ? t('notifications.confirmTitle')
        : t('notifications.infoTitle')

  return (
    <div className={styles.wrapper}>
      <div className={styles.inner}>
        <div className={`${styles.banner} ${variantClass}`} role="status" aria-live={isError ? 'assertive' : 'polite'}>
          <div className={styles.layout}>
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isError ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : isSuccess ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : isWarning ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.518 11.592c.75 1.334-.213 2.99-1.742 2.99H3.48c-1.53 0-2.492-1.656-1.743-2.99L8.257 3.1zM12 9v3m0 3h.01" />
              ) : isConfirm ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.518 11.592c.75 1.334-.213 2.99-1.742 2.99H3.48c-1.53 0-2.492-1.656-1.743-2.99L8.257 3.1zM12 9v3m0 3h.01" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
            <div className={styles.body}>
              <p className={styles.title}>{notification.title || defaultTitle}</p>
              <p className={styles.message}>{notification.message}</p>
              {Array.isArray(notification.actions) && notification.actions.length > 0 && (
                <div className={styles.actions}>
                  {notification.actions.map((action, index) => (
                    <button
                      key={`${action.label}-${index}`}
                      type="button"
                      onClick={() => {
                        clearNotification()
                        action.onClick?.()
                      }}
                      className={action.variant === 'danger' ? styles.actionDanger : styles.actionDefault}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={clearNotification}
              className={styles.close}
              aria-label={t('common.close')}
            >
              <svg className={styles.closeIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationBanner
