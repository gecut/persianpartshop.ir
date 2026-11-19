'use client'

import { lazy, Suspense, useMemo, useState } from 'react'
import type {
  PublicCatalogPage,
  PublicCatalogProduct,
} from '@persianpart/contract/public-catalog'
import { toPersianDigits } from '@/lib/format'
import {
  ProductGalleryCarousel,
  type GalleryMediaItem,
} from './_product-gallery-carousel'

const ProductImageViewer = lazy(() =>
  import('./_product-image-viewer').then((module) => ({
    default: module.ProductImageViewer,
  })),
)

type ProductGalleryProps = {
  product: PublicCatalogProduct
  config: PublicCatalogPage['config']
}

export function ProductGallery({ product, config }: ProductGalleryProps) {
  const items = useMemo(
    () =>
      product.photos.map((photo, index) => ({
        url: photo.url,
        ratio: photo.width / photo.height,
        label: `تصویر ${toPersianDigits(index + 1)}`,
      })),
    [product.photos],
  )
  const [zoom, setZoom] = useState<{ index: number } | null>(null)
  const [selection, setSelection] = useState<GalleryMediaItem | null>(null)
  if (!items.length) return null
  return (
    <>
      <ProductGalleryCarousel
        productName={product.name}
        items={items}
        isOpen
        isZoomOpen={zoom !== null}
        zoomSelection={selection}
        showProductImageWatermark={config.watermark}
        onZoom={(url) =>
          setZoom({
            index: Math.max(
              0,
              items.findIndex((item) => item.url === url),
            ),
          })
        }
      />
      {zoom && (
        <Suspense
          fallback={
            <p role="status" className="text-xs text-muted">
              در حال دریافت تصویر…
            </p>
          }
        >
          <ProductImageViewer
            items={items}
            initialIndex={zoom.index}
            productName={product.name}
            showWatermark={config.watermark}
            onClose={(item) => {
              setSelection(item)
              setZoom(null)
            }}
          />
        </Suspense>
      )}
    </>
  )
}
