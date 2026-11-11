import { useState, useMemo, useEffect } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { match } from "ts-pattern";

import { api } from "@/lib/api-client";

import { useQueryStates } from "nuqs";
import { productFilterParsers, type SortOption } from "./product-filters";
import { queryKeys } from "@/lib/query-keys";

export type { SortOption };

export { mapCatalogProduct, resolveMediaUrl, formatGrade, formatUnit } from "./catalog-mapper";
import { formatGrade } from "./catalog-mapper";
import { catalogCoordinator, useCatalogData } from "./catalog-data";
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

  const { state: catalog, products: productsList, owner } = useCatalogData(true);
  const dimensionsQuery = useQuery({
    queryKey: queryKeys.products.facets(owner),
    queryFn: ({ signal }) => api.catalog.facets(undefined, { signal }),
    enabled: !!owner,
    staleTime: 15 * 60_000,
    select: result => result.dimensions,
  });
  const [search, setSearch] = useState(queryFilters.q);
  useEffect(() => { const timer = setTimeout(() => setSearch(queryFilters.q), 300); return () => clearTimeout(timer) }, [queryFilters.q]);
  const browseInput = useMemo(() => ({ search, dimension: queryFilters.dimension, brands: queryFilters.brands, colors: queryFilters.colors, grades: queryFilters.grades, tags: queryFilters.tags, category: queryFilters.category, inStock: queryFilters.inStock, supplyMode, sort: queryFilters.sort, limit: 24 }), [search, queryFilters, supplyMode]);
  const needsBrowse = !!(search.trim() || queryFilters.dimension || queryFilters.brands.length || queryFilters.colors.length || queryFilters.grades.length || queryFilters.tags.length || queryFilters.category || queryFilters.inStock || supplyMode || queryFilters.sort !== 'default');
  const useRemoteBrowse = queryFilters.sort === 'default' || (!catalog.complete && needsBrowse);
  const browse = useInfiniteQuery({
    queryKey: queryKeys.products.browse(owner, browseInput),
    queryFn: ({ pageParam, signal }) => catalogCoordinator.browse({ ...browseInput, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined,
    enabled: !!owner && useRemoteBrowse && search === queryFilters.q,
    staleTime: 120_000,
    refetchOnReconnect: 'always',
  });
  const error = browse.error ?? catalog.error;
  const loadError = useRemoteBrowse
    ? !browse.data && browse.error
    : !catalog.complete && !productsList.length && catalog.error;
  const isFetching = catalog.fetching || (useRemoteBrowse && browse.isFetching);
  const isLoading = useRemoteBrowse
    ? !browse.data && !loadError
    : !catalog.complete && !productsList.length && !loadError;
  const isLiveConnected = !error;
  const refetch = () => { if (useRemoteBrowse) void browse.refetch(); return catalogCoordinator.refresh(); };

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

  const filteredProducts = useMemo(() => {
    const list = productsList.filter((product) => {
      // Search query (matches name, SKU, brand, color, dimensions, tags)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesSku = product.sku.toLowerCase().includes(query);
        const matchesBrand = product.brand.toLowerCase().includes(query);
        const matchesColor = product.color.toLowerCase().includes(query);
        const matchesDim = product.dimension.includes(query);
        const matchesTag = product.tags.some((t) =>
          t.toLowerCase().includes(query)
        );
        if (
          !matchesName &&
          !matchesSku &&
          !matchesBrand &&
          !matchesColor &&
          !matchesDim &&
          !matchesTag
        ) {
          return false;
        }
      }

      // Dimensions (Strict single dimension match with normalization)
      if (filters.selectedDimension) {
        const normSelectedDim = filters.selectedDimension
          .replace(/x/gi, "×")
          .trim();
        const normProdDim = product.dimension.replace(/x/gi, "×").trim();
        if (normProdDim !== normSelectedDim) {
          return false;
        }
      }

      // Brands
      if (
        filters.selectedBrands.length > 0 &&
        !filters.selectedBrands.includes(product.brand)
      ) {
        return false;
      }

      // Colors
      if (
        filters.selectedColors.length > 0 &&
        !filters.selectedColors.includes(product.color)
      ) {
        return false;
      }

      // Grades (Normalized OR match across selected grades)
      if (filters.selectedGrades.length > 0) {
        const normSelectedGrades = filters.selectedGrades.map((g) =>
          formatGrade(g)
        );
        const prodGrade = formatGrade(product.grade);
        if (!normSelectedGrades.includes(prodGrade)) {
          return false;
        }
      }

      // Tags
      if (
        filters.selectedTags.length > 0 &&
        !filters.selectedTags.some((tag) => product.tags.includes(tag))
      ) {
        return false;
      }

      // Category
      if (
        filters.selectedCategory &&
        product.category !== filters.selectedCategory
      ) {
        return false;
      }

      // Only in stock
      if (supplyMode && !product.hasSupplySource) return false;
      if (!supplyMode && filters.onlyInStock && !product.inStock) {
        return false;
      }

      return true;
    });

    // Sorting
    return match(filters.sortBy)
      .with("cheapest", () => [...list].sort((a, b) => a.finalCustomerPricePerSqm - b.finalCustomerPricePerSqm))
      .with("expensive", () => [...list].sort((a, b) => b.finalCustomerPricePerSqm - a.finalCustomerPricePerSqm))
      .with("oldest", () => [...list].reverse())
      .with("newest", () => list)
      .with("default", () => list)
      .exhaustive();
  }, [filters, productsList, supplyMode]);

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
    products: useRemoteBrowse
      ? (browse.data?.pages.flatMap(page => page.ids).flatMap(id => productsList.find(product => product.id === id) ?? []) ?? [])
      : filteredProducts,
    hasRemoteMore: useRemoteBrowse && !!browse.hasNextPage,
    loadMore: () => { if (useRemoteBrowse && browse.hasNextPage && !browse.isFetching) void browse.fetchNextPage() },
    complete: catalog.complete,
    allProducts: productsList,
    dimensions: dimensionsQuery.data ?? [],
    dimensionsQuery,
    filters,
    isLoading,
    loadError,
    activeFilterCount,
    isLiveConnected,
    error,
    isFetching,
    refetch,
    dispatchFilter,
    toggleArrayFilter,
    resetFilters,
  };
}

// Temporary alias for smooth migration
export const useCatalog = useProducts;
