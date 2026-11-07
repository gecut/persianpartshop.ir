import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { cn, SearchField, Button } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useProducts } from "../../features/products/product-store";
import { ProductCard } from "../../features/products/product-card";
import { ProductBottomSheet } from "../../features/products/product-bottom-sheet";
import { FilterDrawer } from "../../features/products/filter-drawer";
import type { Product } from "../../types";
import { useAuth } from "../../features/auth/auth-store";
import { useCart } from "../../features/cart/cart-store";
import { selectionStore, useProductSelection } from "../../features/products/selection-store";
import { toPersianDigits } from "../../lib/utils/currency";
import { ProductCardSkeleton } from "../../components/ui/skeleton";
import {
  FilterIcon,
  XIcon,
  RefreshCwIcon,
  BoxIcon,
  ArrowLeftIcon,
} from "../../components/ui/icons";

export const Route = createFileRoute("/product/")({
  component: ProductListPage,
});

const PRODUCT_PAGE_SIZE = 24;

const PRODUCT_DIMENSIONS = [
  "30×90",
  "60×120",
  "80×160",
  "100×100",
  "120×240",
  "60×60",
  "30×60",
  "20×120",
] as const;

function ProductListPage() {
  const navigate = useNavigate();
  const productHook = useProducts();
  const {
    products,
    allProducts,
    dimensions,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    isLoading,
  } = productHook;
  const { user } = useAuth();
  const isOrderingDisabled = Boolean(user?.disableOrdering) || Boolean(user?.hideExactStock);
  const { items: cartItems } = useCart();
  const {
    selectedIds,
    toggleProduct,
    selectProduct,
    reconcileWithProducts,
    clearSelection,
  } = useProductSelection();

  const cartIdSet = useMemo(
    () => new Set(cartItems.map((i) => String(i.productId))),
    [cartItems],
  );
  const selectedIdSet = useMemo(
    () => new Set(selectedIds.map(String)),
    [selectedIds],
  );

  // If ordering is disabled, clear any stale selections from memory
  useEffect(() => {
    if (isOrderingDisabled && selectedIds.length > 0) {
      clearSelection();
    }
  }, [isOrderingDisabled, selectedIds.length, clearSelection]);

  // Reconcile selected IDs with live products to eliminate any phantom/ghost IDs
  useEffect(() => {
    if (!isLoading && allProducts && allProducts.length > 0) {
      reconcileWithProducts(allProducts.map((p) => p.id));
    }
  }, [isLoading, allProducts, reconcileWithProducts]);

  // Count only valid selected products
  const selectedCount = useMemo(() => {
    if (!allProducts || allProducts.length === 0) {
      return selectedIds.length;
    }
    const productSet = new Set(
      allProducts.map((p) => String(p.id).replace(/["']/g, "").trim()),
    );
    return selectedIds.filter((id) =>
      productSet.has(String(id).replace(/["']/g, "").trim()),
    ).length;
  }, [allProducts, selectedIds]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeBottomSheetProduct, setActiveBottomSheetProduct] =
    useState<Product | null>(null);

  const handleOpenBottomSheet = useCallback((product: Product) => {
    setActiveBottomSheetProduct(product);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setActiveBottomSheetProduct(null);
  }, []);

  const handleToggleSelect = useCallback(
    (product: Product) => {
      if (isOrderingDisabled) {
        handleOpenBottomSheet(product);
        return;
      }
      toggleProduct(product.id);
    },
    [isOrderingDisabled, toggleProduct, handleOpenBottomSheet],
  );

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const observerTargetRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const [displayCount, setDisplayCount] = useState(PRODUCT_PAGE_SIZE);

  // Reset to 24 when filters change
  useEffect(() => {
    setDisplayCount(PRODUCT_PAGE_SIZE);
  }, [filters]);

  const visibleProducts = useMemo(() => {
    return products.slice(0, displayCount);
  }, [products, displayCount]);

  const hasMore = displayCount < products.length;

  useEffect(() => {
    if (!hasMore) return;
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => Math.min(prev + PRODUCT_PAGE_SIZE, products.length));
        }
      },
      { threshold: 0.1, rootMargin: "300px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

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
    [visibleProducts],
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
      setDisplayCount((prev) => Math.min(prev + PRODUCT_PAGE_SIZE, products.length));
    }
  }, [virtualItems, visibleProducts.length, hasMore, products.length]);

  return (
    <div className="w-full px-4 py-3 space-y-3 text-start pb-8 bg-background">
      {/* 1. Search Bar & Advanced Filters Trigger */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 text-base">
          <SearchField name="search">
            <SearchField.Group className="h-12 border-0 shadow-none bg-muted/5 rounded-2xl px-3 flex items-center">
              <SearchField.SearchIcon />
              <SearchField.Input
                onChange={(e) => setFilter("searchQuery", e.target.value)}
                className="w-full text-sm font-base placeholder:text-sm"
                placeholder="جستجو محصولات"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {filters.searchQuery && (
            <Button
              type="button"
              onClick={() => setFilter("searchQuery", "")}
              className="absolute end-s-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-xl text-muted hidden hover:text-foreground  items-center justify-center cursor-pointer"
              aria-label="پاک کردن متن جستجو"
            >
              <XIcon size={14} />
            </Button>
          )}
        </div>
        <Button
          type="button"
          onClick={() => setIsFilterOpen(true)}
          aria-label="فیلترهای پیشرفته"
          className={cn(
            "w-auto h-12 px-4 rounded-2xl font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer active:scale-95 select-none transition-colors duration-250",
            activeFilterCount > 0
              ? "bg-[#252745] text-"
              : "bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground",
          )}
        >
          <FilterIcon size={16} />
          <AnimatePresence initial={false}>
            {activeFilterCount > 0 && (
              <motion.span
                key="filter-badge-wrap"
                variants={{
                  initial: {
                    width: 0,
                    opacity: 0,
                    scale: 0.2,
                    marginInlineStart: 0,
                  },
                  animate: {
                    width: "auto",
                    opacity: [0, 0.8, 1, 1],
                    scale: [0.2, 1.25, 0.92, 1],
                    marginInlineStart: 6,
                    transition: {
                      duration: 0.28,
                      times: [0, 0.45, 0.75, 1],
                      ease: "easeOut",
                    },
                  },
                  exit: {
                    width: 0,
                    opacity: [1, 0.7, 0],
                    scale: [1, 1.08, 0],
                    marginInlineStart: 0,
                    transition: {
                      duration: 0.18,
                      times: [0, 0.25, 1],
                      ease: [0.4, 0, 0.2, 1],
                    },
                  },
                }}
                initial="initial"
                animate="animate"
                exit="exit"
                className="overflow-hidden flex items-center justify-center shrink-0 whitespace-nowrap"
              >
                <span className="min-w-4.5 h-4.5  rounded-full bg-white text-primary text-xs font-bold flex items-center justify-center shrink-0 select-none">
                  <motion.span
                    key={activeFilterCount}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {toPersianDigits(activeFilterCount)}
                  </motion.span>
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>

      {/* 3. Dimensions Filter Strip (Smooth, zero-flicker selection) */}
      <div
        className="w-full overflow-x-auto pb-1 pt-0.5 scrollbar-none"
        role="tablist"
        aria-label="فیلتر ابعاد کاشی و سرامیک"
      >
        <div className="flex items-center gap-1.5 min-w-max">
          <Button
            type="button"
            onPress={() => setFilter("selectedDimension", null)}
            className={cn(
              "h-10 px-4 text-xs font-bold rounded-2xl whitespace-nowrap transition-colors duration-200 cursor-pointer shrink-0 select-none",
              !filters.selectedDimension
                ? "bg-[#252745] text-background"
                : "bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground",
            )}
          >
            همه
          </Button>
          {(dimensions && dimensions.length > 0
            ? dimensions
            : PRODUCT_DIMENSIONS
          ).map((dim) => {
            const isSelected = filters.selectedDimension === dim;
            return (
              <Button
                key={dim}
                type="button"
                onPress={() =>
                  setFilter("selectedDimension", isSelected ? null : dim)
                }
                className={cn(
                  "h-10 px-4 text-xs font-bold rounded-2xl whitespace-nowrap transition-colors duration-200 cursor-pointer shrink-0 select-none",
                  isSelected
                    ? "bg-[#252745] text-background"
                    : "bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground",
                )}
              >
                {toPersianDigits(dim)}
              </Button>
            );
          })}
        </div>
      </div>

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        productHook={productHook}
      />

      {/* Status & Active Count */}
      <div className="flex items-center justify-between gap-2 mt-2 px-1 py-1 min-h-7 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground leading-5">
            لیست محصولات
          </span>

          {activeFilterCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetFilters}
              className="text-xs font-semibold m-0! p-0! px-1.5! h-5! min-h-0! bg-transparent! text-primary cursor-pointer hover:bg-transparent! hover:opacity-80 transition-opacity"
            >
              پاک کردن فیلترها ({toPersianDigits(activeFilterCount)})
            </Button>
          )}
        </div>
      </div>

      {/* Product Items Display */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <ProductCardSkeleton key={idx} viewMode="list" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-muted/5 rounded-2xl p-8 text-center my-4 space-y-2.5">
          <div className="size-12 rounded-2xl bg-default/20 text-muted flex items-center justify-center mx-auto">
            <BoxIcon size={24} />
          </div>
          <h3 className="text-sm font-extrabold text-foreground">
            محصولی با این مشخصات یافت نشد
          </h3>
          <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
            با تغییر یا حذف فیلترها، مجدداً جستجو کنید.
          </p>
          <Button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <RefreshCwIcon size={13} />
            <span>پاک کردن فیلترها</span>
          </Button>
        </div>
      ) : (
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
              const isSelected = selectedIdSet.has(String(product.id));

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  <ProductCard
                    product={product}
                    isSelected={isSelected}
                    isInCart={inCart}
                    isOrderingDisabled={isOrderingDisabled}
                    onToggleSelect={handleToggleSelect}
                    onOpenBottomSheet={handleOpenBottomSheet}
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
      )}

      {/* Floating Action Bar (FAB) */}
      {!isOrderingDisabled && selectedCount > 0 && (
        <div className="fixed bottom-24 1 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <Link
            to="/product/new"
            aria-label={`تعیین متراژ و ثبت سفارش ${toPersianDigits(selectedCount)} محصول انتخاب شده`}
            className="h-12 px-5 rounded-2xl bg-[#252745] text-background flex items-center gap-3 cursor-pointer active:scale-95 transition-all select-none touch-manipulation hover:bg-[#2e3155]"
          >
            <span className="min-w-6 h-6 px-1.5 rounded-lg bg-success/15 text-success font-bold text-xs flex items-center justify-center">
              {toPersianDigits(selectedCount)}
            </span>
            <span className="text-sm font-bold">ثبت سفارش</span>
            <ArrowLeftIcon size={16} className="text-background/80" />
          </Link>
        </div>
      )}

      {/* Product Bottom Sheet */}
      <ProductBottomSheet
        product={activeBottomSheetProduct}
        isOpen={Boolean(activeBottomSheetProduct)}
        isSelected={
          activeBottomSheetProduct
            ? selectedIdSet.has(String(activeBottomSheetProduct.id))
            : false
        }
        isOrderingDisabled={isOrderingDisabled}
        onClose={handleCloseBottomSheet}
        onToggleSelect={
          activeBottomSheetProduct
            ? () => handleToggleSelect(activeBottomSheetProduct)
            : undefined
        }
        onOrderDirect={async (product) => {
          if (isOrderingDisabled) return;
          handleCloseBottomSheet();
          await selectProduct(product.id);
          if (!selectionStore.getSnapshot().selectedIds.includes(product.id)) return;
          navigate({
            to: "/product/new",
          });
        }}
      />
    </div>
  );
}
