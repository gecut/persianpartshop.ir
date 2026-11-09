import { useCatalogProduct } from "./catalog-data";
import { DataStatus } from "@/components/feedback/data-status";
import { SupplyRequestRecovery } from "@/modules/supply-requests/supply-request-recovery";
import {
  supplyDraftStore,
  useSupplyDraft,
} from "@/modules/supply-requests/supply-request-draft";

import { useSessionValue } from "./use-session-value";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { useNavigate, Link, getRouteApi } from "@tanstack/react-router"
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { cn, SearchField, Button } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useProducts } from "./product-store";
import { ProductCard } from "./product-card";
import { ProductBottomSheet } from "./product-bottom-sheet";
import { ProductQrScanner } from "./product-qr-scanner";
import { FilterDrawer } from "./filter-drawer";
import type { Product } from "./product-types"
import { useAuth } from "@/modules/auth/auth-store";
import { useCart } from "@/modules/cart/cart-store";
import {
  selectionStore,
  useProductSelection,
} from "./selection-store";
import { toPersianDigits } from "@/lib/utils/currency";
import { ProductCardSkeleton } from "./product-card-skeleton";
import { DimensionFilter } from "./dimension-filter";
import {
  FilterIcon,
  XIcon,
  RefreshCwIcon,
  BoxIcon,
  ArrowLeftIcon,
} from "@/components/ui/icons";


const PRODUCT_PAGE_SIZE = 24;

const routeApi = getRouteApi('/product/')

