import { useState, useRef, useEffect, useCallback, type TouchEvent as ReactTouchEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Modal as HeroUIModal } from '@heroui/react'
import { XIcon } from './icons'

export interface ImageViewerModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  title?: string
}

export function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  title = 'تصویر محصول',
}: ImageViewerModalProps) {
  const [scale, setScale] = useState<number>(1)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isInteracting, setIsInteracting] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Tracking refs for mouse/touch interactions
  const isDraggingRef = useRef<boolean>(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const hasDraggedRef = useRef<boolean>(false)
  const scaleRef = useRef<number>(1)
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Touch tracking refs
  const pinchStartDistRef = useRef<number | null>(null)
  const pinchStartScaleRef = useRef<number>(1)
  const pinchStartMidpointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const pinchStartPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 })
  const touchStartRef = useRef<{ x: number; y: number; time: number; moved: boolean }>({
    x: 0,
    y: 0,
    time: 0,
    moved: false,
  })

  // Keep ref sync with state for instantaneous event callbacks
  scaleRef.current = scale
  positionRef.current = position

  // Determines whether click/tap coordinate falls in empty space outside image
  const isPointOutsideImage = useCallback((clientX: number, clientY: number) => {
    if (!imgRef.current) return true
    const rect = imgRef.current.getBoundingClientRect()
    return (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    )
  }, [])

  // Clamps translation so image can be panned naturally within bounds
  const clampPosition = useCallback((x: number, y: number, currentScale: number) => {
    if (currentScale <= 1.02) return { x: 0, y: 0 }

    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img) return { x, y }

    const containerRect = container.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()

    // Base unscaled image dimensions
    const baseW = imgRect.width / currentScale
    const baseH = imgRect.height / currentScale

    const scaledW = baseW * currentScale
    const scaledH = baseH * currentScale

    // Maximum translation allowed in each axis
    const maxX = Math.max(0, (scaledW - containerRect.width) / 2 + 40)
    const maxY = Math.max(0, (scaledH - containerRect.height) / 2 + 40)

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }, [])

  // Calculate focal zoom coordinates so zooming zooms toward the user's focus point
  const getFocalPosition = useCallback(
    (
      currentPos: { x: number; y: number },
      currentScale: number,
      nextScale: number,
      focalX: number,
      focalY: number
    ) => {
      if (nextScale <= 1.02) return { x: 0, y: 0 }

      const container = containerRef.current
      if (!container) return currentPos

      const rect = container.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      const relX = focalX - cx
      const relY = focalY - cy
      const ratio = nextScale / currentScale

      const newX = relX - (relX - currentPos.x) * ratio
      const newY = relY - (relY - currentPos.y) * ratio

      return clampPosition(newX, newY, nextScale)
    },
    [clampPosition]
  )

  const resetZoom = useCallback(() => {
    setIsInteracting(false)
    isDraggingRef.current = false
    scaleRef.current = 1
    positionRef.current = { x: 0, y: 0 }
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  // Reset transforms whenever opened or image changes
  useEffect(() => {
    if (isOpen) {
      resetZoom()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, imageUrl, resetZoom])

  // Keyboard shortcut (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Mouse pan handling (Desktop)
  const handleMouseDown = (e: ReactMouseEvent) => {
    hasDraggedRef.current = false
    dragStartPosRef.current = { x: e.clientX, y: e.clientY }

    if (scaleRef.current <= 1.02) return
    isDraggingRef.current = true
    setIsInteracting(true)
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    }
  }

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (Math.hypot(e.clientX - dragStartPosRef.current.x, e.clientY - dragStartPosRef.current.y) > 5) {
      hasDraggedRef.current = true
    }
    if (!isDraggingRef.current || scaleRef.current <= 1.02) return
    const newX = e.clientX - dragStartRef.current.x
    const newY = e.clientY - dragStartRef.current.y
    const clamped = clampPosition(newX, newY, scaleRef.current)
    positionRef.current = clamped
    setPosition(clamped)
  }

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      setIsInteracting(false)
    }
  }

  // Click handler to dismiss when clicking empty area outside image
  const handleClick = (e: ReactMouseEvent) => {
    if (hasDraggedRef.current) return
    if (isPointOutsideImage(e.clientX, e.clientY)) {
      onClose()
    }
  }

  // Smooth wheel zoom (Desktop & Trackpad)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setIsInteracting(true)

    const currentScale = scaleRef.current
    const currentPos = positionRef.current

    // Smooth proportional zoom factor based on deltaY
    const zoomFactor = Math.exp(-e.deltaY * 0.003)
    const nextScale = Math.min(5, Math.max(1, Math.round(currentScale * zoomFactor * 100) / 100))

    if (nextScale <= 1.02) {
      resetZoom()
    } else {
      const nextPos = getFocalPosition(currentPos, currentScale, nextScale, e.clientX, e.clientY)
      scaleRef.current = nextScale
      positionRef.current = nextPos
      setScale(nextScale)
      setPosition(nextPos)
    }

    // Debounced release to restore smooth transition
    clearTimeout((handleWheel as any)._timeout)
    ;(handleWheel as any)._timeout = setTimeout(() => {
      setIsInteracting(false)
    }, 140)
  }

  // Touch handlers (Mobile pinch-to-zoom & fluid panning)
  const getTouchDist = (t1: React.Touch, t2: React.Touch) => {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
  }

  const handleTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers: Pinch to zoom
      const t1 = e.touches[0]!
      const t2 = e.touches[1]!
      pinchStartDistRef.current = getTouchDist(t1, t2)
      pinchStartScaleRef.current = scaleRef.current
      pinchStartMidpointRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
      pinchStartPositionRef.current = { ...positionRef.current }
      setIsInteracting(true)
      isDraggingRef.current = false
    } else if (e.touches.length === 1) {
      const t = e.touches[0]!
      touchStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        time: Date.now(),
        moved: false,
      }
      if (scaleRef.current > 1.02) {
        // 1 finger pan
        isDraggingRef.current = true
        setIsInteracting(true)
        dragStartRef.current = {
          x: t.clientX - positionRef.current.x,
          y: t.clientY - positionRef.current.y,
        }
      }
    }
  }

  const handleTouchMove = (e: ReactTouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current && pinchStartDistRef.current > 0) {
      // Fluid Pinch Zooming
      const t1 = e.touches[0]!
      const t2 = e.touches[1]!
      const currentDist = getTouchDist(t1, t2)
      const ratio = currentDist / pinchStartDistRef.current

      const newScale = Math.min(
        5,
        Math.max(0.9, Math.round(pinchStartScaleRef.current * ratio * 100) / 100)
      )

      const midX = (t1.clientX + t2.clientX) / 2
      const midY = (t1.clientY + t2.clientY) / 2
      const panDeltaX = midX - pinchStartMidpointRef.current.x
      const panDeltaY = midY - pinchStartMidpointRef.current.y

      const focalPos = getFocalPosition(
        pinchStartPositionRef.current,
        pinchStartScaleRef.current,
        newScale,
        pinchStartMidpointRef.current.x,
        pinchStartMidpointRef.current.y
      )

      const combinedPos = clampPosition(
        focalPos.x + panDeltaX,
        focalPos.y + panDeltaY,
        newScale
      )

      scaleRef.current = newScale
      positionRef.current = combinedPos
      setScale(newScale)
      setPosition(combinedPos)
    } else if (e.touches.length === 1) {
      const t = e.touches[0]!
      if (Math.hypot(t.clientX - touchStartRef.current.x, t.clientY - touchStartRef.current.y) > 8) {
        touchStartRef.current.moved = true
      }
      if (isDraggingRef.current && scaleRef.current > 1.02) {
        // 1 finger Dragging
        const newX = t.clientX - dragStartRef.current.x
        const newY = t.clientY - dragStartRef.current.y
        const clamped = clampPosition(newX, newY, scaleRef.current)
        positionRef.current = clamped
        setPosition(clamped)
      }
    }
  }

  const handleTouchEnd = (e: ReactTouchEvent) => {
    pinchStartDistRef.current = null
    isDraggingRef.current = false
    setIsInteracting(false)

    // Snap back to 1 if pinched below threshold
    if (scaleRef.current < 1.05) {
      resetZoom()
      return
    }

    // Check tap on empty space outside image or double tap
    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0]!

      // Single tap on empty space closes the image viewer
      if (!touchStartRef.current.moved && isPointOutsideImage(t.clientX, t.clientY)) {
        onClose()
        return
      }

      const now = Date.now()
      const prev = lastTapRef.current
      const distFromPrev = Math.hypot(t.clientX - prev.x, t.clientY - prev.y)

      if (now - prev.time < 300 && distFromPrev < 35) {
        // Double tap confirmed
        lastTapRef.current = { time: 0, x: 0, y: 0 }
        if (scaleRef.current > 1.1) {
          resetZoom()
        } else {
          // Zoom into double-tapped point smoothly
          const targetScale = 2.6
          const targetPos = getFocalPosition(
            { x: 0, y: 0 },
            1,
            targetScale,
            t.clientX,
            t.clientY
          )
          scaleRef.current = targetScale
          positionRef.current = targetPos
          setScale(targetScale)
          setPosition(targetPos)
        }
      } else {
        lastTapRef.current = { time: now, x: t.clientX, y: t.clientY }
      }
    }
  }

  // Desktop double-click to zoom in/out smoothly at click coordinate
  const handleDoubleClick = (e: ReactMouseEvent) => {
    setIsInteracting(false)
    isDraggingRef.current = false
    if (scaleRef.current > 1.1) {
      resetZoom()
    } else {
      const targetScale = 2.6
      const targetPos = getFocalPosition(
        { x: 0, y: 0 },
        1,
        targetScale,
        e.clientX,
        e.clientY
      )
      scaleRef.current = targetScale
      positionRef.current = targetPos
      setScale(targetScale)
      setPosition(targetPos)
    }
  }

  if (!isOpen) return null

  return (
    <HeroUIModal.Root isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <HeroUIModal.Backdrop
        isDismissable
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-0 select-none animate-backdrop-enter"
      >
        <HeroUIModal.Container className="pointer-events-none w-full h-full p-0 flex items-center justify-center">
          <HeroUIModal.Dialog className="pointer-events-auto relative w-full h-full max-w-none flex items-center justify-center animate-modal-enter !bg-transparent !shadow-none !border-0 !p-0 overflow-hidden">
            {/* Sleek Floating Close Button inside Dialog */}
            <HeroUIModal.CloseTrigger
              onClick={onClose}
              aria-label="بستن بزرگ‌نمایی"
              className="fixed top-4 inset-e-4 z-100 size-11 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all cursor-pointer shadow-2xl pointer-events-auto"
            >
              <XIcon size={20} />
            </HeroUIModal.CloseTrigger>

            {/* Interactive Image Container */}
            <div
              ref={containerRef}
              className={`relative w-full h-full flex items-center justify-center overflow-hidden touch-none select-none ${
                scale > 1.02 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              }`}
              onClick={handleClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDoubleClick={handleDoubleClick}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt={title}
                draggable={false}
                className="max-w-[92vw] max-h-[86vh] w-auto h-auto object-contain rounded-2xl select-none pointer-events-none will-change-transform drop-shadow-2xl"
                style={{
                  transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isInteracting
                    ? 'none'
                    : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </HeroUIModal.Dialog>
        </HeroUIModal.Container>
      </HeroUIModal.Backdrop>
    </HeroUIModal.Root>
  )
}
