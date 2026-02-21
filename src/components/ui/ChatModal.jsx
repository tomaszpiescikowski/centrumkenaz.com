import { useEffect, useState, useCallback } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import CommentsSection from '../common/CommentsSection'
import '../common/CommentsSection.css'

/**
 * Near-fullscreen mobile chat overlay with Event / General tab switch.
 * Follows the same pattern as FeedbackModal (fixed overlay, backdrop, ESC, body scroll lock).
 */
function ChatModal({ open, onClose, resourceType, resourceId, generalOnly }) {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState(generalOnly ? 'general' : 'event')

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Reset tab when opening
  useEffect(() => {
    if (open) setActiveTab(generalOnly ? 'general' : 'event')
  }, [open, generalOnly])

  if (!open) return null

  return (
    <div
      className="chat-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={t('comments.chatTitle')}
    >
      <div className="chat-modal-panel">
        {/* Header with tabs + close */}
        <div className="chat-modal-header">
          {generalOnly ? (
            <span className="chat-modal-title">{t('comments.tabGeneral')}</span>
          ) : (
            <div className="cmt-tabs" style={{ margin: 0, flex: 1 }}>
              <button
                className={`cmt-tab ${activeTab === 'event' ? 'cmt-tab-active' : ''}`}
                onClick={() => setActiveTab('event')}
              >
                {t('comments.tabEvent')}
              </button>
              <button
                className={`cmt-tab ${activeTab === 'general' ? 'cmt-tab-active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                {t('comments.tabGeneral')}
              </button>
            </div>
          )}

          <button
            className="chat-modal-close"
            onClick={onClose}
            aria-label={t('comments.cancel')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="chat-modal-body">
          <CommentsSection
            resourceType={resourceType}
            resourceId={resourceId}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hideHeader
            hideTabs
            messengerLayout
          />
        </div>
      </div>
    </div>
  )
}

export default ChatModal
