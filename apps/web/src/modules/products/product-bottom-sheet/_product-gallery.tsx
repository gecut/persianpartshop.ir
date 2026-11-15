import { useLayoutEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ProductImageWatermark } from "@/components/ui/product-image-watermark"
import { toPersianDigits } from "@/lib/utils/currency"
import { createGalleryAutoplay, useGalleryAutoplay, useGalleryReducedMotion } from "./_use-gallery-autoplay"
import { galleryPlaceholder, useGalleryMedia } from "./_use-gallery-media"
import { useGalleryParallax } from "./_use-gallery-parallax"
import "./_product-gallery.css"

export interface GalleryMediaItem {
  id?: string
  url: string
  label: string
}

interface ProductGalleryProps {
  productName: string
  items: GalleryMediaItem[]
  isOpen: boolean
  isZoomOpen: boolean
  showProductImageWatermark: boolean
  onZoom: (url: string) => void
}

function frameRatio(ratio: number, min: number, max: number): CSSProperties {
  return { "--frame-ratio": Math.min(max, Math.max(min, ratio)) } as CSSProperties
}

export function ProductGallery({ productName, items, isOpen, isZoomOpen, showProductImageWatermark, onZoom }: ProductGalleryProps) {
  const multiple = items.length > 1
  const reducedMotion = useGalleryReducedMotion()
  const autoplay = useMemo(createGalleryAutoplay, [])
  const [mainRef, main] = useEmblaCarousel({
    direction: "rtl",
    align: "center",
    containScroll: false,
    loop: multiple,
    watchDrag: multiple,
    watchFocus: false,
    watchSlides: false,
  }, multiple ? [autoplay] : [])
  const [thumbRef, thumbs] = useEmblaCarousel({
    direction: "rtl",
    align: "center",
    containScroll: "keepSnaps",
    dragFree: true,
    watchSlides: false,
  })
  const [selection, setSelection] = useState(items[0])
  const [announcement, setAnnouncement] = useState("")
  const activePhoto = useRef<HTMLButtonElement>(null)
  const photoLosingSelection = useRef<Element | null>(null)
  const zoomWasOpen = useRef(false)
  const urls = useMemo(() => items.map(item => item.url), [items])
  const indexById = selection?.id ? items.findIndex(item => item.id === selection.id) : -1
  const selectedIndex = indexById >= 0 ? indexById : Math.max(0, urls.indexOf(selection?.url ?? ""))
  const { images, getImageProps } = useGalleryMedia(urls, main, thumbs, isOpen)
  const pauseForSelection = useGalleryAutoplay(main, thumbs, isOpen && !isZoomOpen && multiple, reducedMotion)
  useGalleryParallax(main, isOpen && multiple && !reducedMotion)

  useLayoutEffect(() => {
    if (!multiple || !main) {
      setSelection(current => {
        const item = items[selectedIndex]
        return current?.id === item?.id && current?.url === item?.url ? current : item
      })
      return
    }
    // Reconcile the committed slide nodes before Embla can reuse a stale index.
    for (const carousel of [thumbs, main]) {
      if (!carousel) continue
      const slides = carousel.slideNodes()
      const children = carousel.containerNode().children
      if (slides.length !== children.length || slides.some((slide, index) => slide !== children[index])) {
        carousel.reInit({ startIndex: selectedIndex })
      }
    }
    if (main.selectedScrollSnap() !== selectedIndex) main.scrollTo(selectedIndex, true)
  }, [items, main, multiple, selectedIndex, thumbs])

  useLayoutEffect(() => {
    if (!main || !multiple) return
    const syncSelection = (jump = reducedMotion) => {
      const index = main.selectedScrollSnap()
      const item = items[index]
      if (!item) return
      const focused = main.rootNode().ownerDocument.activeElement
      if (focused === activePhoto.current && focused !== main.slideNodes()[index]?.firstElementChild) {
        photoLosingSelection.current = focused
      }
      setSelection(current => current?.id === item.id && current?.url === item.url ? current : item)
      thumbs?.scrollTo(index, jump)
    }
    const onSelect = () => {
      syncSelection()
      if (main.plugins()?.autoplay?.isPlaying()) {
        setAnnouncement("")
        return
      }
      const index = main.selectedScrollSnap()
      const item = items[index]
      if (item) setAnnouncement(`${item.label} از ${toPersianDigits(items.length)}`)
    }
    const syncThumbs = () => thumbs?.scrollTo(main.selectedScrollSnap(), true)
    const onReInit = () => syncSelection(true)
    syncSelection()
    main.on("select", onSelect).on("reInit", onReInit)
    thumbs?.on("reInit", syncThumbs)
    return () => {
      main.off("select", onSelect).off("reInit", onReInit)
      thumbs?.off("reInit", syncThumbs)
    }
  }, [items, main, multiple, reducedMotion, thumbs])

  useLayoutEffect(() => {
    const previous = photoLosingSelection.current
    photoLosingSelection.current = null
    if (previous && !isZoomOpen && previous.ownerDocument.activeElement === previous) {
      activePhoto.current?.focus({ preventScroll: true })
    }
  }, [isZoomOpen, selectedIndex])

  useLayoutEffect(() => {
    const wasOpen = zoomWasOpen.current
    zoomWasOpen.current = isZoomOpen
    if (!wasOpen || isZoomOpen || !isOpen) return
    const frame = requestAnimationFrame(() => activePhoto.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [isOpen, isZoomOpen])

  function canZoom(item: GalleryMediaItem | undefined) {
    if (!item) return false
    const image = images.get(item.url)
    return isOpen && Boolean(image?.ratio) && !image?.failed
  }

  function zoom(item: GalleryMediaItem) {
    if (!canZoom(item)) return
    onZoom(item.url)
  }

  const selected = items[selectedIndex]
  if (!selected) return null

  return (
    <section
      dir="rtl"
      aria-label="تصاویر محصول"
      aria-roledescription={multiple ? "گالری چرخشی" : undefined}
      className="product-gallery space-y-2"
    >
      <div ref={multiple ? mainRef : undefined} data-multiple={multiple || undefined} className="product-gallery__stage overflow-clip">
        <div className="product-gallery__track">
          {items.map((item, index) => {
            const active = selectedIndex === index
            const image = images.get(item.url)
            const imageProps = getImageProps(item.url, isOpen && index === 0 && item.url !== galleryPlaceholder && !image?.failed)
            const zoomable = active && canZoom(item)

            return (
              <div
                key={item.id ? `media:${item.id}` : item.url}
                aria-hidden={!active || undefined}
                className="product-gallery__slide"
                style={frameRatio(image?.ratio ?? 1, 3 / 4, 2)}
              >
                <button
                  ref={active ? activePhoto : undefined}
                  type="button"
                  tabIndex={zoomable ? 0 : -1}
                  aria-disabled={!zoomable || undefined}
                  aria-label={`بزرگ‌نمایی ${item.label}`}
                  onMouseDown={event => {
                    // Keep focus out of slides that can move out of view during a drag.
                    if (event.button === 0) event.preventDefault()
                  }}
                  onClick={event => {
                    if (!zoomable) return
                    event.currentTarget.focus({ preventScroll: true })
                    zoom(item)
                  }}
                  className={`product-gallery__frame rounded-2xl bg-muted/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${zoomable ? "cursor-zoom-in" : ""}`}
                >
                  <span className="product-gallery__photo-layer pointer-events-none">
                    {imageProps.src && (
                      <img
                        key={imageProps.crossOrigin ?? imageProps.src}
                        {...imageProps}
                        alt={index === 0 ? productName : item.label}
                        className={`size-full select-none ${imageProps.src === galleryPlaceholder ? "object-contain" : "object-cover"}`}
                      />
                    )}
                  </span>
                  {showProductImageWatermark && image?.ratio && !image.failed && <ProductImageWatermark />}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {multiple && (
        <div ref={thumbRef} role="group" aria-label="انتخاب تصویر" className="overflow-clip px-1 py-1">
          <div className="product-gallery__track">
            {items.map((item, index) => {
              const active = selectedIndex === index
              const image = images.get(item.url)
              const imageProps = getImageProps(item.url)
              return (
                <div key={item.id ? `media:${item.id}` : item.url} className="product-gallery__thumb" style={frameRatio(image?.ratio ?? 1, 4 / 5, 16 / 9)}>
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-pressed={active}
                    onClick={() => {
                      pauseForSelection()
                      main?.scrollTo(index, reducedMotion)
                    }}
                    className="grid h-12 min-w-11 cursor-pointer place-items-center rounded-xl bg-muted/10 p-0 hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                  >
                    <span className="product-gallery__thumb-frame pointer-events-none rounded-[inherit]">
                      {imageProps.src && (
                        <img key={imageProps.crossOrigin ?? imageProps.src} {...imageProps} alt=""
                          className="size-full select-none object-cover" />
                      )}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {multiple && <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>}
    </section>
  )
}
