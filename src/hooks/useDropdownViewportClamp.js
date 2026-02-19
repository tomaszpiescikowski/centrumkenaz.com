import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

/**
 * Clamp an absolute dropdown menu horizontally so it never overflows viewport.
 */
function useDropdownViewportClamp({
  isOpen,
  containerRef,
  triggerRef,
  menuRef,
  preferredAlign = 'right',
  edgePadding = 8,
}) {
  const [style, setStyle] = useState({})

  const updatePosition = useCallback(() => {
    if (!isOpen) return
    if (!containerRef.current || !triggerRef.current || !menuRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const menuRect = menuRef.current.getBoundingClientRect()
    const menuWidth = menuRect.width || menuRef.current.offsetWidth
    const viewportWidth = window.innerWidth

    const baseLeft = preferredAlign === 'left'
      ? triggerRect.left
      : triggerRect.right - menuWidth

    const minLeft = edgePadding
    const maxLeft = Math.max(edgePadding, viewportWidth - menuWidth - edgePadding)
    const clampedLeft = Math.min(Math.max(baseLeft, minLeft), maxLeft)
    const relativeLeft = clampedLeft - containerRect.left

    setStyle({ left: `${Math.round(relativeLeft)}px` })
  }, [containerRef, edgePadding, isOpen, menuRef, preferredAlign, triggerRef])

  useLayoutEffect(() => {
    updatePosition()
  }, [updatePosition])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleUpdate = () => updatePosition()
    window.addEventListener('resize', handleUpdate)
    window.addEventListener('orientationchange', handleUpdate)
    window.addEventListener('scroll', handleUpdate, true)

    return () => {
      window.removeEventListener('resize', handleUpdate)
      window.removeEventListener('orientationchange', handleUpdate)
      window.removeEventListener('scroll', handleUpdate, true)
    }
  }, [isOpen, updatePosition])

  return style
}

export default useDropdownViewportClamp

