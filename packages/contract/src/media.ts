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
  const declaredCover = product.cover
  const coverImage = typeof declaredCover === 'object' && declaredCover && declaredCover.sizes?.galleryThumb?.url
    ? declaredCover
    : matching?.image ?? declaredCover
  const cover = coverUrl ? { url: coverUrl, id: coverId, image: coverImage } : matching
  const urls = new Set(cover ? [cover.url] : [])
  const ids = new Set(coverId ? [coverId] : [])
  const gallery = entries.filter(({ url, id }) => {
    const duplicate = urls.has(url) || (id !== undefined && ids.has(id))
    urls.add(url)
    if (id !== undefined) ids.add(id)
    return !duplicate
  })

  return { cover, primary: cover ?? entries[0], gallery, urls }
}
