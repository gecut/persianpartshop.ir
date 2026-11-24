import { mediaUrl, selectCatalogPhotos, type BlurCss, type CatalogMedia, type CatalogRecord } from "@persianpart/contract"
import { match, P } from "ts-pattern"

const cdnUrl = import.meta.env.VITE_CDN_URL;

export interface GalleryMediaDetails {
  thumbnailUrl?: string
  previewUrl?: string
  ratio?: number
  blurCSS?: BlurCss
}

export function resolveMediaUrl(media: unknown): string {
  return match(media)
    .with(P.string.regex(/^(https?:\/\/|\/)/), (url) => url)
    .with(P.string.includes("."), (filename) =>
      cdnUrl ? `${cdnUrl}/${encodeURIComponent(filename)}` : `/api/media/file/${filename}`
    )
    .with({ url: P.select(P.string.minLength(1)) }, (url) => url)
    .with({ thumbnailURL: P.select(P.string.minLength(1)) }, (thumb) => thumb)
    .with({ filename: P.select(P.string.minLength(1)) }, (filename) =>
      cdnUrl ? `${cdnUrl}/${encodeURIComponent(filename)}` : `/api/media/file/${filename}`
    )
    .with({ image: P.select() }, (img) => resolveMediaUrl(img))
    .otherwise(() => "");
}

export function catalogProductImages(item: Pick<CatalogRecord, 'cover' | 'gallery'>) {
  const { primary, gallery, urls } = selectCatalogPhotos(item, media => mediaUrl(media, cdnUrl))
  const galleryMediaIds: Record<string, string> = {}
  const galleryMediaDetails: Record<string, GalleryMediaDetails> = {}
  for (const { url, id, image } of gallery) {
    if (id !== undefined) galleryMediaIds[url] = id
    if (typeof image === 'object' && image) {
      const thumbnailUrl = image.sizes?.galleryThumb?.url || undefined
      const previewUrl = image.sizes?.galleryPreview?.url || undefined
      const ratio = image.width && image.height && image.width > 0 && image.height > 0 ? image.width / image.height : undefined
      const blurCSS = image.blurCSS ?? undefined
      if (thumbnailUrl || previewUrl || ratio || blurCSS) galleryMediaDetails[url] = { thumbnailUrl, previewUrl, ratio, blurCSS }
    }
  }

  const primaryUrl = primary?.url ?? '/assets/images/placeholder.svg'
  urls.delete(primaryUrl)
  return {
    primary: primaryUrl,
    thumbnailUrl: mediaThumbnailUrl(primary?.image),
    blurCSS: typeof primary?.image === 'object' ? primary.image?.blurCSS ?? undefined : undefined,
    gallery: gallery.map(entry => entry.url),
    galleryMediaIds,
    galleryMediaDetails,
    images: [primaryUrl, ...urls],
  }
}

export function mediaThumbnailUrl(media: CatalogMedia | null | undefined) {
  return typeof media === 'object' ? media?.sizes?.galleryThumb?.url || undefined : undefined
}
