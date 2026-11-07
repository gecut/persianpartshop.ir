import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "../../types";
import { api } from "../../lib/api-client";
import { toPersianDigits } from "../../lib/utils/currency";
import { useQueryStates } from "nuqs";
import { productFilterParsers, type SortOption } from "./product-filters";
import { queryKeys } from "../../lib/query-keys";

export type { SortOption };

export function resolveMediaUrl(media: any): string {
  if (!media) return "";
  if (typeof media === "string") {
    if (
      media.startsWith("http://") ||
      media.startsWith("https://") ||
      media.startsWith("/")
    ) {
      return media;
    }
    if (media.includes(".")) {
      const cdnUrl = import.meta.env.VITE_CDN_URL;
      if (cdnUrl) {
        return `${cdnUrl}/${encodeURIComponent(media)}`;
      }
      return `/api/media/file/${media}`;
    }
    return "";
  }
  if (typeof media === "object") {
    if (media.url && typeof media.url === "string") return media.url;
    if (media.thumbnailURL && typeof media.thumbnailURL === "string")
      return media.thumbnailURL;
    if (media.filename && typeof media.filename === "string") {
      const cdnUrl = import.meta.env.VITE_CDN_URL;
      if (cdnUrl) {
        return `${cdnUrl}/${encodeURIComponent(media.filename)}`;
      }
      return `/api/media/file/${media.filename}`;
    }
    if (media.image) return resolveMediaUrl(media.image);
  }
  return "";
}

export function formatGrade(rawGrade?: string | null): string {
  if (!rawGrade) return "";
  const gradeStr = String(rawGrade).trim();
  const mapping: Record<string, string> = {
    grade_1: "درجه ۱",
    grade_2: "درجه ۲",
    grade_3: "درجه ۳",
    grade_4: "درجه ۴",
    grade: "درجه ۱",
    "1": "درجه ۱",
    "2": "درجه ۲",
    "3": "درجه ۳",
    "4": "درجه ۴",
    "درجه 1": "درجه ۱",
    "درجه 2": "درجه ۲",
    "درجه 3": "درجه ۳",
    "درجه 4": "درجه ۴",
    "اصلی (Genuine)": "درجه ۱",
    "درجه ۱ (اصلی)": "درجه ۱",
  };
  if (mapping[gradeStr]) return mapping[gradeStr];
  if (gradeStr.startsWith("grade_")) {
    const num = gradeStr.replace("grade_", "");
    return `درجه ${toPersianDigits(num)}`;
  }
  return gradeStr;
}

export { formatUnit } from '../../lib/utils/unit'

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

