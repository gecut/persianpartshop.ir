import { useCallback, useEffect, useRef, useState } from "react"
import type { ImgHTMLAttributes } from "react"
import type { UseEmblaCarouselType } from "embla-carousel-react"
import { productImageCors } from "../_product-image-cors"

type Carousel = UseEmblaCarouselType[1]

interface ImageState {
  ratio?: number
  withoutCors?: boolean
  failed?: boolean
}

export const galleryPlaceholder = "/assets/images/placeholder.svg"

export function useGalleryMedia(
  urls: readonly string[],
  main: Carousel,
  thumbs: Carousel,
  isOpen: boolean,
) {
  const [requested, setRequested] = useState<ReadonlySet<string>>(() => new Set())
  const [images, setImages] = useState<ReadonlyMap<string, ImageState>>(() => new Map())
  const measured = useRef(new Map<string, number>())
  const pendingRatios = useRef(new Map<string, number>())

  const publishRatios = useCallback(() => {
    if (pendingRatios.current.size === 0) return
    const galleries = [main, thumbs]
    if (galleries.some(api => {
      const engine = api?.internalEngine()
      return engine && (engine.dragHandler.pointerDown() || !engine.scrollBody.settled())
    })) return

    const ratios = pendingRatios.current
    pendingRatios.current = new Map()
    setImages(previous => {
      const updated = new Map(previous)
      for (const [url, ratio] of ratios) {
        const image = updated.get(url)
        if (!image?.failed) updated.set(url, { ...image, ratio })
      }
      return updated
    })
  }, [main, thumbs])

  useEffect(() => {
    if (!isOpen) return
    let frame = 0
    const scheduleRatios = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(publishRatios)
    }
    const syncRequests = () => {
      const selected = main?.selectedScrollSnap() ?? 0
      const nearby = new Set([selected])
      for (const index of main?.slidesInView() ?? []) nearby.add(index)
      // Do not mount every full-sized original just because there is a thumbnail.
      for (const index of thumbs?.slidesInView() ?? []) nearby.add(index)
      if (main?.internalEngine().options.loop || selected > 0) {
        nearby.add((selected - 1 + urls.length) % urls.length)
      }
      if (main?.internalEngine().options.loop || selected + 1 < urls.length) {
        nearby.add((selected + 1) % urls.length)
      }
      const visibleUrls = Array.from(nearby, index => urls[index]).filter(Boolean)
      setRequested(previous => {
        if (visibleUrls.every(url => previous.has(url))) return previous
        return new Set([...previous, ...visibleUrls])
      })
    }

    syncRequests()
    scheduleRatios()
    for (const api of [main, thumbs]) {
      api?.on("slidesInView", syncRequests).on("reInit", syncRequests)
        .on("reInit", scheduleRatios).on("pointerUp", scheduleRatios).on("settle", scheduleRatios)
    }
    main?.on("select", syncRequests)
    return () => {
      cancelAnimationFrame(frame)
      for (const api of [main, thumbs]) {
        api?.off("slidesInView", syncRequests).off("reInit", syncRequests)
          .off("reInit", scheduleRatios).off("pointerUp", scheduleRatios).off("settle", scheduleRatios)
      }
      main?.off("select", syncRequests)
    }
  }, [isOpen, main, publishRatios, thumbs, urls])

  function getImageProps(url: string, priority = false): ImgHTMLAttributes<HTMLImageElement> {
    const state = images.get(url)
    const placeholder = url === galleryPlaceholder || state?.failed
    const crossOrigin = placeholder || state?.withoutCors ? undefined : productImageCors(url)
    return {
      crossOrigin,
      src: placeholder ? galleryPlaceholder : priority || requested.has(url) ? url : undefined,
      fetchPriority: priority ? "high" : undefined,
      decoding: "async",
      draggable: false,
      onLoad: ({ currentTarget: image }) => {
        if (placeholder || measured.current.has(url) || !image.naturalWidth || !image.naturalHeight) return
        const ratio = image.naturalWidth / image.naturalHeight
        measured.current.set(url, ratio)
        pendingRatios.current.set(url, ratio)
        publishRatios()
      },
      onError: () => {
        if (placeholder) return
        setImages(previous => {
          const current = previous.get(url)
          if (current?.failed || (crossOrigin && current?.withoutCors)) return previous
          return new Map(previous).set(url, crossOrigin
            ? { ...current, withoutCors: true }
            : { ...current, failed: true })
        })
      },
    }
  }

  return { images, getImageProps }
}
