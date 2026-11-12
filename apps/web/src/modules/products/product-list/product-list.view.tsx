import { useCatalogProduct } from "@/modules/products/catalog-data"
import { QueryLoadError } from "@/components/feedback/query-load-error"
import { SupplyRequestRecovery } from "@/modules/supply-requests/supply-request-recovery"
import { supplyDraftStore, useSupplyDraft } from "@/modules/supply-requests/supply-request-draft"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useNavigate, getRouteApi } from "@tanstack/react-router"
import { Button } from "@heroui/react"
import { useProducts } from "@/modules/products/product-store"
import { ProductBottomSheet } from "@/modules/products/product-bottom-sheet/product-bottom-sheet"
import { ProductQrScanner } from "@/modules/products/product-qr-scanner"
import { FilterDrawer } from "@/modules/products/filter-drawer/filter-drawer"
import type { Product } from "@/modules/products/product-types"
import { useAuth } from "@/modules/auth/auth-store"
import { useCart } from "@/modules/cart/cart-store"
import { selectionStore, useProductSelection } from "@/modules/products/selection-store"
import { toPersianDigits } from "@/lib/utils/currency"
import { ProductCardSkeleton } from "@/modules/products/product-card-skeleton"
import { DimensionFilter } from "@/modules/products/dimension-filter"

import { useProductPagination } from "./_use-product-pagination"
import { useProductVirtualizer } from "./_use-product-virtualizer"
import { ProductSearchBar } from "./_product-search-bar"
import { EmptyProducts } from "./_empty-products"
import { ProductVirtualList } from "./_product-virtual-list"
import { ProductOrderCta } from "./_product-order-cta"

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
    dispatchFilter,
    resetFilters,
    activeFilterCount,
    isLoading,
    loadError,
    isFetching,
    refetch,
    isRestoring,
    offlineWithoutCatalog,
    showingSavedCatalog,
    showingPartialCatalog,
    hasCatalog,
    complete,
    online,
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
    if (complete && !showingSavedCatalog && allProducts.length > 0) {
      reconcileWithProducts(allProducts.map((p) => p.id));
    }
  }, [complete, showingSavedCatalog, allProducts, reconcileWithProducts]);

  // Count only valid selected products
  const selectedCount = selectedIds.length;
  const activeFlow = supplyId ? "supply" : "order";

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const sharedProduct = useCatalogProduct(activeProductId ?? productId);
  const activeBottomSheetProduct = sharedProduct.data;

  const handleOpenBottomSheet = useCallback((product: Product) => {
    setActiveProductId(product.id);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setActiveProductId(null);
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


  const { observerTargetRef, setDisplayCount, visibleProducts, hasMore } =
    useProductPagination({ filters, products, productHook });

  const { listContainerRef, virtualizer, virtualItems } = useProductVirtualizer({
    filters,
    products,
    visibleProducts,
    hasMore,
    productHook,
    setDisplayCount,
  });

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
      {productId && !sharedProduct.data && sharedProduct.error && (
        <QueryLoadError
          message={sharedProduct.offlineMissing ? sharedProduct.error.message : "دریافت محصول این لینک ممکن نشد."}
          onRetry={() => void sharedProduct.refetch()}
        />
      )}
      {productId && sharedProduct.isPending && (
        <p role="status" className="text-sm text-muted">در حال دریافت محصول…</p>
      )}
      {/* 1. Search Bar & Advanced Filters Trigger */}
      <ProductSearchBar
        searchQuery={filters.searchQuery}
        canUseProductQr={Boolean(user?.canUseProductQr)}
        activeFilterCount={activeFilterCount}
        onSearchChange={(value) => dispatchFilter({ type: "searchQuery", query: value })}
        onScan={() => setIsScannerOpen(true)}
        onOpenFilter={() => setIsFilterOpen(true)}
      />


      <DimensionFilter
        dimensions={dimensions}
        selectedDimension={filters.selectedDimension}
        isLoading={online && !isRestoring && !hasCatalog && dimensionsQuery.isPending}
        error={dimensionsQuery.isError && !dimensionsQuery.data}
        onRetry={() => void dimensionsQuery.refetch()}
        onSelect={(dimension) => dispatchFilter({ type: "selectedDimension", dimension })}
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
      {showingSavedCatalog && (
        <p role="status" className="text-sm text-muted">نسخهٔ ذخیره‌شدهٔ کاتالوگ. قیمت و موجودی مربوط به آخرین دریافت است.</p>
      )}
      {showingPartialCatalog && (
        <p role="status" className="text-sm text-muted">بخشی از کاتالوگ در دسترس است.</p>
      )}
      {isRestoring ? null : offlineWithoutCatalog ? (
        <QueryLoadError message="برای دریافت فهرست محصولات به اینترنت وصل شوید." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <ProductCardSkeleton key={idx} viewMode="list" />
          ))}
        </div>
      ) : loadError ? (
        <QueryLoadError message="دریافت فهرست محصولات ممکن نشد." onRetry={() => void refetch()} />
      ) : products.length === 0 && showingPartialCatalog ? (
        <p className="text-sm text-muted">در کالاهای دریافت‌شده موردی پیدا نشد.</p>
      ) : products.length === 0 && !isFetching ? (
        <EmptyProducts onReset={resetFilters} />
      ) : (
        <ProductVirtualList
          virtualizer={virtualizer}
          virtualItems={virtualItems}
          visibleProducts={visibleProducts}
          listContainerRef={listContainerRef}
          observerTargetRef={observerTargetRef}
          hasMore={hasMore}
          fetchingRemoteMore={productHook.fetchingRemoteMore}
          cartIdSet={cartIdSet}
          selectedIdSet={selectedIdSet}
          supplyId={supplyId}
          isOrderingDisabled={isOrderingDisabled}
          onToggleSelect={handleToggleSelect}
          onOpenBottomSheet={handleOpenBottomSheet}
        />
      )}

      {selectionError && (
        <p role="alert" className="text-sm text-danger">
          {selectionError}
        </p>
      )}
      {/* Catalog selection has a single active kind; changing it clears the previous draft. */}
      {!isOrderingDisabled && (selectedCount > 0 || supplyId) && (
        <ProductOrderCta
          activeFlow={activeFlow}
          supplyId={supplyId}
          selectedCount={selectedCount}
          busy={busy}
          warehouse={warehouse}
        />
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
