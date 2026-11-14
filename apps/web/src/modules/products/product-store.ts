import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { match } from "ts-pattern";

import { api } from "@/lib/api-client";

import { useQueryStates } from "nuqs";
import { productFilterParsers, type SortOption } from "./product-filters";
import { queryKeys } from "@/lib/query-keys";

export type { SortOption };

export { mapCatalogProduct, resolveMediaUrl, formatGrade, formatUnit } from "./catalog-mapper";
import { mapCatalogProduct } from "./catalog-mapper";
import { defaultBrowseFilters, firstBrowsePage, isDefaultBrowse } from "./_catalog-browse";
import { catalogMaxAge } from "./catalog-coordinator";
import { catalogCoordinator, useCatalogData } from "./catalog-data";
import { browseOffline } from "./_browse-offline";
export type ViewMode = "list" | "grid-2" | "grid-3" | "compact";

export interface FilterState {
  searchQuery: string;
  selectedDimension: string | null;
  selectedBrands: string[];
  selectedColors: string[];
  selectedGrades: string[];
  selectedTags: string[];
  selectedCategory: string | null;
  onlyInStock: boolean;
  viewMode: ViewMode;
  sortBy: SortOption;
}

export type ProductFilterAction =
  | { type: "searchQuery"; query: string | null }
  | { type: "selectedDimension"; dimension: string | null }
  | { type: "selectedBrands"; brands: string[] }
  | { type: "selectedColors"; colors: string[] }
  | { type: "selectedGrades"; grades: string[] }
  | { type: "selectedTags"; tags: string[] }
  | { type: "selectedCategory"; category: string | null }
  | { type: "onlyInStock"; onlyInStock: boolean }
  | { type: "viewMode"; mode: ViewMode }
  | { type: "sortBy"; sort: SortOption };

