import React from "react";
import type { Product } from "../../types";
import { formatToman, toPersianDigits } from "../../lib/utils/currency";
import { cn } from "../../lib/utils";
import TomanIcon, { ZoomInIcon } from "../../components/ui/icons";
import { formatGrade, formatUnit } from "./product-store";

export interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  isInCart?: boolean;
  isOrderingDisabled?: boolean;
  onToggleSelect: (product: Product) => void;
  onOpenBottomSheet?: (product: Product) => void;
}

interface ProductThumbnailProps {
  src: string;
  alt: string;
  onOpenBottomSheet?: () => void;
}

const ProductThumbnail = React.memo(function ProductThumbnail({
  src,
  alt,
  onOpenBottomSheet,
}: ProductThumbnailProps) {
  return (
    <div
      data-no-select
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onOpenBottomSheet?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          onOpenBottomSheet?.();
        }
      }}
      className="relative size-19 aspect-square shrink-0 group/img cursor-pointer transition-transform active:scale-95 bg-muted/15 rounded-2xl overflow-hidden"
      title="مشاهده جزئیات کالا"
      aria-label={`مشاهده جزئیات ${alt}`}
    >
      <img
        alt={alt}
        src={src}
        loading="lazy"
        decoding="async"
        className="size-19 aspect-square object-cover rounded-2xl transition-transform duration-200 group-hover/img:scale-105"
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.endsWith("/assets/images/placeholder.svg")) {
            target.src = "/assets/images/placeholder.svg";
          }
        }}
      />

      <div className="absolute inset-0 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-2xl pointer-events-none">
        <span className="p-1 rounded-md bg-primary flex flex-col items-center justify-center size-8 text-primary-foreground">
          <ZoomInIcon size={16} />
        </span>
      </div>
    </div>
  );
});

export const ProductCard = React.memo(function ProductCard({
  product,
  isSelected,
  isInCart = false,
  isOrderingDisabled = false,
  onToggleSelect,
  onOpenBottomSheet,
}: ProductCardProps) {
  const isOutOfStock =
    product.stockStatus === "out_of_stock" ||
    product.inStock === false ||
    (Number.isFinite(Number(product.inventorySqm)) &&
      Number(product.inventorySqm) <= 0);

  const effectiveSelected =
    !isOrderingDisabled && !isOutOfStock && isSelected;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Ignore clicks on buttons or interactive thumbnail elements
    if (target.closest("button") || target.closest("[data-no-select]")) {
      return;
    }
    if (isOrderingDisabled || isOutOfStock) {
      onOpenBottomSheet?.(product);
      return;
    }
    onToggleSelect(product);
  };

  const imgSrc = product.images[0] || "/assets/images/placeholder.svg";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={effectiveSelected}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (isOrderingDisabled || isOutOfStock) {
            onOpenBottomSheet?.(product);
            return;
          }
          onToggleSelect(product);
        }
      }}
      className={cn(
        "group relative flex items-center justify-between px-3.5 py-2.5 sm:p-3 rounded-2xl transition-all duration-300 cursor-pointer select-none text-start",
        effectiveSelected
          ? "bg-primary/8 ring-1 ring-primary scale-[0.98]"
          : "bg-muted/5",
        isOutOfStock && "opacity-80",
      )}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <ProductThumbnail
          src={imgSrc}
          alt={product.name}
          onOpenBottomSheet={() => onOpenBottomSheet?.(product)}
        />

        <div className="flex flex-col justify-between self-stretch min-w-0 py-0.5">
          <div className="min-w-0">
            <span className="text-[11px] sm:text-xs font-light text-muted/90 block truncate">
              {product.brand}
            </span>
            <h3 className="text-xs min-[390px]:text-xs sm:text-sm font-medium text-foreground leading-[1.35] mt-0.5 break-words">
              {product.name}
            </h3>
          </div>

          {/* Product Badges (Dimensions/Weight, Grade, Coverage) */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {product.productType === "other" ? (
              <>
                {product.weight ? (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                    {formatUnit(product.unit)} {toPersianDigits(product.weight)}
                  </span>
                ) : product.itemsPerPack ? (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                    {formatUnit(product.unit)}{" "}
                    {toPersianDigits(product.itemsPerPack)}
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                    {formatUnit(product.unit)}
                  </span>
                )}
                {product.approxCoverage && (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                    {product.approxCoverage}
                  </span>
                )}
                {product.grade && (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                    {formatGrade(product.grade)}
                  </span>
                )}
              </>
            ) : (
              <>
                {product.dimensions?.width && product.dimensions?.height && (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                    {toPersianDigits(product.dimensions.width)} ×{" "}
                    {toPersianDigits(product.dimensions.height)}
                  </span>
                )}
                {product.grade && (
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                    {formatGrade(product.grade)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* End (Left in RTL): Price centered vertically on top & Inventory Badge at bottom */}
      <div className="flex flex-col justify-between items-end self-stretch shrink-0 ps-3 py-0.5 text-end">
        {/* Top: Price & In-Cart Status - Centered vertically from top */}
        <div className="flex-1 flex flex-col justify-center items-end">
          {isInCart && (
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary mb-1">
              در سبد خرید
            </span>
          )}

          <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
            <span>{formatToman(product.finalCustomerPricePerSqm)}</span>
            <TomanIcon className="size-3.5" />
          </span>
        </div>

        {/* Bottom: Inventory Badge - Shows red "ناموجود" if out of stock, otherwise exact stock or presence badge */}
        <div className="mt-auto">
          {isOutOfStock ? (
            <span className="px-2 py-1 rounded-lg flex text-xs font-semibold bg-danger/15 text-danger">
              <span>ناموجود</span>
            </span>
          ) : product.hideExactStock ? (
            <span className="px-2 py-1 rounded-lg flex text-xs font-semibold bg-success/20 text-success">
              <span>موجود</span>
            </span>
          ) : (
            <span className="px-2 py-1 rounded-lg flex text-xs font-semibold bg-foreground text-background">
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