export function useProducts() {
  const [queryFilters, setQueryFilters] = useQueryStates(productFilterParsers, {
    shallow: true,
  });
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Fetch dimensions via TanStack Query using queryKeys.products.dimensions()
  const {
    data: dimensions = [
      "30×90",
      "60×120",
      "80×160",
      "100×100",
      "120×240",
      "60×60",
      "30×60",
      "20×120",
    ],
  } = useQuery({
    queryKey: queryKeys.products.dimensions(),
    queryFn: async () => {
      const dims = await api.catalog.dimensions({ onlyActive: true });
      if (Array.isArray(dims) && dims.length > 0) {
        const list = dims.map((d: any) => d.name || `${d.width}×${d.height}`);
        return Array.from(new Set(list));
      }
      return [
        "30×90",
        "60×120",
        "80×160",
        "100×100",
        "120×240",
        "60×60",
        "30×60",
        "20×120",
      ];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch products via TanStack Query using queryKeys.products.list(...)
  const {
    data: rawProducts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.products.list({ page: 1, limit: 500 }),
    queryFn: async () => {
      const res = await api.catalog.list({ page: 1, limit: 500 });
      return res.items || [];
    },
    staleTime: 60 * 1000,
  });

  const isLiveConnected = !isError;

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
    [queryFilters, viewMode],
  );

  const productsList = useMemo<Product[]>(() => {
    if (!rawProducts || rawProducts.length === 0) return [];
    return rawProducts.map((item: any) => {
      const isOther = (item as any).productType === "other";
      const dimObj = typeof item.dimension === "object" ? item.dimension : null;
      const width = isOther ? 0 : Number(dimObj?.width || item.width || 60);
      const height = isOther ? 0 : Number(dimObj?.height || item.height || 120);
      const dimStr = isOther
        ? (item as any).weight
          ? `${(item as any).weight} کیلوگرم`
          : ""
        : dimObj?.name || `${width}×${height}`;

      const brandName =
        typeof item.brand === "object" && item.brand !== null
          ? item.brand.name
          : item.brandName || "پرشین پارت";
      const categoryName =
        typeof item.category === "object" && item.category !== null
          ? item.category.name
          : item.categoryName || "عمومی";
      const basePrice =
        Number(item.finalCustomerPricePerSqm ?? 0);
      const rawGallery = Array.isArray(item.gallery) ? item.gallery : [];
      const galleryUrls = rawGallery
        .map((g: any) => resolveMediaUrl(g?.image || g))
        .filter(Boolean);

      const rawCoverUrl = resolveMediaUrl(item.cover);
      const primaryImage =
        rawCoverUrl || galleryUrls[0] || "/assets/images/placeholder.svg";
      const imagesList = [
        primaryImage,
        ...galleryUrls.filter((u: string) => u !== primaryImage),
      ];

      const finalPrice = basePrice;
      const discountPercent: number | undefined = undefined;
      const originalPricePerSqm: number | undefined = undefined;
      const discountPlanTitle: string | undefined = undefined;

      return {
        id: String(item.id),
        slug: item.slug || `product-${item.id}`,
        name: item.name,
        sku: item.sku,
        productType: (item as any).productType || (isOther ? "other" : "tile"),
        dimensions: { width, height },
        dimension: dimStr,
        brand: brandName,
        color: item.color || "استاندارد",
        grade: item.grade ? formatGrade(item.grade) : undefined,
        category: categoryName,
        unit: (item as any).unit || (isOther ? "bag" : "m2"),
        secondary_unit: (item as any).secondary_unit || (item as any).secondaryUnit || undefined,
        secondaryUnit: (item as any).secondary_unit || (item as any).secondaryUnit || undefined,
        weight:
          (item as any).weight != null
            ? Number((item as any).weight)
            : undefined,
        itemsPerPack:
          (item as any).itemsPerPack != null
            ? Number((item as any).itemsPerPack)
            : undefined,
        approxCoverage: (item as any).approxCoverage || undefined,
        finalCustomerPricePerSqm: finalPrice,
        pricePerM2: finalPrice,
        originalPricePerSqm,
        discountPercent,
        discountPlanTitle,
        sqmPerCarton: isOther ? 1 : (item.sqmPerCarton || 1.44),
        areaPerCarton: isOther ? 1 : (item.sqmPerCarton || 1.44),
        piecesPerCarton: item.piecesPerCarton || 1,
        tilesPerCarton: item.piecesPerCarton || 1,
        cartonWeightKg:
          (item as any).weight != null ? Number((item as any).weight) : 28,
        hideExactStock: Boolean((item as any).hideExactStock),
        inventorySqm:
          item.availability === "out_of_stock"
            ? 0
            : Number((item as any).inventorySqm || 0),
        stockCartons:
          item.availability === "out_of_stock"
            ? 0
            : Number((item as any).stockCartons || 0),
        inStock:
          item.availability !== "out_of_stock" &&
          ((item as any).hideExactStock
            ? Boolean(Number((item as any).stockCartons || 0) > 0 || Number((item as any).inventorySqm || 0) > 0 || (item as any).inStock)
            : Number((item as any).inventorySqm || 0) > 0),
        stockStatus:
          item.availability === "out_of_stock" ||
          Number((item as any).inventorySqm || 0) <= 0
            ? "out_of_stock"
            : (item as any).hideExactStock
              ? "in_stock"
              : item.availability === "limited" ||
                  Number((item as any).inventorySqm || 0) < 50
                ? "low_stock"
                : "in_stock",
        description: item.richDescription || undefined,
        applications: ["خودرو سواری", "سفارش عمده"],
        tags: Array.isArray(item.tags)
          ? item.tags.map((t: any) => (typeof t === "object" ? t.name : t))
          : [],
        images: imagesList,
        gallery: galleryUrls.length > 0 ? galleryUrls : [primaryImage],
      };
    });
  }, [rawProducts]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery) count++;
    if (filters.selectedDimension) count++;
    count += filters.selectedBrands.length;
    count += filters.selectedColors.length;
    count += filters.selectedGrades.length;
    count += filters.selectedTags.length;
    if (filters.selectedCategory) count++;
    if (filters.onlyInStock) count++;
    if (filters.sortBy !== "default") count++;
    return count;
  }, [filters]);

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
          t.toLowerCase().includes(query),
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
          formatGrade(g),
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
      if (filters.onlyInStock && !product.inStock) {
        return false;
      }

      return true;
    });

    // Sorting
    switch (filters.sortBy) {
      case "cheapest":
        return [...list].sort(
          (a, b) => a.finalCustomerPricePerSqm - b.finalCustomerPricePerSqm,
        );
      case "expensive":
        return [...list].sort(
          (a, b) => b.finalCustomerPricePerSqm - a.finalCustomerPricePerSqm,
        );
      case "newest":
        return [...list].reverse();
      default:
        return list;
    }
  }, [filters, productsList]);

  const resetFilters = () => {
    setQueryFilters(null);
  };

  const setFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
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
    value: string,
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
    products: filteredProducts,
    allProducts: productsList,
    dimensions,
    filters,
    isLoading,
    activeFilterCount,
    isLiveConnected,
    refetch,
    setFilter,
    toggleArrayFilter,
    resetFilters,
  };
}

// Temporary alias for smooth migration
export const useCatalog = useProducts;