export function useProducts(supplyMode = false) {
  const [queryFilters, setQueryFilters] = useQueryStates(productFilterParsers, {
    shallow: true,
  });
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const { state: catalog, pack, owner, online, isRestoring } = useCatalogData(true);
  const dimensionsQuery = useQuery({
    queryKey: queryKeys.products.facets(owner),
    queryFn: ({ signal }) => api.catalog.facets(undefined, { signal }),
    enabled: !!owner && online,
    staleTime: 15 * 60_000,
    select: result => result.dimensions,
  });
  const requestedSearch = queryFilters.q.trim();
  const [search, setSearch] = useState(requestedSearch);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(requestedSearch), 300);
    return () => clearTimeout(timer);
  }, [requestedSearch]);

  const browseInput = {
    ...defaultBrowseFilters,
    search,
    dimension: queryFilters.dimension,
    brands: queryFilters.brands,
    colors: queryFilters.colors,
    grades: queryFilters.grades,
    tags: queryFilters.tags,
    category: queryFilters.category,
    inStock: queryFilters.inStock,
    supplyMode,
    sort: queryFilters.sort,
  };
  const searchReady = search === requestedSearch;
  const defaultBrowse = isDefaultBrowse(browseInput);
  const browse = useInfiniteQuery({
    queryKey: queryKeys.products.browse(owner, browseInput),
    queryFn: ({ pageParam, signal }) => catalogCoordinator.browse(owner, { ...browseInput, page: pageParam }, signal),
    initialPageParam: firstBrowsePage,
    getNextPageParam: (last, _pages, lastPage) => last.hasMore ? lastPage + 1 : undefined,
    enabled: !!owner && online && !isRestoring && searchReady,
    staleTime: 120_000,
    ...(defaultBrowse && { gcTime: catalogMaxAge }),
    refetchOnReconnect: 'always',
  });

  const matchingPages = !isRestoring && searchReady && browse.data?.pages[0]?.scopeKey === catalog.scopeKey
    ? browse.data.pages
    : undefined;
  const offlinePage = !online && defaultBrowse ? matchingPages?.[0] : undefined;
  const offlineProducts = useMemo(() => pack && searchReady
    ? browseOffline(Object.values(pack.data.products), browseInput).map(mapCatalogProduct)
    : undefined, [pack, searchReady, search, queryFilters, supplyMode]);
  const products = useMemo(() => {
    if (offlineProducts) return offlineProducts;
    const pages = online ? matchingPages : offlinePage ? [offlinePage] : [];
    return pages?.flatMap(page => page.items.map(mapCatalogProduct)) ?? [];
  }, [online, matchingPages, offlinePage, offlineProducts]);
  const hasContent = online ? !!matchingPages : !!offlinePage;
  const hasRemoteMore = online && !!matchingPages && browse.hasNextPage;
  const { fetchNextPage } = browse;
  const nextPageError = hasRemoteMore && browse.isFetchNextPageError;
  const canLoadMore = hasRemoteMore && !browse.isFetching && !nextPageError;
  const loadMore = useCallback(() => {
    if (canLoadMore) void fetchNextPage({ cancelRefetch: false });
  }, [canLoadMore, fetchNextPage]);
  const loadError = online && searchReady && !isRestoring && !hasContent ? browse.error : null;
  const isLoading = online && !isRestoring && !hasContent && !loadError;
  const refetch = () => {
    if (!navigator.onLine || isRestoring || !searchReady) return;
    void browse.refetch();
    return catalogCoordinator.refresh();
  };

  const filters: FilterState = useMemo(
    () => ({
      searchQuery: queryFilters.q,
      selectedDimension: queryFilters.dimension,
      selectedBrands: queryFilters.brands,
      selectedColors: queryFilters.colors,
      selectedGrades: queryFilters.grades,
      selectedTags: queryFilters.tags,
      selectedCategory: queryFilters.category,
      onlyInStock: queryFilters.inStock,
      viewMode,
      sortBy: queryFilters.sort,
    }),
    [queryFilters, viewMode]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.selectedDimension) count++;
    count += filters.selectedBrands.length;
    count += filters.selectedColors.length;
    count += filters.selectedGrades.length;
    count += filters.selectedTags.length;
    if (filters.selectedCategory) count++;
    if (!supplyMode && filters.onlyInStock) count++;
    if (filters.sortBy !== "default") count++;
    return count;
  }, [filters, supplyMode]);

  const resetFilters = () => {
    if (supplyMode)
      setQueryFilters({
        q: null,
        dimension: null,
        brands: null,
        colors: null,
        grades: null,
        tags: null,
        category: null,
        sort: null,
      });
    else setQueryFilters(null);
  };

  const dispatchFilter = (action: ProductFilterAction) => {
    match(action)
      .with({ type: "searchQuery" }, ({ query }) => setQueryFilters({ q: query || null }))
      .with({ type: "selectedDimension" }, ({ dimension }) => setQueryFilters({ dimension }))
      .with({ type: "selectedBrands" }, ({ brands }) => setQueryFilters({ brands: brands.length ? brands : null }))
      .with({ type: "selectedColors" }, ({ colors }) => setQueryFilters({ colors: colors.length ? colors : null }))
      .with({ type: "selectedGrades" }, ({ grades }) => setQueryFilters({ grades: grades.length ? grades : null }))
      .with({ type: "selectedTags" }, ({ tags }) => setQueryFilters({ tags: tags.length ? tags : null }))
      .with({ type: "selectedCategory" }, ({ category }) => setQueryFilters({ category }))
      .with({ type: "onlyInStock" }, ({ onlyInStock }) => setQueryFilters({ inStock: onlyInStock ? true : null }))
      .with({ type: "viewMode" }, ({ mode }) => setViewMode(mode))
      .with({ type: "sortBy" }, ({ sort }) => setQueryFilters({ sort: sort === "default" ? null : sort }))
      .exhaustive();
  };

  const toggleArrayFilter = (
    key:
      | "selectedBrands"
      | "selectedColors"
      | "selectedGrades"
      | "selectedTags",
    value: string
  ) => {
    const map: Record<typeof key, "brands" | "colors" | "grades" | "tags"> = {
      selectedBrands: "brands",
      selectedColors: "colors",
      selectedGrades: "grades",
      selectedTags: "tags",
    };
    const queryKey = map[key];
    setQueryFilters((prev) => {
      const currentArr = prev[queryKey] || [];
      const exists = currentArr.includes(value);
      const nextArr = exists
        ? currentArr.filter((v) => v !== value)
        : [...currentArr, value];
      return { [queryKey]: nextArr.length > 0 ? nextArr : null };
    });
  };

  return {
    products,
    hasRemoteMore,
    fetchingRemoteMore: online && browse.isFetchingNextPage,
    nextPageError,
    loadMore,
    retryNextPage: () => void fetchNextPage({ cancelRefetch: false }),
    complete: catalog.complete && !catalog.restoredAt,
    catalogById: catalog.byId,
    isRestoring,
    offlineWithoutPage: !online && !pack && !offlinePage && !isRestoring,
    showingSavedPage: !pack && !!offlinePage,
    offlineHasMore: !pack && !!offlinePage?.hasMore,
    offlineSavedAt: pack?.completedAt,
    online,
    dimensions: pack?.data.dimensions ?? dimensionsQuery.data ?? [],
    dimensionsQuery,
    filters,
    isLoading,
    loadError,
    activeFilterCount,
    refetch,
    dispatchFilter,
    toggleArrayFilter,
    resetFilters,
  };
}

// Temporary alias for smooth migration
export const useCatalog = useProducts;
