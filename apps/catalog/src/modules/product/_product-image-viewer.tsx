import { useCallback, useMemo, useRef, useState } from 'react'
import { Modal } from '@heroui/react'
import Lightbox, {
  type ControllerRef,
  type ZoomRef,
} from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import { ProductImageWatermark } from '@/components/product-image-watermark'
import { toPersianDigits } from '@/lib/format'
import type { GalleryMediaItem } from './_product-gallery-carousel'
import { useGalleryReducedMotion } from './_use-gallery-autoplay'
import {
  ProductViewerPhoto,
  type ViewerPhotoBounds,
} from './_product-viewer-photo'
import 'yet-another-react-lightbox/styles.css'
import './_product-image-viewer.css'

interface ProductPhotoSlide {
  type: 'catalog-photo'
  item: GalleryMediaItem
  alt: string
}

declare module 'yet-another-react-lightbox' {
  interface SlideTypes {
    'catalog-photo': ProductPhotoSlide
  }
}

interface ProductImageViewerProps {
  items: GalleryMediaItem[]
  initialIndex: number
  productName: string
  showWatermark: boolean
  onClose: (item: GalleryMediaItem) => void
}

const plugins = [Zoom]
const labels = {
  Lightbox: 'نمایشگر تصاویر محصول',
  Close: 'بستن بزرگ‌نمایی',
  Previous: 'تصویر قبلی',
  Next: 'تصویر بعدی',
  'Zoom in': 'بزرگ‌نمایی بیشتر',
  'Zoom out': 'بزرگ‌نمایی کمتر',
}

export function ProductImageViewer({
  items,
  initialIndex,
  productName,
  showWatermark,
  onClose,
}: ProductImageViewerProps) {
  const reducedMotion = useGalleryReducedMotion()
  const [index, setIndex] = useState(initialIndex)
  const currentIndex = useRef(initialIndex)
  const [readyUrl, setReadyUrl] = useState<string | null>(null)
  const bounds = useRef<(ViewerPhotoBounds & { url: string }) | null>(null)
  const zoomState = useRef<ZoomRef | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const portal = useRef<HTMLDivElement>(null)
  const controller = useRef<ControllerRef>(null)
  const slides = useMemo<ProductPhotoSlide[]>(
    () =>
      items.map((item) => ({
        type: 'catalog-photo',
        item,
        alt: productName + '، ' + item.label,
      })),
    [items, productName],
  )

  const paintWatermark = useCallback(() => {
    const badge = overlay.current
    if (!badge) return
    const photo = bounds.current
    if (!photo) {
      badge.hidden = true
      return
    }
    const { zoom = 1, offsetX = 0, offsetY = 0 } = zoomState.current ?? {}
    // Zoom applies scale to the translation. The badge stays outside that transform.
    const left = Math.max(
      0,
      (photo.viewportWidth - photo.width * zoom) / 2 + offsetX * zoom,
    )
    const top = Math.max(
      0,
      (photo.viewportHeight - photo.height * zoom) / 2 + offsetY * zoom,
    )
    badge.style.setProperty('--photo-left', left + 'px')
    badge.style.setProperty('--photo-top', top + 'px')
    badge.hidden = false
  }, [])

  const trackZoom = useCallback(
    (zoom: ZoomRef | null) => {
      if (!zoom) return
      zoomState.current = zoom
      paintWatermark()
    },
    [paintWatermark],
  )

  const trackPhoto = useCallback(
    (url: string, fit: ViewerPhotoBounds) => {
      bounds.current = { ...fit, url }
      paintWatermark()
      setReadyUrl(url)
    },
    [paintWatermark],
  )

  const clearPhoto = useCallback(
    (url: string) => {
      if (bounds.current?.url !== url) return
      bounds.current = null
      paintWatermark()
      setReadyUrl((current) => (current === url ? null : current))
    },
    [paintWatermark],
  )

  const lightbox = (
    <Lightbox
      open
      close={() => {
        const item = items[currentIndex.current]
        if (item) onClose(item)
      }}
      index={initialIndex}
      slides={slides}
      plugins={plugins}
      labels={labels}
      className="product-viewer"
      animation={
        reducedMotion
          ? { fade: 0, swipe: 0, navigation: 0, zoom: 0 }
          : { fade: 150, swipe: 280, navigation: 220, zoom: 180 }
      }
      carousel={{ finite: true, padding: 0, preload: 1, imageFit: 'contain' }}
      noScroll={{ disabled: true }}
      portal={{
        root: () => portal.current,
        container: {
          dir: 'rtl',
          role: 'presentation',
          'aria-modal': undefined,
          'aria-label': undefined,
        },
      }}
      controller={{
        ref: controller,
        closeOnEscape: false,
        closeOnBackdropClick: false,
        closeOnPullDown: false,
        closeOnPullUp: false,
        disableSwipeNavigation: items.length === 1,
      }}
      zoom={{
        ref: trackZoom,
        supports: ['catalog-photo'],
        maxZoom: (slide) =>
          slide.type === 'catalog-photo' && readyUrl === slide.item.url ? 4 : 1,
      }}
      on={{
        view: ({ index: next }) => {
          currentIndex.current = next
          setIndex(next)
        },
      }}
      render={{
        ...(items.length === 1 && {
          buttonPrev: () => null,
          buttonNext: () => null,
        }),
        slide: ({ slide, offset, rect }) =>
          slide.type === 'catalog-photo' ? (
            <ProductViewerPhoto
              key={slide.item.url}
              item={slide.item}
              alt={slide.alt}
              active={offset === 0}
              rect={rect}
              onReady={trackPhoto}
              onInactive={clearPhoto}
            />
          ) : null,
        controls: () => (
          <>
            {items.length > 1 && (
              <div
                className="product-viewer__counter"
                role="status"
                aria-atomic="true"
              >
                {toPersianDigits(index + 1)} از {toPersianDigits(items.length)}
              </div>
            )}
            {showWatermark && (
              <div
                className="product-viewer__watermark"
                ref={(element) => {
                  overlay.current = element
                  paintWatermark()
                }}
                hidden
              >
                <ProductImageWatermark />
              </div>
            )}
          </>
        ),
      }}
    />
  )

  // The modal owns focus and scroll locking; the lightbox owns image navigation.
  return (
    <Modal.Root
      isOpen
      onOpenChange={(open) => {
        if (!open) controller.current?.close()
      }}
    >
      <Modal.Backdrop isDismissable={false} className="product-viewer-backdrop">
        <Modal.Container className="product-viewer-container">
          <Modal.Dialog
            aria-label={labels.Lightbox}
            className="product-viewer-dialog"
          >
            <div ref={portal} className="product-viewer-portal">
              {lightbox}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
