import { Button } from "@heroui/react"
import type { Product } from "@/modules/products/product-types"
import { toPersianDigits, formatToman } from "@/lib/utils/currency"
import { CheckIcon, PlusIcon, TomanIcon } from "@/components/ui/icons"

interface ProductPriceStripProps {
  product: Product;
  isSelected: boolean;
  isOrderingDisabled: boolean;
  isOutOfStock: boolean;
  onToggleSelect?: () => void;
  onRequestSupply?: (product: Product) => void;
}

export function ProductPriceStrip({ product: activeProduct, isSelected, isOrderingDisabled, isOutOfStock, onToggleSelect, onRequestSupply }: ProductPriceStripProps) {
  return (
    <div className="px-4 py-3 bg-muted/5 rounded-2xl flex items-center justify-between gap-2">
      <div className="min-w-0 flex items-baseline gap-1.5 whitespace-nowrap">
        {activeProduct.discountPercent ? (
          <>
            <span className="text-sm font-extrabold text-danger inline-flex items-center gap-1">
              <span>
                {formatToman(
                  activeProduct.finalCustomerPricePerSqm,
                )}
              </span>
              <TomanIcon className="size-4" />
            </span>
            <span className="text-sm text-muted line-through inline-flex items-center gap-0.5">
              <span>
                {formatToman(
                  activeProduct.originalPricePerSqm ||
                    activeProduct.finalCustomerPricePerSqm,
                )}
              </span>
              <TomanIcon className="size-3" />
            </span>
            <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-danger/15 text-danger">
              {toPersianDigits(activeProduct.discountPercent)}٪
            </span>
          </>
        ) : (
          <span className="text-sm font-extrabold text-foreground inline-flex items-center gap-1">
            <span>
              {formatToman(activeProduct.finalCustomerPricePerSqm)}
            </span>
            <TomanIcon className="size-4" />
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
        {isOrderingDisabled ? (
          <span className="px-3 py-2 rounded-lg text-xs font-semibold bg-muted/15 text-muted">
            فقط مشاهده کاتالوگ
          </span>
        ) : isOutOfStock && activeProduct.hasSupplySource && onRequestSupply ? (
          <Button size="sm" variant="primary" onPress={() => onRequestSupply(activeProduct)}>
            درخواست تأمین
          </Button>
        ) : isOutOfStock ? (
          <span className="px-3.5 py-2 rounded-lg text-xs font-bold bg-danger/15 text-danger">
            ناموجود
          </span>
        ) : (
          onToggleSelect && (
            <Button
              type="button"
              onClick={onToggleSelect}
              className={`h-10 w-38 px-4 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ${
                isSelected
                  ? "bg-success/15 text-success"
                  : "bg-primary hover:bg-muted/20 text-background"
              }`}
            >
              {isSelected ? (
                <>
                  <CheckIcon
                    size={14}
                    className="stroke-3 text-success"
                  />
                  <span>انتخاب‌شده</span>
                </>
              ) : (
                <>
                  <PlusIcon size={14} className="stroke-3" />
                  <span> افزودن به سبد خرید</span>
                </>
              )}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
