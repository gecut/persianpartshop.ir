import { useLayoutEffect, useState } from 'react'
import type { ContainerRect } from 'yet-another-react-lightbox'
import type { GalleryMediaItem } from './_product-gallery-carousel'
import { galleryPlaceholder } from './_use-gallery-media'

type ImageStatus = 'failed' | { width: number; height: number }

export interface ViewerPhotoBounds {
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
}

interface ViewerPhotoProps {
  item: GalleryMediaItem
  alt: string
  active: boolean
  rect: ContainerRect
  onReady: (url: string, bounds: ViewerPhotoBounds) => void
  onInactive: (url: string) => void
}

export function ProductViewerPhoto({
  item,
  alt,
  active,
  rect,
  onReady,
  onInactive,
}: ViewerPhotoProps) {
  const [images, setImages] = useState<ReadonlyMap<string, ImageStatus>>(
    () => new Map(),
  )
  const preview = item.previewUrl !== item.url ? item.previewUrl : undefined
  const previewStatus = preview ? images.get(preview) : undefined
  const originalStatus = images.get(item.url)
  const originalReady = typeof originalStatus === 'object'
  const previewReady = typeof previewStatus === 'object'
  const visible =
    active && originalReady
      ? originalStatus
      : previewReady
        ? previewStatus
        : undefined
  const failed =
    active &&
    originalStatus === 'failed' &&
    (!preview || previewStatus === 'failed')
  const ratio = visible ? visible.width / visible.height : item.ratio || 1
  const width = Math.min(
    Math.max(1, rect.width - 24),
    Math.max(1, rect.height - 112) * ratio,
  )
  const height = width / ratio

  useLayoutEffect(() => {
    if (active && visible) {
      onReady(item.url, {
        width,
        height,
        viewportWidth: rect.width,
        viewportHeight: rect.height,
      })
      return () => onInactive(item.url)
    }
  }, [
    active,
    height,
    item.url,
    onInactive,
    onReady,
    rect.height,
    rect.width,
    visible,
    width,
  ])

  function photo(src: string, shown: boolean) {
    return (
      <img
        key={src}
        src={src}
        alt={shown ? alt : ''}
        aria-hidden={!shown || undefined}
        className="product-viewer__image"
        style={{ visibility: shown ? 'visible' : 'hidden' }}
        draggable={false}
        decoding="async"
        onLoad={async ({ currentTarget: image }) => {
          if (!image.naturalWidth || !image.naturalHeight) return
          const { naturalWidth, naturalHeight } = image
          await image.decode().catch(() => {})
          if (!image.isConnected) return
          setImages((previous) =>
            typeof previous.get(src) === 'object'
              ? previous
              : new Map(previous).set(src, {
                  width: naturalWidth,
                  height: naturalHeight,
                }),
          )
        }}
        onError={() => {
          const next = 'failed'
          setImages((previous) =>
            previous.get(src) === next
              ? previous
              : new Map(previous).set(src, next),
          )
        }}
      />
    )
  }

  return (
    <div className="product-viewer__photo" style={{ width, height }}>
      {preview &&
        previewStatus !== 'failed' &&
        photo(
          preview,
          previewReady && !(active && originalReady),
        )}
      {active &&
        originalStatus !== 'failed' &&
        photo(item.url, originalReady)}
      {failed && (
        <div className="product-viewer__message" role="status">
          <img src={galleryPlaceholder} alt="" />
          <span>تصویر در دسترس نیست</span>
        </div>
      )}
      {active && !visible && !failed && (
        <span className="product-viewer__message" role="status">
          در حال بارگذاری تصویر…
        </span>
      )}
    </div>
  )
}
