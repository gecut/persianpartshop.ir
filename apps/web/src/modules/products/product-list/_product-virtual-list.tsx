
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { ProductCard } from "@/modules/products/product-card"
import type { Product } from "@/modules/products/product-types"
import { ProductCardSkeleton } from "@/modules/products/product-card-skeleton"
import type { RefObject } from "react"

type Virtualizer = ReturnType<typeof useWindowVirtualizer<Element>>;

interface ProductVirtualListProps {
  virtualizer: Virtualizer;
  virtualItems: ReturnType<Virtualizer["getVirtualItems"]>;
  visibleProducts: Product[];
  listContainerRef: RefObject<HTMLDivElement | null>;
  observerTargetRef: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  cartIdSet: Set<string>;
  selectedIdSet: Set<string>;
  supplyId: number | undefined;
  isOrderingDisabled: boolean;
  onToggleSelect: (product: Product) => void;
  onOpenBottomSheet: (product: Product) => void;
}

export function ProductVirtualList({ virtualizer, virtualItems, visibleProducts, listContainerRef, observerTargetRef, hasMore, cartIdSet, selectedIdSet, supplyId, isOrderingDisabled, onToggleSelect, onOpenBottomSheet }: ProductVirtualListProps) {
  return (
    <div className="w-full">
      <div
        ref={listContainerRef}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const product = visibleProducts[virtualRow.index];
          if (!product) return null;

          const inCart = cartIdSet.has(String(product.id));
          const isSelected =
            selectedIdSet.has(String(product.id)) ||
            supplyId === Number(product.id);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                insetInlineStart: 0,
                width: "100%",
                transform: `translateY(${
                  virtualRow.start - virtualizer.options.scrollMargin
                }px)`,
              }}
            >
              <ProductCard
                product={product}
                isSelected={isSelected}
                isInCart={inCart}
                isOrderingDisabled={isOrderingDisabled}
                onToggleSelect={onToggleSelect}
                onOpenBottomSheet={onOpenBottomSheet}
              />
            </div>
          );
        })}
      </div>

      {/* Infinite Scroll Loading Sentinel */}
      {hasMore && (
        <div ref={observerTargetRef} className="pt-2">
          <ProductCardSkeleton />
        </div>
      )}
    </div>
  );
}
