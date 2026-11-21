import { mediaUrl } from '@persianpart/contract'
import {
  PublicCatalogConfigSchema,
  PublicCatalogProductSchema,
  PublicCatalogFamilyOptionSchema,
} from '@persianpart/contract/public-catalog'
import type { CatalogMedia } from '@persianpart/contract'
import type {
  CatalogSettings,
  PublicCatalogProduct,
  PublicCatalogFamilyOption,
} from '@persianpart/contract/public-catalog'
import type { Product, Media } from '../../payload-types'

import type { CatalogQueryResult } from './catalog-query-types'

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const node = value as Record<string, unknown>
  return [
    typeof node.text === 'string' ? node.text : '',
    text(node.root),
    ...(Array.isArray(node.children) ? node.children.map(text) : []),
  ]
    .filter(Boolean)
    .join(' ')
}
function relation(value: unknown): { id: number; name: string } | null {
  if (!value || typeof value !== 'object') return null
  const node = value as Record<string, unknown>
  return typeof node.id === 'number' && typeof node.name === 'string'
    ? { id: node.id, name: node.name }
    : null
}
function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}
function publicPhoto(media: Media | number | null | undefined) {
  if (
    !media ||
    typeof media !== 'object' ||
    !media.mimeType?.startsWith('image/')
  )
    return null
  const url = mediaUrl(media as CatalogMedia, process.env.CDN_URL)
  return url
    ? {
        url,
        width: positive(media.width) ?? 1200,
        height: positive(media.height) ?? 1200,
        alt: media.alt || '',
      }
    : null
}
export function publicConfig(
  settings: CatalogSettings,
  fallback: Media | null,
  share: Media | null,
) {
  return PublicCatalogConfigSchema.parse({
    title: settings.presentation.title,
    introduction: settings.presentation.introduction,
    pausedMessage: settings.pausedMessage,
    priceNote: settings.pricing.showPrice ? settings.pricing.note : '',
    showPrice: settings.pricing.showPrice,
    stockMode: settings.stock.mode,
    watermark: settings.presentation.watermark,
    sort:
      !settings.pricing.showPrice &&
      ['cheapest', 'expensive'].includes(settings.presentation.sort)
        ? 'default'
        : settings.presentation.sort,
    shareTitle: settings.sharing.title,
    shareDescription: settings.sharing.description,
    shareImage: publicPhoto(share),
    fallbackImage: publicPhoto(fallback),
    contact: settings.contact.channels.map((channel) => ({
      type: channel.type,
      label: channel.label,
      url: channel.url,
    })),
  })
}
export function mapPublicProduct(
  product: Omit<Product, 'slug' | 'createdAt'>,
  row: CatalogQueryResult['rows'][number],
  settings: CatalogSettings,
): PublicCatalogProduct {
  const cover = publicPhoto(product.cover)
  const coverId = product.cover && typeof product.cover === 'object' ? product.cover.id : product.cover
  const photos = (product.gallery ?? [])
    .filter(({ image }) => (image && typeof image === 'object' ? image.id : image) !== coverId)
    .flatMap(({ image }) => { const photo = publicPhoto(image); return photo && photo.url !== cover?.url ? [photo] : [] })
    .filter((photo, index, all) => all.findIndex(candidate => candidate.url === photo.url) === index)
  const cap = settings.stock.displayCap
  const stock: PublicCatalogProduct['stock'] =
    settings.stock.mode === 'hidden'
      ? { mode: 'hidden' }
      : settings.stock.mode === 'status'
        ? { mode: 'status', status: row.status }
        : {
            mode: 'numeric',
            status: row.status,
            quantity: cap != null && row.quantity > cap ? cap : row.quantity,
            capped: cap != null && row.quantity > cap,
          }
  return PublicCatalogProductSchema.parse({
    id: String(product.id),
    name: product.name,
    sku: product.sku,
    productType: product.productType ?? null,
    category: relation(product.category),
    brand: relation(product.brand),
    dimension: relation(product.dimension),
    color: product.color ?? null,
    grade: product.grade ?? null,
    tags: (product.tags ?? []).flatMap((tag) => {
      const item = relation(tag)
      return item ? [item] : []
    }),
    width: positive(product.width),
    height: positive(product.height),
    unit:
      product.productType === 'other'
        ? (product.unit ?? null)
        : product.productType === 'tile'
          ? 'm2'
          : null,
    sqmPerCarton:
      product.productType === 'tile' ? positive(product.sqmPerCarton) : null,
    piecesPerCarton:
      product.productType === 'tile' ? positive(product.piecesPerCarton) : null,
    weight:
      product.weight != null &&
      Number.isFinite(product.weight) &&
      product.weight >= 0
        ? product.weight
        : null,
    secondaryUnit: product.secondary_unit ?? null,
    itemsPerPack: positive(product.itemsPerPack),
    approxCoverage: product.approxCoverage ?? null,
    description: text(product.richDescription),
    cover,
    photos,
    price: !settings.pricing.showPrice
      ? { mode: 'hidden' }
      : row.price != null && row.price > 0
        ? { mode: 'amount', amount: row.price }
        : { mode: 'unpriced' },
    stock,
    updatedAt: product.updatedAt,
  })
}

export function toFamilyOption(
  product: PublicCatalogProduct,
): PublicCatalogFamilyOption {
  return PublicCatalogFamilyOptionSchema.parse({
    id: product.id,
    name: product.name,
    sku: product.sku,
    productType: product.productType,
    brand: product.brand,
    dimension: product.dimension,
    color: product.color,
    grade: product.grade,
    tags: product.tags,
    width: product.width,
    height: product.height,
    unit: product.unit,
    weight: product.weight,
    itemsPerPack: product.itemsPerPack,
    price: product.price,
    stock: product.stock,
  })
}
