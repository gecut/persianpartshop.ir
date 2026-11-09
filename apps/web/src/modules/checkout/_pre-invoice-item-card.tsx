import { formatCartons } from '@/lib/utils/unit'

import type { Product } from "@/modules/products/product-types"
import { formatToman, toPersianDigits } from "@/lib/utils/currency"
import { formatGrade, formatUnit } from "@/modules/products/product-store"

import { TomanIcon } from "@/components/ui/icons"

interface PreInvoiceItemCardProps {
  item: {
    product: Product;
    requestedArea: number;
    cartonCount: number;
    deliverableArea: number;
    unitPrice: number;
    totalPrice: number;
  };
}

export function PreInvoiceItemCard({ item }: PreInvoiceItemCardProps) {
  return (
    <div className="p-3 bg-muted/5 rounded-2xl space-y-2.5 text-xs text-start select-none">
      {/* Product Thumbnail & Details Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img
            src={item.product.images[0] || "/assets/images/placeholder.svg"}
            alt={item.product.name}
            className="w-13 h-13 rounded-2xl object-cover shrink-0"
            onError={(e) => {
              if (
                !e.currentTarget.src.endsWith("/assets/images/placeholder.svg")
              ) {
                e.currentTarget.src = "/assets/images/placeholder.svg";
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-foreground text-xs sm:text-sm truncate leading-snug">
              {item.product.name}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-muted mt-1 flex-wrap">
              {item.product.dimensions?.width &&
              item.product.dimensions?.height ? (
                <span className="px-2 py-0.5 rounded-lg bg-muted/10 text-foreground font-semibold text-xs">
                  ابعاد: {toPersianDigits(item.product.dimensions.width)} ×{" "}
                  {toPersianDigits(item.product.dimensions.height)}
                </span>
              ) : item.product.weight ? (
                <span className="px-2 py-0.5 rounded-lg bg-muted/10 text-foreground font-semibold text-xs">
                  {formatUnit(item.product.unit)}{" "}
                  {toPersianDigits(item.product.weight)}
                </span>
              ) : item.product.unit ? (
                <span className="px-2 py-0.5 rounded-lg bg-muted/10 text-foreground font-semibold text-xs">
                  {formatUnit(item.product.unit)}
                </span>
              ) : null}
              <span className="text-muted">•</span>
              <span className="text-muted font-medium text-[11px]">
                {item.product.brand}
              </span>
            </div>
          </div>
        </div>

        {/* Total price displayed once */}
        <div className="flex items-center shrink-0">
          <span className="font-extrabold text-foreground inline-flex items-center gap-1 text-xs">
            <span>{formatToman(item.totalPrice)}</span>
            <TomanIcon className="size-3.5" />
          </span>
        </div>
      </div>

      {/* Calculation Metrics & Quality Grade */}
      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-border/10 bg-transparent">
        <div className="text-start">
          <span className="text-[11px] text-muted block mb-0.5">
            {item.product.productType === 'other' ? 'تعداد' : 'تعداد کارتن'}
          </span>
          <span className="font-bold text-primary">
            {item.product.productType === 'other' ? `${toPersianDigits(item.cartonCount)} ${formatUnit(item.product.unit)}` : formatCartons(item.cartonCount, item.product.cartonsPerPallet)}
          </span>
        </div>

        <div className="text-center">
          <span className="text-[11px] text-muted block mb-0.5">
            {item.product.productType === 'other' ? 'مقدار تحویلی' : 'متراژ تحویلی'}
          </span>
          <span className="font-bold text-foreground">
            {toPersianDigits(item.deliverableArea)} {item.product.productType === 'other' ? formatUnit(item.product.unit) : 'مترمربع'}
          </span>
        </div>

        <div className="text-end">
          {item.product.grade ? (
            <span className="text-xs text-muted block mb-0.5">درجه کیفی</span>
          ) : (
            ""
          )}
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary inline-block">
            {formatGrade(item.product.grade)}
          </span>
        </div>
      </div>
    </div>
  );
}

