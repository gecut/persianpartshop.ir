import { useLayoutEffect, useRef, type RefObject } from 'react'

export function useImageWatermarkPosition(
  enabled: boolean,
  stageRef: RefObject<HTMLDivElement | null>,
  imageRef: RefObject<HTMLImageElement | null>,
) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const updateRef = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const image = imageRef.current
    const overlay = overlayRef.current
    const badge = overlay?.firstElementChild
    if (!enabled || !stage || !image || !overlay || !(badge instanceof HTMLElement)) return

    const update = () => {
      const viewport = stage.getBoundingClientRect()
      const photo = image.getBoundingClientRect()
      const scaleX = viewport.width / stage.clientWidth
      const scaleY = viewport.height / stage.clientHeight
      if (!scaleX || !scaleY) return

      // Physical coordinates match the viewport rectangles, including in RTL.
      const left = Math.max(0, photo.left - viewport.left) / scaleX
      const top = Math.max(0, photo.top - viewport.top) / scaleY
      const right = Math.max(0, viewport.right - photo.right) / scaleX
      const bottom = Math.max(0, viewport.bottom - photo.bottom) / scaleY
      overlay.style.inset = `${top}px ${right}px ${bottom}px ${left}px`
      const fits = stage.clientWidth - left - right >= badge.offsetWidth + 12 &&
        stage.clientHeight - top - bottom >= badge.offsetHeight + 12
      overlay.style.visibility = fits ? 'visible' : 'hidden'
    }

    let frame = 0
    const followTransition = () => {
      update()
      frame = requestAnimationFrame(followTransition)
    }
    const startTransition = (event: TransitionEvent) => {
      if (event.propertyName === 'transform' && !frame) frame = requestAnimationFrame(followTransition)
    }
    const stopTransition = (event: TransitionEvent) => {
      if (event.propertyName !== 'transform') return
      cancelAnimationFrame(frame)
      frame = 0
      update()
    }

    const observer = new ResizeObserver(update)
    observer.observe(stage)
    observer.observe(image)
    observer.observe(badge)
    image.addEventListener('transitionrun', startTransition)
    image.addEventListener('transitionend', stopTransition)
    image.addEventListener('transitioncancel', stopTransition)
    // A session refresh can add the overlay during an existing zoom animation.
    if (image.getAnimations().some(animation => animation.playState === 'running')) {
      frame = requestAnimationFrame(followTransition)
    }
    updateRef.current = update

    return () => {
      updateRef.current = null
      observer.disconnect()
      cancelAnimationFrame(frame)
      image.removeEventListener('transitionrun', startTransition)
      image.removeEventListener('transitionend', stopTransition)
      image.removeEventListener('transitioncancel', stopTransition)
    }
  }, [enabled, imageRef, stageRef])

  useLayoutEffect(() => { updateRef.current?.() })
  return overlayRef
}
