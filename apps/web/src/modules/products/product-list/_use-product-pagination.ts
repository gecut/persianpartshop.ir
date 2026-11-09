
import { useSessionValue } from "@/modules/products/use-session-value"
import { useMemo, useEffect, useRef } from "react"
import { useProducts } from "@/modules/products/product-store"
import type { Product } from "@/modules/products/product-types"
type ProductsHook = ReturnType<typeof useProducts>;

export const PRODUCT_PAGE_SIZE = 24;

interface UseProductPaginationArgs {
  filters: ProductsHook["filters"];
  products: Product[];
  productHook: ProductsHook;
}

export function useProductPagination({ filters, products, productHook }: UseProductPaginationArgs) {
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  const [displayCount, setDisplayCount] = useSessionValue<number>(
    `product-count:${JSON.stringify(filters)}`,
    PRODUCT_PAGE_SIZE
  );

  // Reset to 24 when filters change
  const filterSignature = JSON.stringify(filters);
  const previousFilters = useRef(filterSignature);
  useEffect(() => {
    if (previousFilters.current !== filterSignature)
      setDisplayCount(PRODUCT_PAGE_SIZE);
    previousFilters.current = filterSignature;
  }, [filterSignature, setDisplayCount]);

  const visibleProducts = useMemo(() => {
    return products.slice(0, displayCount);
  }, [products, displayCount]);

  const hasMore = displayCount < products.length || productHook.hasRemoteMore;

  useEffect(() => {
    if (!hasMore) return;
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) =>
            Math.min(prev + PRODUCT_PAGE_SIZE, products.length)
          );
          productHook.loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "300px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  return { observerTargetRef, setDisplayCount, visibleProducts, hasMore };
}
