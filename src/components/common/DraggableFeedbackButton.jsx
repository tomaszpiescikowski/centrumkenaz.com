import { useState, useRef, useEffect, useCallback } from 'react'
import FeedbackModal from '../ui/FeedbackModal'
import { useLanguage } from '../../context/LanguageContext'

const STORAGE_KEY = 'kenaz.feedbackBtn.pos'
const BTN_W = 136 // approximate pill width
const BTN_H = 48  // pill height + tail
const MARGIN = 12
// Mobile bottom nav height: 3.5rem (56px) + safe area (~34px on modern iPhones)
const MOBILE_NAV_H = 96

function getDefaultPos() {
  const w = window.innerWidth
  const h = window.innerHeight
  const isMobile = w < 640
  return {
    left: w - BTN_W - MARGIN,
    top: h - BTN_H - MARGIN - (isMobile ? MOBILE_NAV_H : MARGIN),
  }
}

function clampPos(pos) {
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    left: clamp(pos.left, MARGIN, w - BTN_W - MARGIN),
    top: clamp(pos.top, MARGIN, h - BTN_H - MARGIN),
  }
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

function DraggableFeedbackButton() {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {}
    return null
  })

  const btnRef = useRef(null)
  const dragState = useRef(null)
  const hasDragged = useRef(false)

  // Set default position (or clamp stale stored position) once window dims are known
  useEffect(() => {
    if (!pos) {
      setPos(getDefaultPos())
    } else {
      // Clamp stored position to current viewport — fixes off-screen on smaller devices
      const clamped = clampPos(pos)
      if (clamped.left !== pos.left || clamped.top !== pos.top) {
        setPos(clamped)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist position to localStorage
  useEffect(() => {
    if (pos) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
    }
  }, [pos])

  const startDrag = useCallback((clientX, clientY) => {
    if (!pos) return
    hasDragged.current = false
    dragState.current = {
      startX: clientX,
      startY: clientY,
      startLeft: pos.left,
      startTop: pos.top,
    }
  }, [pos])

  const moveDrag = useCallback((clientX, clientY) => {
    if (!dragState.current) return
    const { startX, startY, startLeft, startTop } = dragState.current
    const dx = clientX - startX
    const dy = clientY - startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasDragged.current = true
    }
    if (!hasDragged.current) return
    const w = window.innerWidth
    const h = window.innerHeight
    const newLeft = clamp(startLeft + dx, MARGIN, w - BTN_W - MARGIN)
    const newTop = clamp(startTop + dy, MARGIN, h - BTN_H - MARGIN)
    if (btnRef.current) {
      btnRef.current.style.left = `${newLeft}px`
      btnRef.current.style.top = `${newTop}px`
    }
  }, [])

  const endDrag = useCallback(() => {
    if (!dragState.current) return
    if (hasDragged.current && btnRef.current) {
      const left = parseFloat(btnRef.current.style.left)
      const top = parseFloat(btnRef.current.style.top)
      setPos({ left, top })
    }
    dragState.current = null
  }, [])

  const onMouseDown = (e) => {
    e.preventDefault()
    startDrag(e.clientX, e.clientY)
    const onMouseMove = (e) => moveDrag(e.clientX, e.clientY)
    const onMouseUp = () => {
      endDrag()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const onTouchStart = (e) => {
    const touch = e.touches[0]
    startDrag(touch.clientX, touch.clientY)
  }
  const onTouchMove = (e) => {
    const touch = e.touches[0]
    moveDrag(touch.clientX, touch.clientY)
    if (hasDragged.current) e.preventDefault()
  }
  const onTouchEnd = () => endDrag()

  const handleClick = () => {
    if (!hasDragged.current) {
      setOpen(true)
    }
  }

  if (!pos) return null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleClick}
        aria-label={t('feedback.button')}
        style={{ left: pos.left, top: pos.top, touchAction: 'none' }}
        className="fixed z-[60] select-none cursor-grab active:cursor-grabbing"
      >
        {/* Speech bubble body */}
        <div className="relative flex items-center gap-1.5 rounded-2xl bg-amber-500 px-3 py-2 text-white shadow-lg transition-shadow hover:shadow-xl">
          {/* Lightbulb icon */}
          <svg className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs font-semibold leading-none">{t('feedback.button')}</span>
          {/* Speech bubble tail pointing downward */}
          <span
            aria-hidden="true"
            className="absolute -bottom-[7px] left-4 h-0 w-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '7px solid #f59e0b',
            }}
          />
        </div>
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default DraggableFeedbackButton
