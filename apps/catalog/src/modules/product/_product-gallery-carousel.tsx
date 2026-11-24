import type { BlurCss } from '@persianpart/contract'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ProductImageWatermark } from '@/components/product-image-watermark'
import { toPersianDigits } from '@/lib/format'
import {
  createGalleryAutoplay,
  useGalleryAutoplay,
  useGalleryReducedMotion,
} from './_use-gallery-autoplay'
import { galleryPlaceholder, useGalleryMedia } from './_use-gallery-media'
import './_product-gallery.css'

export interface GalleryMediaItem {
  blurCSS?: BlurCss
  ratio?: number
  thumbnailUrl?: string
  previewUrl?: string
  id?: string
  url: string
  label: string
}

interface ProductGalleryProps {
  productName: string
  items: GalleryMediaItem[]
  isOpen: boolean
  isZoomOpen: boolean
  zoomSelection: GalleryMediaItem | null
  showProductImageWatermark: boolean
  onZoom: (url: string) => void
}

function imageRatio(ratio: number): CSSProperties {
  return {
    '--image-ratio': Number.isFinite(ratio) ? ratio : 1,
  } as CSSProperties
}

export function ProductGalleryCarousel({
  productName,
  items,
  isOpen,
  isZoomOpen,
  zoomSelection,
  showProductImageWatermark,
  onZoom,
}: ProductGalleryProps) {
  const multiple = items.length > 1
  const reducedMotion = useGalleryReducedMotion()
  const autoplay = useMemo(createGalleryAutoplay, [])
  const [mainRef, main] = useEmblaCarousel(
    {
      direction: 'rtl',
      align: 'center',
      containScroll: false,
      loop: multiple,
      watchDrag: multiple,
      watchFocus: false,
      watchSlides: false,
    },
    multiple ? [autoplay] : [],
  )
  const [thumbRef, thumbs] = useEmblaCarousel({
    direction: 'rtl',
    align: 'center',
    containScroll: 'keepSnaps',
    dragFree: true,
    watchSlides: false,
  })
  const [selection, setSelection] = useState(items[0])
  const [announcement, setAnnouncement] = useState('')
  const activePhoto = useRef<HTMLButtonElement>(null)
  const photoLosingSelection = useRef<Element | null>(null)
  const zoomWasOpen = useRef(false)
  const urls = useMemo(() => items.map((item) => item.url), [items])
  const indexById = selection?.id
    ? items.findIndex((item) => item.id === selection.id)
    : -1
  const selectedIndex =
    indexById >= 0 ? indexById : Math.max(0, urls.indexOf(selection?.url ?? ''))
  const { getRatio, canZoom, getImageProps } = useGalleryMedia(
    items,
    main,
    thumbs,
    isOpen,
    selectedIndex,
  )
  const pauseForSelection = useGalleryAutoplay(
    main,
    thumbs,
    isOpen && !isZoomOpen && multiple,
    reducedMotion,
  )

  useLayoutEffect(() => {
    if (!multiple || !main) {
      setSelection((current) => {
        const item = items[selectedIndex]
        return current?.id === item?.id && current?.url === item?.url
          ? current
          : item
      })
      return
    }
    // Reconcile the committed slide nodes before Embla can reuse a stale index.
    for (const carousel of [thumbs, main]) {
      if (!carousel) continue
      const slides = carousel.slideNodes()
      const children = carousel.containerNode().children
      if (
        slides.length !== children.length ||
        slides.some((slide, index) => slide !== children[index])
      ) {
        carousel.reInit({ startIndex: selectedIndex })
      }
    }
    if (main.selectedScrollSnap() !== selectedIndex)
      main.scrollTo(selectedIndex, true)
  }, [items, main, multiple, selectedIndex, thumbs])

  useLayoutEffect(() => {
    if (!main || !multiple) return
    let frame = 0
    let syncPending = true
    const syncThumbs = () => {
      if (!thumbs || !syncPending) return
      const mainEngine = main.internalEngine()
      const thumbEngine = thumbs.internalEngine()
      if (
        mainEngine.dragHandler.pointerDown() ||
        !mainEngine.scrollBody.settled() ||
        thumbEngine.dragHandler.pointerDown() ||
        !thumbEngine.scrollBody.settled()
      )
        return
      syncPending = false
      const index = main.selectedScrollSnap()
      if (!thumbs.slidesInView().includes(index)) thumbs.scrollTo(index, true)
    }
    const scheduleThumbs = () => {
      if (!syncPending) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncThumbs)
    }
    const syncSelection = () => {
      const index = main.selectedScrollSnap()
      const item = items[index]
      if (!item) return
      const focused = main.rootNode().ownerDocument.activeElement
      if (
        focused === activePhoto.current &&
        focused !== main.slideNodes()[index]?.firstElementChild
      ) {
        photoLosingSelection.current = focused
      }
      setSelection((current) =>
        current?.id === item.id && current?.url === item.url ? current : item,
      )
      syncPending = true
      scheduleThumbs()
    }
    const onSelect = () => {
      syncSelection()
      if (main.plugins()?.autoplay?.isPlaying()) {
        setAnnouncement('')
        return
      }
      const index = main.selectedScrollSnap()
      const item = items[index]
      if (item)
        setAnnouncement(`${item.label} از ${toPersianDigits(items.length)}`)
    }
    syncSelection()
    main
      .on('select', onSelect)
      .on('reInit', syncSelection)
      .on('settle', scheduleThumbs)
      .on('pointerUp', scheduleThumbs)
    thumbs
      ?.on('slidesInView', scheduleThumbs)
      .on('settle', scheduleThumbs)
      .on('pointerUp', scheduleThumbs)
    return () => {
      cancelAnimationFrame(frame)
      main
        .off('select', onSelect)
        .off('reInit', syncSelection)
        .off('settle', scheduleThumbs)
        .off('pointerUp', scheduleThumbs)
      thumbs
        ?.off('slidesInView', scheduleThumbs)
        .off('settle', scheduleThumbs)
        .off('pointerUp', scheduleThumbs)
    }
  }, [items, main, multiple, thumbs])

  useLayoutEffect(() => {
    const previous = photoLosingSelection.current
    photoLosingSelection.current = null
    if (
      previous &&
      !isZoomOpen &&
      previous.ownerDocument.activeElement === previous
    ) {
      activePhoto.current?.focus({ preventScroll: true })
    }
  }, [isZoomOpen, selectedIndex])

  useLayoutEffect(() => {
    const wasOpen = zoomWasOpen.current
    zoomWasOpen.current = isZoomOpen
    if (!wasOpen || isZoomOpen || !isOpen) return
    const indexById = zoomSelection?.id
      ? items.findIndex((item) => item.id === zoomSelection.id)
      : -1
    const indexByUrl = items.findIndex(
      (item) => item.url === zoomSelection?.url,
    )
    const index = indexById >= 0 ? indexById : Math.max(indexByUrl, 0)
    setSelection(items[index])
    main?.scrollTo(index, true)
    const frame = requestAnimationFrame(() =>
      activePhoto.current?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [isOpen, isZoomOpen, items, main, zoomSelection])

  const selected = items[selectedIndex]
  if (!selected) return null

  return (
    <section
      dir="rtl"
      aria-label="تصاویر محصول"
      aria-roledescription={multiple ? 'گالری چرخشی' : undefined}
      className="product-gallery space-y-2"
    >
      <div
        ref={multiple ? mainRef : undefined}
        data-multiple={multiple || undefined}
        className="product-gallery__stage overflow-clip"
      >
        <div className="product-gallery__track">
          {items.map((item, index) => {
            const active = selectedIndex === index
            const imageProps = getImageProps(item, 'main', index)
            const loaded = canZoom(item)
            const zoomable = active && loaded

            return (
              <div
                key={item.id ? `media:${item.id}` : item.url}
                aria-hidden={!active || undefined}
                className="product-gallery__slide"
                style={imageRatio(getRatio(item))}
              >
                <button
                  ref={active ? activePhoto : undefined}
                  type="button"
                  tabIndex={zoomable ? 0 : -1}
                  aria-disabled={!zoomable || undefined}
                  aria-label={`بزرگ‌نمایی ${item.label}`}
                  onMouseDown={(event) => {
                    // Keep focus out of slides that can move out of view during a drag.
                    if (event.button === 0) event.preventDefault()
                  }}
                  onClick={(event) => {
                    if (!zoomable) return
                    event.currentTarget.focus({ preventScroll: true })
                    pauseForSelection()
                    onZoom(item.url)
                  }}
                  className={`product-gallery__frame rounded-2xl bg-muted/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${zoomable ? 'cursor-zoom-in' : ''}`}
                >
                  {item.blurCSS && !loaded && imageProps.src !== galleryPlaceholder && (
                    <span aria-hidden className="product-gallery__blur" style={item.blurCSS} />
                  )}
                  {imageProps.src && (
                    <img
                      key={`${imageProps.src}:${imageProps.crossOrigin ?? ''}`}
                      {...imageProps}
                      alt={index === 0 ? productName : item.label}
                      className={`pointer-events-none absolute inset-0 size-full select-none ${imageProps.src === galleryPlaceholder ? 'object-contain' : 'object-cover'}`}
                    />
                  )}
                  {showProductImageWatermark && loaded && (
                    <ProductImageWatermark />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {multiple && (
        <div
          ref={thumbRef}
          role="group"
          aria-label="انتخاب تصویر"
          className="mx-auto max-w-lg overflow-clip px-1 py-1"
        >
          <div className="product-gallery__track">
            {items.map((item, index) => {
              const active = selectedIndex === index
              const imageProps = getImageProps(item, 'thumb', index)
              return (
                <div
                  key={item.id ? `media:${item.id}` : item.url}
                  className="product-gallery__thumb"
                  style={imageRatio(getRatio(item))}
                >
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
                        <img
                          key={`${imageProps.src}:${imageProps.crossOrigin ?? ''}`}
                          {...imageProps}
                          alt=""
                          className="size-full select-none object-cover"
                        />
                      )}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {multiple && (
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      )}
    </section>
  )
}