export function ProductListView() {
  const navigate = useNavigate();
  const { draft: supplyDraft } = useSupplyDraft();
  const supplyId =
    supplyDraft?.selected !== false ? supplyDraft?.productId : undefined;
  const { productId } = routeApi.useSearch();
  const productHook = useProducts();
  const {
    products,
    allProducts,
    dimensions,
    dimensionsQuery,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    isLoading,
    error,
    isFetching,
    refetch,
  } = productHook;
  const { user } = useAuth();
  const isOrderingDisabled =
    Boolean(user?.disableOrdering) || Boolean(user?.hideExactStock);
  const { items: cartItems } = useCart();
  const {
    selectedIds,
    warehouse,
    busy,
    error: selectionError,
    selectProduct,
    toggleProduct,
    reconcileWithProducts,
    clearSelection,
  } = useProductSelection();

  const cartIdSet = useMemo(
    () => new Set(cartItems.map((i) => String(i.productId))),
    [cartItems]
  );
  const selectedIdSet = useMemo(
    () => new Set(selectedIds.map(String)),
    [selectedIds]
  );

  // Older sessions could retain both kinds. An active supply selection takes precedence.
  useEffect(() => {
    if (supplyId && selectedIds.length) clearSelection();
  }, [supplyId, selectedIds.length, clearSelection]);

  // Reconcile selected IDs with live products to eliminate any phantom/ghost IDs
  useEffect(() => {
    if (!isLoading && allProducts && allProducts.length > 0) {
      reconcileWithProducts(allProducts.map((p) => p.id));
    }
  }, [isLoading, allProducts, reconcileWithProducts]);

  // Count only valid selected products
  const selectedCount = selectedIds.length;
  const activeFlow = supplyId ? "supply" : "order";

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeBottomSheetProduct, setActiveBottomSheetProduct] =
    useState<Product | null>(null);

  const sharedProduct = useCatalogProduct(productId);
  useEffect(() => {
    if (productId && sharedProduct.data) {
      setActiveBottomSheetProduct(sharedProduct.data);
    }
  }, [productId, sharedProduct.data]);

  const handleOpenBottomSheet = useCallback((product: Product) => {
    setActiveBottomSheetProduct(product);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setActiveBottomSheetProduct(null);
    if (productId)
      void navigate({
        to: "/product",
        search: (previous) => ({ ...previous, productId: undefined }),
        replace: true,
        resetScroll: false,
      });
  }, [navigate, productId]);

  const handleOpenSupplyRequest = useCallback(
    (product: Product) => {
      if (supplyDraftStore.open(Number(product.id))) clearSelection();
    },
    [clearSelection]
  );

  const handleToggleSelect = useCallback(
    (product: Product) => {
      if (isOrderingDisabled) {
        handleOpenBottomSheet(product);
        return;
      }
      if (!product.inStock && product.hasSupplySource) {
        if (supplyId === Number(product.id)) supplyDraftStore.deselect();
        else handleOpenSupplyRequest(product);
        return;
      }
      if (!supplyDraftStore.discard()) return;
      void toggleProduct(product.id);
    },
    [
      isOrderingDisabled,
      handleOpenBottomSheet,
      handleOpenSupplyRequest,
      toggleProduct,
      supplyId,
    ]
  );

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const observerTargetRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

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

  return (
    <div className="w-full px-4 py-3 space-y-3 text-start pb-8 bg-background">
      <SupplyRequestRecovery
        onSuccess={(id) => {
          void navigate({
            to: "/orders",
            search: { view: "supply", requestId: id },
          });
        }}
      />
      {error && (
        <DataStatus
          error={error}
          hasData={allProducts.length > 0}
          fetching={isFetching}
          onRetry={() => void refetch()}
        />
      )}
      {productId && (sharedProduct.isPending || sharedProduct.error) && (
        <DataStatus
          error={sharedProduct.error}
          fetching={sharedProduct.isFetching}
          onRetry={() => void sharedProduct.refetch()}
        />
      )}
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
        {user?.canUseProductQr && (
          <Button
            type="button"
            isIconOnly
            variant="ghost"
            onPress={() => setIsScannerOpen(true)}
            aria-label="اسکن محصول"
            className="size-12 shrink-0 rounded-2xl bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground"
          >
            <svg
              aria-hidden="true"
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
              <path d="M8 8h3v3H8zM15 8h1v1h-1zM8 15h1v1H8zM14 14h2v2h-2z" />
            </svg>
          </Button>
        )}
        <Button
          type="button"
          onClick={() => setIsFilterOpen(true)}
          aria-label="فیلترهای پیشرفته"
          className={cn(
            "w-auto h-12 px-4 rounded-2xl font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer active:scale-95 select-none transition-colors duration-250",
            activeFilterCount > 0
              ? "bg-[#252745] text-"
              : "bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground"
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

      <DimensionFilter
        dimensions={dimensions}
        selectedDimension={filters.selectedDimension}
        isLoading={dimensionsQuery.isPending}
        error={dimensionsQuery.isError && !dimensionsQuery.data}
        onRetry={() => void dimensionsQuery.refetch()}
        onSelect={(dimension) => setFilter("selectedDimension", dimension)}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        productHook={productHook}
        supplyMode={false}
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
      ) : (error || !navigator.onLine) &&
        !allProducts.length ? null : products.length === 0 && !isFetching ? (
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

      {selectionError && (
        <p role="alert" className="text-sm text-danger">
          {selectionError}
        </p>
      )}
      {/* Catalog selection has a single active kind; changing it clears the previous draft. */}
      {!isOrderingDisabled && (selectedCount > 0 || supplyId) && (
        <div className="fixed bottom-24 start-1/2 translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-[calc(100%-2rem)]">
          <Link
            to={
              activeFlow === "supply" ? "/product/supply/$id" : "/product/new"
            }
            params={{ id: String(supplyId ?? "") }}
            onClick={(event) => {
              if (activeFlow !== "order") return;
              event.preventDefault();
              if (busy) return;
              void selectionStore.revalidate().then(() => {
                const current = selectionStore.getSnapshot();
                if (
                  !current.error &&
                  current.warehouse &&
                  current.quotes.length === current.selectedIds.length &&
                  current.selectedIds.length
                )
                  void navigate({ to: "/product/new" });
              });
            }}
            className="h-12 px-5 rounded-2xl bg-[#252745] text-background flex items-center gap-3 whitespace-nowrap active:scale-95 transition-transform hover:bg-[#2e3155]"
          >
            <span className="min-w-6 h-6 px-1.5 rounded-lg bg-success/15 text-success font-bold text-xs flex items-center justify-center">
              {toPersianDigits(activeFlow === "supply" ? 1 : selectedCount)}
            </span>
            <span className="text-sm font-bold">
              {activeFlow === "supply"
                ? "درخواست تأمین"
                : busy
                ? "در حال بررسی…"
                : warehouse
                ? `ثبت سفارش · ${warehouse.name}`
                : "ثبت سفارش"}
            </span>
            <ArrowLeftIcon size={16} />
          </Link>
        </div>
      )}

      {/* Product Bottom Sheet */}
      {isScannerOpen && (
        <ProductQrScanner
          onClose={() => setIsScannerOpen(false)}
          onProduct={(product) => {
            setIsScannerOpen(false);
            requestAnimationFrame(() => handleOpenBottomSheet(product));
          }}
        />
      )}
      <ProductBottomSheet
        product={activeBottomSheetProduct}
        isOpen={Boolean(activeBottomSheetProduct)}
        isSelected={
          activeBottomSheetProduct
            ? selectedIdSet.has(String(activeBottomSheetProduct.id)) ||
              supplyId === Number(activeBottomSheetProduct.id)
            : false
        }
        isOrderingDisabled={isOrderingDisabled}
        onClose={handleCloseBottomSheet}
        onRequestSupply={(product) => {
          handleCloseBottomSheet();
          handleOpenSupplyRequest(product);
        }}
        onToggleSelect={
          activeBottomSheetProduct
            ? () => handleToggleSelect(activeBottomSheetProduct)
            : undefined
        }
        onOrderDirect={async (product) => {
          if (isOrderingDisabled) return;
          if (!product.inStock && product.hasSupplySource) {
            handleCloseBottomSheet();
            handleOpenSupplyRequest(product);
            return;
          }
          handleCloseBottomSheet();
          if (!supplyDraftStore.discard()) return;
          await selectProduct(product.id);
          if (!selectionStore.getSnapshot().selectedIds.includes(product.id))
            return;
          navigate({
            to: "/product/new",
          });
        }}
      />
    </div>
  );
}
