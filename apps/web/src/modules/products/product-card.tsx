import React from "react"
import type { Product } from "@/modules/catalog/product-types"
import { formatToman, toPersianDigits } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"
import TomanIcon from "@/components/ui/icons"
import { formatGrade, formatUnit } from "@/modules/catalog/product-store"
import { ProductThumbnail } from './_product-thumbnail'

interface SelectableProductCardProps {
  mode?: "select";
  product: Product;
  isSelected: boolean;
  isInCart?: boolean;
  isOrderingDisabled?: boolean;
  onToggleSelect: (product: Product) => void;
  onOpenBottomSheet?: (product: Product) => void;
}

/** A compact card that only opens the product; used for alternatives inside the detail drawer. */
interface ViewProductCardProps {
  mode: "view";
  product: Product;
  onViewProduct: (product: Product) => void;
}

export type ProductCardProps = SelectableProductCardProps | ViewProductCardProps;

export const ProductCard = React.memo(function ProductCard(props: ProductCardProps) {
  const { product } = props;
  const isViewMode = props.mode === "view";
  const isOrderingDisabled = !isViewMode && (props.isOrderingDisabled ?? false);
  const onOpenBottomSheet = isViewMode ? undefined : props.onOpenBottomSheet;
  const isOutOfStock = (
    product.stockStatus === "out_of_stock" ||
    product.inStock === false ||
    (Number.isFinite(Number(product.inventorySqm)) &&
      Number(product.inventorySqm) <= 0));

  const supplyOnly = isOutOfStock && Boolean(product.hasSupplySource);

  const effectiveSelected = !isViewMode && !isOrderingDisabled && (!isOutOfStock || supplyOnly) && props.isSelected;

  const activate = () => {
    if (isViewMode) {
      props.onViewProduct(product);
      return;
    }
    if (isOrderingDisabled || (isOutOfStock && !supplyOnly)) {
      onOpenBottomSheet?.(product);
      return;
    }
    props.onToggleSelect(product);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Ignore clicks on buttons or interactive thumbnail elements
    if (target.closest("button") || target.closest("[data-no-select]")) {
      return;
    }
    activate();
  };

  const chipText = isViewMode ? "text-[11px]" : "text-xs";

  const imgSrc = product.images[0] || "/assets/images/placeholder.svg";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isViewMode ? undefined : effectiveSelected}
      aria-label={isViewMode ? `مشاهدهٔ ${product.name}` : undefined}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          activate();
        }
      }}
      className={cn(
        "group relative flex items-center justify-between rounded-2xl transition-all duration-300 cursor-pointer select-none text-start focus-visible:outline-2 focus-visible:outline-primary",
        isViewMode ? "p-2" : "px-3.5 py-2.5 sm:p-3",
        effectiveSelected
          ? "bg-primary/8 ring-1 ring-primary scale-[0.98]"
          : "bg-muted/5",
        isOutOfStock && "opacity-80",
      )}
    >
      <div className={cn("flex items-center min-w-0 flex-1", isViewMode ? "gap-2" : "gap-2.5 sm:gap-3")}>
        <ProductThumbnail
          src={imgSrc}
          thumbnail={product.thumbnailUrl}
          alt={product.name}
          onOpenBottomSheet={() => onOpenBottomSheet?.(product)}
          isCompact={isViewMode}
        />

        <div className="flex flex-col justify-between self-stretch min-w-0 py-0.5">
          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-light text-muted/90 block truncate">
              {product.brand}
            </span>
            <h3 className="text-xs min-[390px]:text-xs sm:text-sm font-medium text-foreground leading-[1.35] mt-0.5 wrap-break-word">
              {product.name}
            </h3>
          </div>

          {/* Product Badges (Dimensions/Weight, Grade, Coverage) */}
          <div className={cn("flex items-center flex-wrap", isViewMode ? "gap-1 mt-1" : "gap-1.5 mt-2")}>
            {product.productType === "other" ? (
              <>
                {Boolean(product.secondary_unit || product.secondaryUnit) && (
                  <span className={cn("px-2 py-1 rounded-lg font-semibold bg-muted/10 text-foreground", chipText)}>
                    {formatUnit(
                      product.secondary_unit || product.secondaryUnit,
                    )}
                  </span>
                )}
                {product.weight ? (
                  <span className={cn("px-2 py-1 rounded-lg font-semibold bg-muted/10 text-foreground", chipText)}>
                    {toPersianDigits(product.weight)}
                  </span>
                ) : product.itemsPerPack ? (
                  <span className={cn("px-2 py-1 rounded-lg font-semibold bg-muted/10 text-foreground", chipText)}>
                    {toPersianDigits(product.itemsPerPack)} عدد
                  </span>
                ) : null}
                {product.approxCoverage && (
                  <span className={cn("px-2 py-1 rounded-lg font-semibold bg-primary/10 text-primary", chipText)}>
                    {product.approxCoverage}
                  </span>
                )}
                {product.grade && (
                  <span className={cn("px-2 py-1 rounded-lg font-semibold bg-primary/10 text-primary", chipText)}>
                    {formatGrade(product.grade)}
                  </span>
                )}
              </>
            ) : (
              <>
                {product.dimensions?.width && product.dimensions?.height && (
                  <span className={cn("flex gap-0.5 px-2 py-1 rounded-lg font-bold bg-muted/10 text-foreground", chipText)}>
                    <span className="flex gap-0.5 opacity-70">
                      <span>{toPersianDigits(product.dimensions.height)}</span>
                      <span className="opacity-70">&times;</span>
                      <span>{toPersianDigits(product.dimensions.width)}</span>
                    </span>
                  </span>
                )}
                {product.grade && (
                  <span className={cn("px-2 py-1 rounded-lg font-semibold bg-primary/10 text-primary", chipText)}>
                    {formatGrade(product.grade)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* End (Left in RTL): Price centered vertically on top & Inventory Badge at bottom */}
      <div className={cn("flex flex-col justify-between items-end self-stretch shrink-0 py-0.5 text-end", isViewMode ? "ps-2" : "ps-3")}>
        {/* Top: Price & In-Cart Status - Centered vertically from top */}
        <div className="flex-1 flex flex-col justify-center items-end">
          <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
            <span>{formatToman(product.finalCustomerPricePerSqm)}</span>
            <TomanIcon className="size-3.5" />
          </span>
        </div>

        {/* Bottom: Inventory Badge - Shows red "ناموجود" if out of stock, otherwise exact stock or presence badge */}
        <div className="mt-auto">
          {supplyOnly ? <span className={cn("px-2 py-1 rounded-lg font-semibold bg-primary/10 text-primary", chipText)}>قابل استعلام</span> : isOutOfStock ? (
            <span className={cn("px-2 py-1 rounded-lg flex font-semibold bg-danger/15 text-danger", chipText)}>
              <span>ناموجود</span>
            </span>
          ) : product.hideExactStock ? (
            <span className={cn("px-2 py-1 rounded-lg flex font-semibold bg-success/20 text-success", chipText)}>
              <span>موجود</span>
            </span>
          ) : (
            <span className={cn("px-2 py-1 rounded-lg flex font-semibold bg-foreground text-background", chipText)}>
              <span className="flex items-center gap-0.5">
                موجودی:{" "}
                {Math.floor(
                  Number.isFinite(Number(product.inventorySqm))
                    ? Number(product.inventorySqm)
                    : 0,
                ).toLocaleString("fa-IR")}{" "}
                {product.productType === "other"
                  ? formatUnit(product.unit)
                  : "متر"}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
