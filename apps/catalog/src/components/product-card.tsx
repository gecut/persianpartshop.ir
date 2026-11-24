'use client'
import Link from 'next/link'
import { MagnifierZoomInIcon } from '@solar-icons/react/linear'
import type {
  PublicCatalogFamilyOption,
  PublicCatalogPage,
  PublicCatalogProduct,
} from '@persianpart/contract/public-catalog'
import { cn } from '@heroui/react'
import {
  formatGrade,
  formatToman,
  formatUnit,
  toPersianDigits,
} from '@/lib/format'
import { TomanIcon } from '@/components/toman-icon'
import { ProductValues } from '@/components/product-values'
import { LinkPending } from '@/components/link-pending'

type ProductCardProps = {
  product: PublicCatalogProduct | PublicCatalogFamilyOption
  config: PublicCatalogPage['config']
  priority: boolean
  onNavigate?: () => void
  current?: boolean
}

export function ProductCard({
  product,
  config,
  priority,
  onNavigate,
  current = false,
}: ProductCardProps) {
  const photo =
    ('cover' in product ? (product.cover ?? product.photos[0]) : null) ??
    config.fallbackImage
  const unavailable =
    product.stock.mode !== 'hidden' && product.stock.status === 'out_of_stock'
  return (
    <Link
      href={`/p/${product.id}`}
      prefetch={false}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'catalog-product-card group relative flex items-center justify-between px-3.5 py-2.5 sm:p-3 rounded-2xl transition-all duration-300 cursor-pointer select-none text-start bg-muted/5',
        unavailable && 'opacity-80',
        current && 'ring-2 ring-primary/30',
      )}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div className="relative isolate size-19 aspect-square shrink-0 group/img transition-transform active:scale-95 bg-muted/15 rounded-2xl overflow-hidden">
          {photo?.blurCSS && (
            <span
              aria-hidden
              className="absolute inset-0 -z-10 scale-125 blur-xl pointer-events-none"
              style={photo.blurCSS}
            />
          )}
          <img
            src={photo?.url ?? '/assets/images/placeholder.svg'}
            alt={photo?.alt || product.name}
            width={76}
            height={76}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className="size-19 aspect-square object-cover rounded-2xl transition-transform duration-200 group-hover/img:scale-105"
          />
          <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
            <span className="p-1 rounded-md bg-primary flex items-center justify-center size-8 text-primary-foreground">
              <MagnifierZoomInIcon size={16} />
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between self-stretch min-w-0 py-0.5">
          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-light text-muted/90 block truncate">
              {product.brand?.name}
            </span>
            <h3 className="text-xs min-[390px]:text-xs sm:text-sm font-medium text-foreground leading-[1.35] mt-0.5 wrap-break-word">
              {product.name}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {product.productType === 'other' ? (
              <>
                {'secondaryUnit' in product && product.secondaryUnit && (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                    {formatUnit(product.secondaryUnit)}
                  </span>
                )}
                {(product.weight || product.itemsPerPack) && (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                    {product.weight
                      ? toPersianDigits(product.weight)
                      : `${toPersianDigits(product.itemsPerPack!)} عدد`}
                  </span>
                )}
                {'approxCoverage' in product && product.approxCoverage && (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                    {product.approxCoverage}
                  </span>
                )}
              </>
            ) : product.width && product.height ? (
              <span className="flex gap-0.5 px-2 py-1 rounded-lg text-xs font-bold bg-muted/10 text-foreground">
                <span className="flex gap-0.5 opacity-70">
                  <span>{toPersianDigits(product.height)}</span>
                  <span className="opacity-70">×</span>
                  <span>{toPersianDigits(product.width)}</span>
                </span>
              </span>
            ) : null}
            {product.grade && (
              <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                {formatGrade(product.grade)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between items-end self-stretch shrink-0 ps-3 py-0.5 text-end">
        {product.price.mode !== 'hidden' && (
          <div className="flex-1 flex flex-col justify-center items-end">
            <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
              {product.price.mode === 'amount' ? (
                <>
                  <span>{formatToman(product.price.amount)}</span>
                  <TomanIcon className="size-3.5" />
                </>
              ) : (
                <span className="text-xs text-muted">قیمت اعلام نشده</span>
              )}
            </span>
          </div>
        )}
        <ProductValues product={product} variant="badge" />
      </div>
      <LinkPending />
    </Link>
  )
}
