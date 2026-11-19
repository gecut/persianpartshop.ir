import type { Metadata } from 'next'
import type { CatalogOutput } from '@persianpart/contract/public-catalog'
import type { PublicCatalogProduct } from '@persianpart/contract/public-catalog'

function productMetadataDescription(product: PublicCatalogProduct): string {
  return [
    product.name,
    product.brand?.name,
    product.category?.name,
    product.dimension?.name,
    product.color,
  ]
    .filter(Boolean)
    .join('، ')
}

export function buildProductShareMetadata(
  { product, config }: CatalogOutput<'product'>,
  origin: string,
): Metadata {
  const url = `${origin}/p/${product.id}`
  const description = productMetadataDescription(product)
  const image =
    product.cover ??
    product.photos[0] ??
    config.shareImage ??
    config.fallbackImage
  return {
    title: product.name,
    description,
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      title: product.name,
      description,
      url,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: product.name,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
  }
}
