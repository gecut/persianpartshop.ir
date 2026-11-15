import { useEffect } from "react"
import type { UseEmblaCarouselType } from "embla-carousel-react"

export function useGalleryParallax(api: UseEmblaCarouselType[1], enabled: boolean) {
  useEffect(() => {
    if (!api || !enabled) return
    let engine = api.internalEngine()
    let layers: (HTMLElement | null)[] = []
    let visible: number[] = []
    let loopPoints = new Map<number, ReturnType<typeof api.internalEngine>["slideLooper"]["loopPoints"]>()

    const paint = () => {
      const position = engine.offsetLocation.get()
      for (const index of visible) {
        const layer = layers[index]
        if (!layer) continue
        // The loop translates individual slides as well as the track.
        const loopOffset = loopPoints.get(index)?.find(point => point.target() !== 0)?.target() ?? 0
        const distance = engine.axis.direction(engine.scrollSnaps[index] - position - loopOffset)
        const shift = Math.max(-6, Math.min(6, distance * 0.05))
        layer.style.transform = `translateX(${shift}px)`
      }
    }
    const syncVisible = () => {
      visible = api.slidesInView()
      paint()
    }
    const clear = () => {
      for (const layer of layers) layer?.style.removeProperty("transform")
    }
    const refresh = () => {
      clear()
      engine = api.internalEngine()
      layers = api.slideNodes().map(node => node.querySelector<HTMLElement>(".product-gallery__photo-layer"))
      loopPoints = new Map()
      if (engine.options.loop) {
        for (const point of engine.slideLooper.loopPoints) {
          const points = loopPoints.get(point.index) ?? []
          points.push(point)
          loopPoints.set(point.index, points)
        }
      }
      syncVisible()
    }

    refresh()
    api.on("reInit", refresh).on("slidesInView", syncVisible).on("scroll", paint).on("settle", paint)
    return () => {
      api.off("reInit", refresh).off("slidesInView", syncVisible).off("scroll", paint).off("settle", paint)
      clear()
    }
  }, [api, enabled])
}
