import { toPersianDigits } from "@/lib/utils/currency";
import {
  SolarRulerIcon,
  SolarBoxIcon,
  SolarLayersIcon,
  SolarTagIcon,
  SolarShopIcon,
  SolarShieldCheckIcon,
} from "@/components/ui/icons";
import { formatGrade, formatUnit } from "@/modules/products/product-store";
import type { Product } from "@/modules/products/product-types";
import { ProductSpecRow } from "./_product-spec-row";
import { ProductStockValue } from "./_product-stock-value";

interface ProductSpecGridProps {
  product: Product;
}

export function ProductSpecGrid({ product: activeProduct }: ProductSpecGridProps) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2 text-xs">
        {activeProduct.productType === "other" ? (
          <>
            <ProductSpecRow
              icon={<SolarBoxIcon size={14} />}
              label="واحد فروش"
              value={formatUnit(activeProduct.unit)}
            />

            {activeProduct.weight != null &&
              activeProduct.weight > 0 && (
                <ProductSpecRow
                  icon={<SolarLayersIcon size={14} />}
                  label="وزن / مقدار"
                  value={
                    <>
                      {toPersianDigits(activeProduct.weight)}{" "}
                      {(activeProduct.secondary_unit ||
                        activeProduct.secondaryUnit)
                        ? formatUnit(
                            activeProduct.secondary_unit ||
                              activeProduct.secondaryUnit,
                          )
                        : formatUnit(activeProduct.unit)}
                    </>
                  }
                />
              )}

            {(activeProduct.secondary_unit ||
              activeProduct.secondaryUnit) && (
              <ProductSpecRow
                icon={<SolarLayersIcon size={14} />}
                label="واحد فرعی"
                value={formatUnit(
                  activeProduct.secondary_unit ||
                    activeProduct.secondaryUnit,
                )}
              />
            )}

            {activeProduct.itemsPerPack != null &&
              activeProduct.itemsPerPack > 0 && (
                <ProductSpecRow
                  icon={<SolarLayersIcon size={14} />}
                  label="تعداد در بسته"
                  value={toPersianDigits(activeProduct.itemsPerPack)}
                />
              )}

            {activeProduct.approxCoverage && (
              <ProductSpecRow
                icon={<SolarRulerIcon size={14} />}
                label="پوشش تقریبی"
                value={activeProduct.approxCoverage}
              />
            )}

            <ProductSpecRow icon={<SolarTagIcon size={14} />} label="موجودی انبار">
              <ProductStockValue
                product={activeProduct}
                unitLabel={formatUnit(activeProduct.unit)}
              />
            </ProductSpecRow>

            <ProductSpecRow
              icon={<SolarShopIcon size={14} />}
              label="برند"
              value={activeProduct.brand}
            />

            {activeProduct.grade && (
              <ProductSpecRow
                icon={<SolarShieldCheckIcon size={14} />}
                label="درجه کیفی"
                value={formatGrade(activeProduct.grade)}
              />
            )}
          </>
        ) : (
          <>
            {activeProduct.dimensions?.width &&
              activeProduct.dimensions?.height && (
                <ProductSpecRow
                  icon={<SolarRulerIcon size={14} />}
                  label="ابعاد"
                  value={
                    <>
                      {toPersianDigits(
                        activeProduct.dimensions.width,
                      )}{" "}
                      ×{" "}
                      {toPersianDigits(
                        activeProduct.dimensions.height,
                      )}
                    </>
                  }
                />
              )}

            {activeProduct.sqmPerCarton != null &&
              activeProduct.sqmPerCarton > 0 && (
                <ProductSpecRow
                  icon={<SolarBoxIcon size={14} />}
                  label="متراژ در هر کارتن"
                  value={toPersianDigits(activeProduct.sqmPerCarton)}
                  valueTone="text-primary"
                />
              )}

            <ProductSpecRow icon={<SolarTagIcon size={14} />} label={<>موجودی انبار{" "}</>}>
              <ProductStockValue product={activeProduct} unitLabel="متر" />
            </ProductSpecRow>

            {activeProduct.piecesPerCarton != null &&
              activeProduct.piecesPerCarton > 0 && (
                <ProductSpecRow
                  icon={<SolarLayersIcon size={14} />}
                  label="تعداد در هر کارتن"
                  value={
                    <>
                      {toPersianDigits(
                        activeProduct.piecesPerCarton,
                      )}{" "}
                      برگ
                    </>
                  }
                />
              )}

            <ProductSpecRow
              icon={<SolarShopIcon size={14} />}
              label="برند"
              value={activeProduct.brand}
            />

            {activeProduct.grade && (
              <ProductSpecRow
                icon={<SolarShieldCheckIcon size={14} />}
                label="درجه کیفی"
                value={formatGrade(activeProduct.grade)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
