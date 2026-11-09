import type { Product } from "@/modules/products/product-types"
import { formatToman } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"
import { TomanIcon } from "@/components/ui/icons"
import { formatProdDimension } from "./_format-prod-dimension"

interface PlanProductRowProps {
  prod: Product;
  isExpired: boolean;
  isUpcoming: boolean;
  onSelect: (prod: Product) => void;
}

export function PlanProductRow({ prod, isExpired, isUpcoming, onSelect }: PlanProductRowProps) {
    const price =
      prod.finalCustomerPricePerSqm &&
      prod.finalCustomerPricePerSqm > 0
        ? prod.finalCustomerPricePerSqm
        : Number(prod.basePricePerSqm) > 0
          ? Number(prod.basePricePerSqm)
          : Number(prod.pricePerM2) || 0;
  
    const dimText = formatProdDimension(prod);
    const isProdOutOfStock =
      prod.stockStatus === "out_of_stock" ||
      prod.inStock === false ||
      (Number.isFinite(Number(prod.inventorySqm)) &&
        Number(prod.inventorySqm) <= 0);

  return (
      <div
        key={prod.id}
        role={isExpired ? undefined : "button"}
        tabIndex={isExpired ? -1 : 0}
        onClick={
          isExpired
            ? undefined
            : () => onSelect(prod)
        }
        onKeyDown={
          isExpired
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(prod);
                }
              }
        }
        className={cn(
          "flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all text-start",
          isExpired
            ? "opacity-40 pointer-events-none cursor-not-allowed select-none bg-muted/5 border-border/20 grayscale-[0.2]"
            : cn(
                "cursor-pointer select-none bg-muted/10 hover:bg-muted/15 border-border/20",
                isProdOutOfStock && "opacity-80",
              ),
        )}
        title={
          isExpired
            ? "این طرح منقضی شده است"
            : "مشاهده مشخصات کامل کالا"
        }
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <img
            src={
              prod.images[0] ||
              "/assets/images/placeholder.svg"
            }
            alt={prod.name}
            className="size-12 rounded-xl object-cover shrink-0 bg-muted/20"
            onError={(e) => {
              const target = e.currentTarget;
              if (
                !target.src.endsWith(
                  "/assets/images/placeholder.svg",
                )
              ) {
                target.src =
                  "/assets/images/placeholder.svg";
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-foreground truncate block">
              {prod.name}
            </span>
            {dimText && (
              <span className="text-[11px] text-muted block mt-0.5">
                ابعاد: {dimText}
              </span>
            )}
            <span className="text-xs font-bold text-foreground inline-flex items-center gap-0.5 mt-1">
              <span>
                {price > 0
                  ? formatToman(price)
                  : "استعلام قیمت"}
              </span>
              {price > 0 && (
                <TomanIcon className="size-2.5" />
              )}
            </span>
          </div>
        </div>

        {isExpired ? (
          <span className="h-8 px-2.5 rounded-xl bg-danger/10 text-danger text-[11px] font-bold shrink-0 flex items-center justify-center">
            منقضی شده
          </span>
        ) : isUpcoming ? (
          <span className="h-8 px-2.5 rounded-xl bg-muted/20 text-muted text-[11px] font-semibold shrink-0 flex items-center justify-center">
            به‌زودی
          </span>
        ) : isProdOutOfStock ? (
          <span className="h-8 px-2.5 rounded-xl bg-danger/15 text-danger text-[11px] font-bold shrink-0 flex items-center justify-center">
            ناموجود
          </span>
        ) : (
          ""
        )}
      </div>
  );
}
