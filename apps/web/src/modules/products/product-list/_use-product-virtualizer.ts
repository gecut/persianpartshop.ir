
import type { Dispatch, SetStateAction } from "react"
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { useProducts } from "@/modules/products/product-store"
import type { Product } from "@/modules/products/product-types"
import { PRODUCT_PAGE_SIZE } from "./_use-product-pagination"

type ProductsHook = ReturnType<typeof useProducts>;

interface UseProductVirtualizerArgs {
  filters: ProductsHook["filters"];
  products: Product[];
  visibleProducts: Product[];
  hasMore: boolean;
  productHook: ProductsHook;
  setDisplayCount: Dispatch<SetStateAction<number>>;
}

export function useProductVirtualizer({ filters, products, visibleProducts, hasMore, productHook, setDisplayCount }: UseProductVirtualizerArgs) {
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (listContainerRef.current) {
      setScrollMargin(listContainerRef.current.offsetTop);
    }
  }, [filters]);

  useEffect(() => {
    const handleResize = () => {
      if (listContainerRef.current) {
        setScrollMargin(listContainerRef.current.offsetTop);
      }
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getItemKey = useCallback(
    (index: number) => visibleProducts[index]?.id ?? index,
    [visibleProducts]
  );

  const virtualizer = useWindowVirtualizer({
    count: visibleProducts.length,
    estimateSize: () => 104,
    overscan: 8,
    scrollMargin,
    gap: 8,
    getItemKey,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= visibleProducts.length - 4 && hasMore) {
      setDisplayCount((prev) =>
        Math.min(prev + PRODUCT_PAGE_SIZE, products.length)
      );
      productHook.loadMore();
    }
  }, [virtualItems, visibleProducts.length, hasMore, products.length]);

  return { listContainerRef, virtualizer, virtualItems };
}
