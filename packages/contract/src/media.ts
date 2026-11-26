import { z } from 'zod'

const blurCssWords = new Set(['linear-gradient', 'rgb', 'rgba', 'deg'])
const blurCssBounded = (max: number) => z.string().max(max)

/** Four fixed CSS properties of the blurred placeholder; every value is restricted to gradient syntax. */
export const BlurCssSchema = z
  .object({
    backgroundImage: blurCssBounded(4000)
      .regex(/^linear-gradient\([0-9a-z\s.,%()-]+\)(,\s*linear-gradient\([0-9a-z\s.,%()-]+\))*$/i)
      .refine(value => (value.match(/[a-z-]+/gi) ?? []).every(word => blurCssWords.has(word.toLowerCase()))),
    backgroundPosition: blurCssBounded(1000).regex(/^[0-9.,%\s-]+$/),
    backgroundSize: blurCssBounded(100).regex(/^[0-9.%\s]+$/),
    backgroundRepeat: z.literal('no-repeat'),
  })
  .strict()
export type BlurCss = z.infer<typeof BlurCssSchema>

const CatalogMediaSizeSchema = z.object({ url: z.string().nullish() })
export const CatalogMediaSchema = z.union([
  z.number().int().positive(),
  z.string(),
  z.object({
    id: z.union([z.number(), z.string()]).optional(),
    url: z.string().nullish(),
    thumbnailURL: z.string().nullish(),
    filename: z.string().nullish(),
    width: z.number().nullish(),
    height: z.number().nullish(),
    blurCSS: BlurCssSchema.nullish(),
    sizes: z.object({
      galleryThumb: CatalogMediaSizeSchema.nullish(),
      galleryPreview: CatalogMediaSizeSchema.nullish(),
    }).nullish(),
  }),
])
export type CatalogMedia = z.infer<typeof CatalogMediaSchema>

export function mediaUrl(media: CatalogMedia | null | undefined, cdn?: string): string | undefined {
  const path = (value: string | null | undefined) => value && /^(https?:\/\/|\/[^/])/i.test(value.trim()) ? value.trim() : undefined
  const file = (value: string | null | undefined) => {
    if (!value || /[\\/]/.test(value) || !/\.(jpe?g|png|webp|avif|gif)$/i.test(value)) return
    return `${cdn?.replace(/\/+$/, '') || '/api/media/file'}/${encodeURIComponent(value)}`
  }
  if (typeof media === 'string') return path(media) ?? file(media)
  if (!media || typeof media !== 'object') return
  return path(media.url) ?? file(media.filename) ?? path(media.thumbnailURL)
}

export function selectCatalogPhotos(
  product: { cover?: CatalogMedia | null; gallery?: Array<{ image?: CatalogMedia | null }> | null },
  resolve: (media: CatalogMedia | null | undefined) => string | undefined,
) {
  const idOf = (media: CatalogMedia | null | undefined, url?: string) => {
    const id = typeof media === 'object' ? media?.id : url ? undefined : media
    return id == null ? undefined : String(id).trim() || undefined
  }
  const coverUrl = resolve(product.cover)
  const entries = (product.gallery ?? []).flatMap(({ image }) => {
    if (image == null) return []
    const url = resolve(image)
    return url && url !== '/assets/images/placeholder.svg' ? [{ url, id: idOf(image, url), image }] : []
  })
  const coverId = idOf(product.cover, coverUrl) ?? entries.find(entry => entry.url === coverUrl)?.id
  const matching = entries.find(entry => entry.url === coverUrl || (coverId !== undefined && entry.id === coverId))
  const declaredCover = product.cover ?? undefined
  const coverImage = declaredCover && typeof declaredCover === 'object' && declaredCover.sizes?.galleryThumb?.url
    ? declaredCover
    : matching?.image ?? declaredCover
  const resolvedCover = coverUrl && coverImage !== undefined ? { url: coverUrl, id: coverId, image: coverImage } : matching
  const detailCover = resolvedCover && resolvedCover.url !== '/assets/images/placeholder.svg' ? resolvedCover : undefined

  type PhotoEntry = { url: string; id: string | undefined; image: CatalogMedia }
  const gallery: PhotoEntry[] = []
  const urls = new Set<string>()
  const seenUrls = new Set<string>()
  const ids = new Set<string>()
  const isCoverEntry = (entry: PhotoEntry) =>
    detailCover !== undefined && (entry.url === detailCover.url || (detailCover.id !== undefined && entry.id === detailCover.id))

  const pushEntry = (entry: PhotoEntry) => {
    const coverMatch = isCoverEntry(entry) ? detailCover : undefined
    const canonicalImage = coverMatch
      ? typeof coverMatch.image === 'object' && coverMatch.image.sizes?.galleryThumb?.url
        ? coverMatch.image
        : typeof entry.image === 'object'
          ? entry.image
          : coverMatch.image
      : entry.image
    const canonical: PhotoEntry = coverMatch
      ? { url: coverMatch.url, id: coverMatch.id ?? entry.id, image: canonicalImage }
      : entry
    if (seenUrls.has(entry.url) || seenUrls.has(canonical.url) || (canonical.id !== undefined && ids.has(canonical.id))) return
    seenUrls.add(entry.url)
    seenUrls.add(canonical.url)
    urls.add(canonical.url)
    if (canonical.id !== undefined) ids.add(canonical.id)
    if (coverMatch?.id !== undefined) ids.add(coverMatch.id)
    gallery.push(canonical)
  }

  // Always surface a non-placeholder cover in product details even when gallery omits it or duplicates it.
  if (detailCover && !entries.some(isCoverEntry)) pushEntry(detailCover)
  for (const entry of entries) pushEntry(entry)

  return { cover: resolvedCover, primary: resolvedCover ?? entries[0], gallery, urls }
}
