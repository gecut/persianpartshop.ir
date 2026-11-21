import Link from 'next/link'
import type { PublicCatalogFamilyOption } from '@persianpart/contract/public-catalog'
import { formatGrade, formatToman, toPersianDigits } from '@/lib/format'
import { TomanIcon } from '@/components/toman-icon'
import { ProductValues } from '@/components/product-values'

interface ProductFamilyOptionsProps {
  options: PublicCatalogFamilyOption[]
  currentId: string
}

export function ProductFamilyOptions({
  options,
  currentId,
}: ProductFamilyOptionsProps) {
  if (options.length < 2) return null

  return (
    <div className="p-3 bg-muted/5 rounded-2xl space-y-2">
      <h3 className="text-xs font-bold text-muted">
        گزینه‌های دیگر این محصول
      </h3>
      <div className="space-y-2">
        {options.map((option) => {
          const isCurrent = option.id === currentId
          const gradeLabel = formatGrade(option.grade)
          const dimensionLabel = option.dimension?.name
            ? toPersianDigits(option.dimension.name)
            : option.width && option.height
              ? `${toPersianDigits(option.width)}×${toPersianDigits(option.height)}`
              : null
          const hasPrice = option.price.mode !== 'hidden'
          const hasStock = option.stock.mode !== 'hidden'

          const content = (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs font-bold text-foreground leading-snug break-words">
                    {option.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    {gradeLabel ? <span>{gradeLabel}</span> : null}
                    {dimensionLabel ? <span>{dimensionLabel}</span> : null}
                    <span>
                      کد: <bdi>{option.sku}</bdi>
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center">
                  {isCurrent ? (
                    <span
                      aria-current="page"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/15 text-primary"
                    >
                      در حال مشاهده
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted/15 text-muted">
                      مشاهده
                    </span>
                  )}
                </div>
              </div>

              {(hasPrice || hasStock) && (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/10 text-xs">
                  {hasPrice ? (
                    <div>
                      {option.price.mode === 'amount' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-foreground">
                          <span>{formatToman(option.price.amount)}</span>
                          <TomanIcon className="size-3.5" />
                        </span>
                      ) : (
                        <span className="font-bold text-muted">
                          قیمت اعلام نشده
                        </span>
                      )}
                    </div>
                  ) : (
                    <div />
                  )}
                  {hasStock ? <ProductValues product={option} /> : null}
                </div>
              )}
            </>
          )

          if (isCurrent) {
            return (
              <div
                key={option.id}
                aria-current="page"
                className="p-2.5 rounded-xl border flex flex-col gap-2 transition-colors bg-primary/5 border-primary/20 text-start"
              >
                {content}
              </div>
            )
          }

          return (
            <Link
              key={option.id}
              href={`/p/${option.id}`}
              prefetch={false}
              className="p-2.5 rounded-xl border flex flex-col gap-2 transition-colors block text-start bg-muted/10 border-border/10 hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
