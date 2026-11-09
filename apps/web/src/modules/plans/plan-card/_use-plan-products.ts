import { useMemo } from "react";
import type { Plan } from "@/modules/plans/plan-types"
import type { Product } from "@/modules/products/product-types"
import { useAuth, isProductAllowedForUser } from "@/modules/auth/auth-store";

export function usePlanProducts(
  plan: Plan,
  products: Product[],
  user: ReturnType<typeof useAuth>["user"],
): Product[] {
  // Product resolution from relation or list
  return useMemo(() => {
    if (
      Array.isArray(plan.products) &&
      plan.products.length > 0 &&
      typeof plan.products[0] === "object" &&
      plan.products[0] !== null
    ) {
      return plan.products
        .filter((p: any) => isProductAllowedForUser(p, user))
        .map((p: any) => {
          const matched = products.find(
            (prod) => String(prod.id) === String(p.id),
          );
          if (matched) return matched;

          const rawDim = p.dimension;
          let dimStr = "";
          let width = 0;
          let height = 0;
          if (typeof rawDim === "object" && rawDim !== null) {
            dimStr = rawDim.name
              ? String(rawDim.name)
              : rawDim.width && rawDim.height
                ? `${rawDim.width}×${rawDim.height}`
                : "";
            width = Number(rawDim.width) || 0;
            height = Number(rawDim.height) || 0;
          } else if (
            typeof rawDim === "string" &&
            rawDim !== "[object Object]" &&
            !rawDim.includes("object Object")
          ) {
            dimStr = rawDim;
            width = Number(p.dimensions?.width) || 0;
            height = Number(p.dimensions?.height) || 0;
          } else if (p.dimensions?.width && p.dimensions?.height) {
            dimStr = `${p.dimensions.width}×${p.dimensions.height}`;
            width = Number(p.dimensions.width);
            height = Number(p.dimensions.height);
          }

          const resolvedPrice = Number(
            p.finalCustomerPricePerSqm ||
              p.basePricePerSqm ||
              p.basePrice ||
              p.pricePerM2 ||
              p.base_price_per_sqm ||
              p.price ||
              p.originalPricePerSqm ||
              0,
          );

          const inv = Number(p.inventorySqm ?? p.inventory_sqm ?? 0);
          const inStock = p.inStock ?? inv > 0;
          const stockStatus =
            p.stockStatus ??
            (inStock && inv > 0
              ? ("in_stock" as const)
              : ("out_of_stock" as const));

          return {
            id: String(p.id),
            slug: p.slug || String(p.id),
            name: p.title || p.name || "محصول طرح",
            sku: p.sku || "",
            dimensions: { width, height },
            dimension: dimStr,
            brand: typeof p.brand === "object" ? p.brand?.name : p.brand || "",
            color: p.color || "",
            category:
              typeof p.category === "object"
                ? p.category?.title || p.category?.name
                : p.category || "",
            finalCustomerPricePerSqm: resolvedPrice,
            pricePerM2: resolvedPrice,
            basePricePerSqm: resolvedPrice,
            originalPricePerSqm: resolvedPrice,
            sqmPerCarton: Number(p.sqmPerCarton || 1),
            areaPerCarton: Number(p.sqmPerCarton || 1),
            piecesPerCarton: Number(p.piecesPerCarton || 1),
            tilesPerCarton: Number(p.piecesPerCarton || 1),
            cartonWeightKg: Number(p.cartonWeightKg || 0),
            inventorySqm: inv,
            stockCartons: Number(p.stockCartons || 0),
            inStock,
            unit: p.unit || "bag",
            secondary_unit: p.secondary_unit || p.secondaryUnit || undefined,
            secondaryUnit: p.secondary_unit || p.secondaryUnit || undefined,
            weight: p.weight != null ? Number(p.weight) : undefined,
            stockStatus,
            applications: [],
            tags: [],
            gallery: [],
            images: Array.isArray(p.images)
              ? p.images.map((img: any) =>
                  typeof img === "object" && img?.url ? img.url : String(img),
                )
              : ["/assets/images/placeholder.svg"],
          } as unknown as Product;
        });
    }

    return (plan.productIds || [])
      .map((id) => products.find((p) => String(p.id) === String(id)))
      .filter((p): p is Product => Boolean(p))
      .filter((p) => isProductAllowedForUser(p, user));
  }, [plan, products, user]);
}
