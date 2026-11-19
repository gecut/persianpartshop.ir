import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseEmblaCarouselType } from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

export function useGalleryReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(reducedMotionQuery)
    const sync = () => setReduced(query.matches)
    query.addEventListener('change', sync)
    sync()
    return () => query.removeEventListener('change', sync)
  }, [])
  return reduced
}

export function createGalleryAutoplay() {
  return Autoplay({
    delay: 4000,
    playOnInit: false,
    stopOnInteraction: true,
    stopOnFocusIn: false,
    breakpoints: { [reducedMotionQuery]: { active: false } },
  })
}

export function useGalleryAutoplay(
  main: UseEmblaCarouselType[1],
  thumbs: UseEmblaCarouselType[1],
  enabled: boolean,
  reducedMotion: boolean,
) {
  const pause = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!main || !enabled || reducedMotion) return
    const viewport = main.rootNode()
    const section = viewport.closest('section')
    if (!section) return
    const document = viewport.ownerDocument
    const view = document.defaultView
    if (!view) return
    let visible = false
    let pointer: number | null = null
    let frame = 0

    const sync = () => {
      const autoplay = main.plugins()?.autoplay
      if (!autoplay) return
      const focus = document.activeElement
      const keyboardFocus =
        section.contains(focus) && focus?.matches(':focus-visible')
      if (!visible || pointer !== null || document.hidden || keyboardFocus) {
        autoplay.stop()
        return
      }
      if (autoplay.isPlaying() || main.scrollSnapList().length < 2) return
      const moving = [main, thumbs].some(
        (api) => api && !api.internalEngine().scrollBody.settled(),
      )
      if (!moving) autoplay.play()
    }
    const scheduleSync = () => {
      view.cancelAnimationFrame(frame)
      frame = view.requestAnimationFrame(sync)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return
      pointer = event.pointerId
      sync()
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      pointer = null
      scheduleSync()
    }
    const onWindowBlur = () => {
      pointer = null
      scheduleSync()
    }
    const onFocusIn = () => {
      // Focus-visible can change during the browser's default pointer action.
      sync()
      scheduleSync()
    }
    pause.current = () => {
      main.plugins()?.autoplay?.stop()
      scheduleSync()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry && entry.intersectionRatio >= 0.01)
        sync()
      },
      { threshold: 0.01 },
    )

    observer.observe(viewport)
    // Stop before the plugin records whether to resume on tab visibility change.
    document.addEventListener('visibilitychange', sync, true)
    section.addEventListener('pointerdown', onPointerDown, true)
    section.addEventListener('focusin', onFocusIn)
    section.addEventListener('focusout', scheduleSync)
    section.addEventListener('keydown', scheduleSync)
    view.addEventListener('pointerup', onPointerEnd, true)
    view.addEventListener('pointercancel', onPointerEnd, true)
    view.addEventListener('blur', onWindowBlur)
    main.on('settle', sync).on('reInit', scheduleSync)
    thumbs?.on('settle', sync).on('reInit', scheduleSync)
    return () => {
      pause.current = null
      main.plugins()?.autoplay?.stop()
      view.cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync, true)
      section.removeEventListener('pointerdown', onPointerDown, true)
      section.removeEventListener('focusin', onFocusIn)
      section.removeEventListener('focusout', scheduleSync)
      section.removeEventListener('keydown', scheduleSync)
      view.removeEventListener('pointerup', onPointerEnd, true)
      view.removeEventListener('pointercancel', onPointerEnd, true)
      view.removeEventListener('blur', onWindowBlur)
      main.off('settle', sync).off('reInit', scheduleSync)
      thumbs?.off('settle', sync).off('reInit', scheduleSync)
    }
  }, [enabled, main, reducedMotion, thumbs])

  return useCallback(() => pause.current?.(), [])
}
