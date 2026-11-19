import type { CatalogOutput } from '@persianpart/contract/public-catalog'
import { catalogOrigin } from '@/lib/catalog-server'
import { formatGrade, formatToman } from '@/lib/format'
import { TomanIcon } from '@/components/toman-icon'
import { CatalogContact } from '@/components/catalog-contact'
import { ProductGallery } from './_product-gallery'
import { ProductShare } from './_product-share'
import { ProductSpecGrid } from './_product-specifications'
import { CatalogBackLink } from './_catalog-back-link'

type ProductViewProps = CatalogOutput<'product'>
export function ProductView({ product, config }: ProductViewProps) {
  const url = `${catalogOrigin()}/p/${product.id}`
  return (
    <article className="product-detail py-2 text-start overflow-x-clip">
      <header className="w-full flex items-center justify-between px-5 pt-1 pb-1 gap-2">
        <h1 className="min-w-0 flex-1 text-sm font-extrabold text-foreground mt-0.5 text-start leading-snug">
          {product.name}
        </h1>
        <ProductShare name={product.name} url={url} />
        <CatalogBackLink />
      </header>
      <div className="[--product-details-inset:--spacing(5)] [--product-details-body-bleed:3px] -mx-(--product-details-body-bleed) px-(--product-details-inset) py-2 space-y-2.5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
        <ProductGallery product={product} config={config} />
        {product.price.mode !== 'hidden' && (
          <div className="px-4 py-3 bg-muted/5 rounded-2xl flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-sm font-extrabold text-foreground inline-flex items-center gap-1">
                {product.price.mode === 'amount' ? (
                  <>
                    <span>{formatToman(product.price.amount)}</span>
                    <TomanIcon className="size-4" />
                  </>
                ) : (
                  'قیمت اعلام نشده'
                )}
              </span>
            </div>
            <span className="px-3 py-2 rounded-lg text-xs font-semibold bg-muted/15 text-muted">
              فقط مشاهده کاتالوگ
            </span>
          </div>
        )}
        <ProductSpecGrid product={product} />
        {product.description && (
          <div className="p-3 bg-muted/5 rounded-2xl space-y-1">
            <span className="text-xs font-bold text-muted block">توضیحات</span>
            <p className="text-xs text-foreground leading-relaxed">
              {product.description}
            </p>
          </div>
        )}
        {(product.tags.length > 0 ||
          product.approxCoverage ||
          product.grade) && (
          <div className="pt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted font-base">
              ویژگی‌ها و برچسب‌ها:
            </span>
            {product.grade && (
              <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                {formatGrade(product.grade)}
              </span>
            )}
            {product.approxCoverage && (
              <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/15 text-primary">
                پوشش: {product.approxCoverage}
              </span>
            )}
            {product.tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
        {config.priceNote && (
          <p className="catalog-price-note">{config.priceNote}</p>
        )}
        <CatalogContact config={config} />
      </div>
    </article>
  )
}
