import { toPersianDigits } from '@/lib/format'
import {
  RulerIcon as SolarRulerIcon,
  BoxIcon as SolarBoxIcon,
  LayersIcon as SolarLayersIcon,
  TagIcon as SolarTagIcon,
  ShopIcon as SolarShopIcon,
  ShieldCheckIcon as SolarShieldCheckIcon,
} from '@solar-icons/react/linear'
import { formatGrade, formatUnit } from '@/lib/format'
import type { PublicCatalogProduct as Product } from '@persianpart/contract/public-catalog'
import { ProductSpecRow } from './_product-spec-row'
import { ProductValues } from '@/components/product-values'

interface ProductSpecGridProps {
  product: Product
}

export function ProductSpecGrid({
  product: activeProduct,
}: ProductSpecGridProps) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2 text-xs">
        {activeProduct.productType === 'other' ? (
          <>
            <ProductSpecRow
              icon={<SolarBoxIcon size={14} />}
              label="واحد فروش"
              value={formatUnit(activeProduct.unit)}
            />

            {activeProduct.weight != null && activeProduct.weight > 0 && (
              <ProductSpecRow
                icon={<SolarLayersIcon size={14} />}
                label="وزن / مقدار"
                value={
                  <>
                    {toPersianDigits(activeProduct.weight)}{' '}
                    {activeProduct.secondaryUnit
                      ? formatUnit(activeProduct.secondaryUnit)
                      : formatUnit(activeProduct.unit)}
                  </>
                }
              />
            )}

            {activeProduct.secondaryUnit && (
              <ProductSpecRow
                icon={<SolarLayersIcon size={14} />}
                label="واحد فرعی"
                value={formatUnit(activeProduct.secondaryUnit)}
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

            {activeProduct.stock.mode !== 'hidden' && (
              <ProductSpecRow
                icon={<SolarTagIcon size={14} />}
                label="موجودی انبار"
              >
                <ProductValues product={activeProduct} />
              </ProductSpecRow>
            )}

            <ProductSpecRow
              icon={<SolarShopIcon size={14} />}
              label="برند"
              value={activeProduct.brand?.name}
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
            {activeProduct.width && activeProduct.height && (
              <ProductSpecRow
                icon={<SolarRulerIcon size={14} />}
                label="ابعاد"
                value={
                  <>
                    <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                      <span>{toPersianDigits(activeProduct.height)}</span>
                      <span className="opacity-70">&times;</span>
                      <span>{toPersianDigits(activeProduct.width)}</span>
                    </div>
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

            {activeProduct.stock.mode !== 'hidden' && (
              <ProductSpecRow
                icon={<SolarTagIcon size={14} />}
                label={<>موجودی انبار </>}
              >
                <ProductValues product={activeProduct} />
              </ProductSpecRow>
            )}

            {activeProduct.piecesPerCarton != null &&
              activeProduct.piecesPerCarton > 0 && (
                <ProductSpecRow
                  icon={<SolarLayersIcon size={14} />}
                  label="تعداد در هر کارتن"
                  value={
                    <>{toPersianDigits(activeProduct.piecesPerCarton)} قالب</>
                  }
                />
              )}

            <ProductSpecRow
              icon={<SolarShopIcon size={14} />}
              label="برند"
              value={activeProduct.brand?.name}
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
  )
}
