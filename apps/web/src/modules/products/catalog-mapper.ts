import type { Product } from "./product-types"
import type { CatalogRecord } from "@persianpart/contract"
import { toPersianDigits } from "@/lib/utils/currency"
export function resolveMediaUrl(media: unknown): string {
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
  if (typeof media === "object" && media !== null) {
    const item = media as Record<string, unknown>;
    if (item.url && typeof item.url === "string") return item.url;
    if (item.thumbnailURL && typeof item.thumbnailURL === "string")
      return item.thumbnailURL;
    if (item.filename && typeof item.filename === "string") {
      const cdnUrl = import.meta.env.VITE_CDN_URL;
      if (cdnUrl) {
        return `${cdnUrl}/${encodeURIComponent(item.filename)}`;
      }
      return `/api/media/file/${item.filename}`;
    }
    if (item.image) return resolveMediaUrl(item.image);
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

export { formatUnit } from "@/lib/utils/unit";

function getDescriptionText(value: unknown): string | undefined {
  if (typeof value === "string") return value || undefined;
  if (!value || typeof value !== "object") return undefined;
  const node = value as Record<string, unknown>;
  const parts = [
    typeof node.text === "string" ? node.text : "",
    getDescriptionText(node.root),
  ];
  if (Array.isArray(node.children))
    parts.push(...node.children.map(getDescriptionText));
  return parts.filter(Boolean).join(" ") || undefined;
}

type CatalogProductInput = Omit<CatalogRecord, "createdAt" | "hasScanCode"> & { hasScanCode?: boolean } & {
  brandName?: string;
  categoryName?: string;
  categoryId?: string | number | null;
  secondaryUnit?: string | null;
  inStock?: boolean;
};

export function mapCatalogProduct(item: CatalogProductInput): Product {
  const isOther = item.productType === "other";
  const dimObj = typeof item.dimension === "object" ? item.dimension : null;
  const width = isOther ? 0 : Number(dimObj?.width || item.width || 60);
  const height = isOther ? 0 : Number(dimObj?.height || item.height || 120);
  const dimStr = isOther
    ? item.weight
      ? `${item.weight} کیلوگرم`
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
  const basePrice = Number(item.finalCustomerPricePerSqm ?? 0);
  const rawGallery = Array.isArray(item.gallery) ? item.gallery : [];
  const galleryUrls = rawGallery
    .map((g) => resolveMediaUrl(g.image))
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
    hasScanCode: Boolean(item.hasScanCode),
    productType: item.productType || (isOther ? "other" : "tile"),
    dimensions: { width, height },
    dimension: dimStr,
    brand: brandName,
    color: item.color || "استاندارد",
    grade: item.grade ? formatGrade(item.grade) : undefined,
    category: categoryName,
    categoryId:
      typeof item.category === "object" && item.category !== null
        ? item.category.id
        : item.categoryId ?? item.category,
    unit: item.unit || (isOther ? "bag" : "m2"),
    secondary_unit: item.secondary_unit || item.secondaryUnit || undefined,
    secondaryUnit: item.secondary_unit || item.secondaryUnit || undefined,
    weight: item.weight != null ? Number(item.weight) : undefined,
    itemsPerPack:
      item.itemsPerPack != null ? Number(item.itemsPerPack) : undefined,
    approxCoverage: item.approxCoverage || undefined,
    finalCustomerPricePerSqm: finalPrice,
    pricePerM2: finalPrice,
    originalPricePerSqm,
    discountPercent,
    discountPlanTitle,
    sqmPerCarton: isOther ? 1 : item.sqmPerCarton || 1.44,
    cartonsPerPallet: isOther ? null : item.cartonsPerPallet ?? null,
    hasSupplySource: Boolean(item.hasSupplySource),
    areaPerCarton: isOther ? 1 : item.sqmPerCarton || 1.44,
    piecesPerCarton: item.piecesPerCarton || 1,
    tilesPerCarton: item.piecesPerCarton || 1,
    cartonWeightKg: item.weight != null ? Number(item.weight) : 28,
    hideExactStock: Boolean(item.hideExactStock),
    inventorySqm:
      item.availability === "out_of_stock" ? 0 : Number(item.inventorySqm || 0),
    stockCartons:
      item.availability === "out_of_stock" ? 0 : Number(item.stockCartons || 0),
    inStock:
      item.availability !== "out_of_stock" &&
      (item.hideExactStock
        ? Boolean(
            Number(item.stockCartons || 0) > 0 ||
              Number(item.inventorySqm || 0) > 0 ||
              item.inStock
          )
        : Number(item.inventorySqm || 0) > 0),
    stockStatus:
      item.availability === "out_of_stock" ||
      Number(item.inventorySqm || 0) <= 0
        ? "out_of_stock"
        : item.hideExactStock
        ? "in_stock"
        : item.availability === "limited" || Number(item.inventorySqm || 0) < 50
        ? "low_stock"
        : "in_stock",
    description: getDescriptionText(item.richDescription),
    applications: ["خودرو سواری", "سفارش عمده"],
    tags: Array.isArray(item.tags)
      ? item.tags.flatMap((t) =>
          typeof t === "object" ? [t.name] : typeof t === "string" ? [t] : []
        )
      : [],
    images: imagesList,
    gallery: galleryUrls.length > 0 ? galleryUrls : [primaryImage],
  };
}

