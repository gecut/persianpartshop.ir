import { useCallback, useEffect, useRef, useState } from "react"
import type { ImgHTMLAttributes } from "react"
import type { UseEmblaCarouselType } from "embla-carousel-react"
import { useNetworkReadSource } from "@/modules/pwa/read-source"
import { productImageCors } from "@/modules/catalog/product-image-cors"
import type { GalleryMediaItem } from "./_product-gallery"
import {
  emptyGalleryQueue,
  galleryQueueTimeoutMs,
  markTimedOut,
  nextBackgroundUrl,
  pendingUrls,
  startUrls,
} from "./_gallery-queue"

type Carousel = UseEmblaCarouselType[1]
type AssetState = "loaded" | "loaded-without-cors" | "retry" | "failed"
export const galleryPlaceholder = "/assets/images/placeholder.svg"

function includeUrls(previous: ReadonlySet<string>, urls: string[]) {
  return urls.every(url => previous.has(url)) ? previous : new Set([...previous, ...urls])
}

export function useGalleryMedia(
  items: readonly GalleryMediaItem[],
  main: Carousel,
  thumbs: Carousel,
  isOpen: boolean,
  selectedIndex: number,
) {
  const online = useNetworkReadSource()
  const [queue, setQueue] = useState(() => emptyGalleryQueue(""))
  const [thumbnails, setThumbnails] = useState<ReadonlySet<string>>(() => new Set())
  const [assets, setAssets] = useState<ReadonlyMap<string, AssetState>>(() => new Map())
  const [ratios, setRatios] = useState<ReadonlyMap<string, number>>(() => new Map())
  const measured = useRef(new Map<string, number>())
  const pendingRatios = useRef(new Map<string, number>())
  const frame = useRef(0)
  const timing = useRef({ scope: "", startedAt: new Map<string, number>() })
  const order = items.map(item => item.url)
  // A new product or a closed modal starts an empty queue; events of the old scope are dropped.
  const scope = isOpen ? order.join("\n") : ""
  const live = queue.scope === scope ? queue : emptyGalleryQueue(scope)

  const scheduleRatios = useCallback(() => {
    if (!pendingRatios.current.size || frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if ([main, thumbs].some(api => {
        const engine = api?.internalEngine()
        return engine && (engine.dragHandler.pointerDown() || !engine.scrollBody.settled())
      })) return

      const batch = pendingRatios.current
      pendingRatios.current = new Map()
      setRatios(previous => new Map([...previous, ...batch]))
    })
  }, [main, thumbs])

  useEffect(() => {
    if (!isOpen) return
    const requestThumbnails = () => {
      const urls = (thumbs?.slidesInView() ?? []).flatMap(index => items[index] ? [items[index].url] : [])
      setThumbnails(previous => includeUrls(previous, urls))
    }

    requestThumbnails()
    scheduleRatios()
    thumbs?.on("slidesInView", requestThumbnails).on("reInit", requestThumbnails)
    for (const api of [main, thumbs]) {
      api?.on("reInit", scheduleRatios).on("pointerUp", scheduleRatios).on("settle", scheduleRatios)
    }
    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      thumbs?.off("slidesInView", requestThumbnails).off("reInit", requestThumbnails)
      for (const api of [main, thumbs]) {
        api?.off("reInit", scheduleRatios).off("pointerUp", scheduleRatios).off("settle", scheduleRatios)
      }
    }
  }, [isOpen, items, main, scheduleRatios, thumbs])

  // The selected image always starts at once and stays requested after the user moves on.
  const selectedUrl = items[selectedIndex]?.url
  useEffect(() => {
    if (!isOpen || !selectedUrl) return
    setQueue(previous => startUrls(previous, scope, [selectedUrl]))
  }, [isOpen, scope, selectedUrl])

  // One background image at a time: start the next only after every started request is decided.
  const next = isOpen ? nextBackgroundUrl(order, live, isDone) : null
  useEffect(() => {
    if (next) setQueue(previous => startUrls(previous, scope, [next]))
  }, [next, scope])

  const pending = isOpen ? pendingUrls(order, live, isDone) : []
  const pendingKey = pending.join("\n")
  useEffect(() => {
    if (!pendingKey) return
    if (timing.current.scope !== scope) timing.current = { scope, startedAt: new Map() }
    const { startedAt } = timing.current
    const timers = pendingKey.split("\n").map(url => {
      const begin = startedAt.get(url) ?? Date.now()
      startedAt.set(url, begin)
      return setTimeout(
        () => setQueue(previous => markTimedOut(previous, scope, url)),
        Math.max(0, galleryQueueTimeoutMs - (Date.now() - begin)),
      )
    })
    return () => timers.forEach(clearTimeout)
  }, [pendingKey, scope])

  function isDone(url: string) {
    const item = items.find(candidate => candidate.url === url)
    if (!item) return true
    const source = mainSource(item)
    const state = assets.get(source)
    return state === "loaded" || state === "loaded-without-cors" || (state === "failed" && source === item.url)
  }

  function isLoaded(src: string) {
    return assets.get(src) === "loaded" || assets.get(src) === "loaded-without-cors"
  }

  function mainSource(item: GalleryMediaItem) {
    return online && item.previewUrl && assets.get(item.previewUrl) !== "failed" ? item.previewUrl : item.url
  }

  function getImageProps(item: GalleryMediaItem, row: "main" | "thumb", index: number): ImgHTMLAttributes<HTMLImageElement> {
    const primary = isOpen && row === "main" && index === selectedIndex
    const requested = row === "main"
      ? (isOpen && (index === selectedIndex || live.started.has(item.url))) || isLoaded(mainSource(item))
      : thumbnails.has(item.url)
    if (!requested) return {}

    const preview = mainSource(item)
    const thumbnail = item.thumbnailUrl
    let src = preview
    if (row === "thumb") {
      src = !online ? item.url
        : thumbnail && assets.get(thumbnail) !== "failed" ? thumbnail
          : isLoaded(preview) ? preview : galleryPlaceholder
    }
    if (assets.get(src) === "failed") src = galleryPlaceholder
    if (!isOpen && !isLoaded(src) && src !== galleryPlaceholder) return {}
    const status = assets.get(src)
    const placeholder = src === galleryPlaceholder
    const crossOrigin = placeholder || status === "retry" || status === "loaded-without-cors" ? undefined : productImageCors(src)
    return {
      src,
      crossOrigin,
      fetchPriority: primary && !placeholder ? "high" : undefined,
      decoding: "async",
      draggable: false,
      onLoad: ({ currentTarget: image }) => {
        if (placeholder || !image.naturalWidth || !image.naturalHeight) return
        const loaded = status === "retry" || status === "loaded-without-cors" ? "loaded-without-cors" : "loaded"
        setAssets(previous => previous.get(src) === loaded ? previous : new Map(previous).set(src, loaded))
        if (item.ratio || measured.current.has(item.url)) return
        const ratio = image.naturalWidth / image.naturalHeight
        measured.current.set(item.url, ratio)
        pendingRatios.current.set(item.url, ratio)
        scheduleRatios()
      },
      onError: () => {
        if (placeholder) return
        setAssets(previous => {
          const current = previous.get(src)
          if (current === "failed" || (crossOrigin && current === "retry")) return previous
          return new Map(previous).set(src, crossOrigin ? "retry" : "failed")
        })
      },
    }
  }

  return {
    getRatio: (item: GalleryMediaItem) => item.ratio ?? ratios.get(item.url) ?? 1,
    canZoom: (item: GalleryMediaItem) => isOpen && isLoaded(mainSource(item)),
    getImageProps,
  }
}
