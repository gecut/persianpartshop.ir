import { useLayoutEffect, useState } from "react"
import type { ContainerRect } from "yet-another-react-lightbox"
import { productImageCors } from "@/modules/catalog/product-image-cors"
import type { GalleryMediaItem } from "./_product-gallery"
import { galleryPlaceholder } from "./_use-gallery-media"

type ImageStatus = "retry" | "failed" | { width: number; height: number; withoutCors: boolean }

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
  online: boolean
  rect: ContainerRect
  onReady: (url: string, bounds: ViewerPhotoBounds) => void
  onInactive: (url: string) => void
}

export function ProductViewerPhoto({ item, alt, active, online, rect, onReady, onInactive }: ViewerPhotoProps) {
  const [images, setImages] = useState<ReadonlyMap<string, ImageStatus>>(() => new Map())
  const preview = online && item.previewUrl !== item.url ? item.previewUrl : undefined
  const previewStatus = preview ? images.get(preview) : undefined
  const originalStatus = images.get(item.url)
  const originalReady = typeof originalStatus === "object"
  const previewReady = typeof previewStatus === "object"
  const visible = active && originalReady ? originalStatus : previewReady ? previewStatus : undefined
  const failed = active && originalStatus === "failed" && (!preview || previewStatus === "failed")
  const ratio = visible ? visible.width / visible.height : item.ratio || 1
  const width = Math.min(Math.max(1, rect.width - 24), Math.max(1, rect.height - 112) * ratio)
  const height = width / ratio

  useLayoutEffect(() => {
    if (active && visible) {
      onReady(item.url, { width, height, viewportWidth: rect.width, viewportHeight: rect.height })
      return () => onInactive(item.url)
    }
  }, [active, height, item.url, onInactive, onReady, rect.height, rect.width, visible, width])

  function photo(src: string, status: ImageStatus | undefined, shown: boolean) {
    const withoutCors = status === "retry" || (typeof status === "object" && status.withoutCors)
    const crossOrigin = withoutCors ? undefined : productImageCors(src)
    return (
      <img
        key={src + (crossOrigin ?? "")}
        src={src}
        crossOrigin={crossOrigin}
        alt={shown ? alt : ""}
        aria-hidden={!shown || undefined}
        className="product-viewer__image"
        style={{ visibility: shown ? "visible" : "hidden" }}
        draggable={false}
        decoding="async"
        onLoad={async ({ currentTarget: image }) => {
          if (!image.naturalWidth || !image.naturalHeight) return
          const { naturalWidth, naturalHeight } = image
          await image.decode().catch(() => {})
          if (!image.isConnected) return
          setImages(previous => typeof previous.get(src) === "object" ? previous : new Map(previous).set(src, {
            width: naturalWidth,
            height: naturalHeight,
            withoutCors,
          }))
        }}
        onError={() => {
          const next = crossOrigin ? "retry" : "failed"
          setImages(previous => previous.get(src) === next ? previous : new Map(previous).set(src, next))
        }}
      />
    )
  }

  return (
    <div className="product-viewer__photo" style={{ width, height }}>
      {preview && previewStatus !== "failed" && photo(preview, previewStatus, previewReady && !(active && originalReady))}
      {active && originalStatus !== "failed" && photo(item.url, originalStatus, originalReady)}
      {failed && (
        <div className="product-viewer__message" role="status">
          <img src={galleryPlaceholder} alt="" />
          <span>تصویر در دسترس نیست</span>
        </div>
      )}
      {active && !visible && !failed && <span className="product-viewer__message" role="status">در حال بارگذاری تصویر…</span>}
    </div>
  )
}
