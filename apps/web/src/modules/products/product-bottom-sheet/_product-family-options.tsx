import { Button } from "@heroui/react"
import { cn } from "@/lib/utils"
import { formatToman, toPersianDigits } from "@/lib/utils/currency"
import { formatUnit } from "@/lib/utils/unit"
import { TomanIcon } from "@/components/ui/icons"
import { formatGrade } from "@/modules/catalog/catalog-mapper"
import type { Product } from "@/modules/catalog/product-types"
import { ProductStockValue } from "./_product-stock-value"

interface ProductFamilyOptionsProps {
  options: Product[]
  activeId: string
  onViewProduct: (product: Product) => void
}

export function ProductFamilyOptions({
  options,
  activeId,
  onViewProduct,
}: ProductFamilyOptionsProps) {
  if (options.length < 2) return null

  return (
    <div className="p-3 bg-muted/5 rounded-2xl space-y-2">
      <h3 className="text-xs font-bold text-muted">
        گزینه‌های دیگر این محصول
      </h3>
      <div className="space-y-2">
        {options.map((option) => {
          const isCurrent = String(option.id) === String(activeId)
          const gradeLabel = formatGrade(option.grade)
          const dimText = option.dimension ? toPersianDigits(option.dimension) : null
          const unitLabel = option.productType === "other" ? formatUnit(option.unit) : "متر"

          return (
            <div
              key={option.id}
              className={cn(
                "p-2.5 rounded-xl border flex flex-col gap-2 transition-colors",
                isCurrent
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/10 border-border/10",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs font-bold text-foreground leading-snug break-words">
                    {option.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    {gradeLabel && <span>{gradeLabel}</span>}
                    {dimText && <span>{dimText}</span>}
                    <span>
                      کد: <bdi>{option.sku}</bdi>
                    </span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center">
                  {isCurrent ? (
                    <span
                      aria-current="true"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/15 text-primary"
                    >
                      در حال مشاهده
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => onViewProduct(option)}
                      aria-label={`مشاهدهٔ ${option.name}`}
                      className="text-xs"
                    >
                      مشاهده
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/10 text-xs">
                <div className="inline-flex items-center gap-1 font-bold text-foreground">
                  <span>{formatToman(option.finalCustomerPricePerSqm)}</span>
                  <TomanIcon className="size-3.5" />
                  <span className="font-normal text-muted">/ {unitLabel}</span>
                </div>
                <ProductStockValue product={option} unitLabel={unitLabel} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
