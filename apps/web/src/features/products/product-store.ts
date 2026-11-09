import { useState, useMemo, useEffect } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";


import { api } from "../../lib/api-client";

import { useQueryStates } from "nuqs";
import { productFilterParsers, type SortOption } from "./product-filters";
import { queryKeys } from "../../lib/query-keys";

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
  const browse = useInfiniteQuery({
    queryKey: queryKeys.products.browse(owner, browseInput),
    queryFn: ({ pageParam, signal }) => catalogCoordinator.browse({ ...browseInput, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => last.hasMore ? pages.length + 1 : undefined,
    enabled: !!owner && !catalog.complete && needsBrowse && search === queryFilters.q,
    staleTime: 120_000,
  });
  const error = browse.error ?? catalog.error;
  const isFetching = catalog.fetching || (!catalog.complete && browse.isFetching);
  const isLoading = !productsList.length && !error;
  const isLiveConnected = !error;
  const refetch = () => catalogCoordinator.refresh();

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
    switch (filters.sortBy) {
      case "cheapest":
        return [...list].sort(
          (a, b) => a.finalCustomerPricePerSqm - b.finalCustomerPricePerSqm
        );
      case "expensive":
        return [...list].sort(
          (a, b) => b.finalCustomerPricePerSqm - a.finalCustomerPricePerSqm
        );
      case "oldest":
        return [...list].reverse();
      case "newest":
        return list;
      default:
        return list;
    }
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

  const setFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    switch (key) {
      case "searchQuery":
        setQueryFilters({ q: (value as string) || null });
        break;
      case "selectedDimension":
        setQueryFilters({ dimension: (value as string | null) || null });
        break;
      case "selectedBrands":
        setQueryFilters({
          brands: (value as string[]).length > 0 ? (value as string[]) : null,
        });
        break;
      case "selectedColors":
        setQueryFilters({
          colors: (value as string[]).length > 0 ? (value as string[]) : null,
        });
        break;
      case "selectedGrades":
        setQueryFilters({
          grades: (value as string[]).length > 0 ? (value as string[]) : null,
        });
        break;
      case "selectedTags":
        setQueryFilters({
          tags: (value as string[]).length > 0 ? (value as string[]) : null,
        });
        break;
      case "selectedCategory":
        setQueryFilters({ category: (value as string | null) || null });
        break;
      case "onlyInStock":
        setQueryFilters({ inStock: value ? true : null });
        break;
      case "viewMode":
        setViewMode(value as ViewMode);
        break;
      case "sortBy":
        setQueryFilters({
          sort:
            (value as SortOption) === "default" ? null : (value as SortOption),
        });
        break;
    }
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
    products: !catalog.complete && browse.data && search === queryFilters.q && needsBrowse
      ? browse.data.pages.flatMap(page => page.ids).flatMap(id => productsList.find(product => product.id === id) ?? [])
      : filteredProducts,
    hasRemoteMore: !catalog.complete && needsBrowse && !!browse.hasNextPage,
    loadMore: () => { if (!catalog.complete && browse.hasNextPage && !browse.isFetching) void browse.fetchNextPage() },
    complete: catalog.complete,
    allProducts: productsList,
    dimensions: dimensionsQuery.data ?? [],
    dimensionsQuery,
    filters,
    isLoading,
    activeFilterCount,
    isLiveConnected,
    error,
    isFetching,
    refetch,
    setFilter,
    toggleArrayFilter,
    resetFilters,
  };
}

// Temporary alias for smooth migration
export const useCatalog = useProducts;
