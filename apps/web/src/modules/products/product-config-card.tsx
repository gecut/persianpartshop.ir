"use client";

import { memo, useMemo } from "react";
import { NumberField, I18nProvider, Button } from "@heroui/react";
import { MoneyBagOutlineIcon } from "@solar-icons/react";
import type { Product } from "./product-types"
import { calculateCartonRequirement } from "@/lib/utils/math";
import { formatToman, toPersianDigits } from "@/lib/utils/currency";
import { formatCartons } from "@/lib/utils/unit";
import { formatGrade, formatUnit } from "./product-store";
import { selectionStore, useProductQuantity } from "./selection-store";
import { ThrottledSlider } from "@/components/ui/throttled-slider";
import {
  Trash2Icon,
  SolarRulerIcon,
  SolarBoxIcon,
  TomanIcon,
} from "@/components/ui/icons";

export interface ProductConfigCardProps {
  product: Product;
  onRemove: (productId: string) => void;
  onRequestSupply?: (product: Product, quantity: number) => void;
}

const clampArea = (val: number, maxInventory: number) => {
  if (maxInventory <= 0) return 0;
  const minVal = 1;
  const rawVal =
    isNaN(val) || val < minVal ? minVal : Math.round(val * 10) / 10;
  return Math.max(minVal, Math.min(rawVal, maxInventory));
};

function ProductConfigCardComponent({
  product,
  onRemove,
  onRequestSupply,
}: ProductConfigCardProps) {
  const storedQuantity = useProductQuantity(product.id);

  const maxInventory =
    Number.isFinite(Number(product.inventorySqm)) &&
    Number(product.inventorySqm) > 0
      ? Number(product.inventorySqm)
      : 0;
  const defaultArea =
    maxInventory > 0
      ? Math.min(maxInventory, Math.max(product.sqmPerCarton || 1, 1))
      : 0;
  const area = Math.max(1, storedQuantity ?? defaultArea);

  const calc = useMemo(
    () =>
      calculateCartonRequirement(
        area,
        product.sqmPerCarton,
        product.finalCustomerPricePerSqm,
        maxInventory,
      ),
    [
      area,
      product.sqmPerCarton,
      product.finalCustomerPricePerSqm,
      maxInventory,
    ],
  );

  const setArea = (val: number) => {
    selectionStore.setDraftQuantity(product.id, clampArea(val, maxInventory));
  };

  return (
    <div className="bg-muted/4 rounded-2xl p-4 transition-all space-y-3.5">
      {/* 1. Header Row: Thumbnail + Product Info + Delete Button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-16 rounded-2xl overflow-hidden shrink-0 bg-muted/10">
            <img
              src={product.images[0] || "/assets/images/placeholder.svg"}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                if (
                  !e.currentTarget.src.endsWith(
                    "/assets/images/placeholder.svg",
                  )
                ) {
                  e.currentTarget.src = "/assets/images/placeholder.svg";
                }
              }}
            />
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {product.dimensions?.width && product.dimensions?.height ? (
                <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                  {toPersianDigits(product.dimensions.width)} ×{" "}
                  {toPersianDigits(product.dimensions.height)}
                </span>
              ) : product.weight ? (
                <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                  {formatUnit(product.unit)} {toPersianDigits(product.weight)}
                  {(product.secondary_unit || product.secondaryUnit)
                    ? ` ${formatUnit(product.secondary_unit || product.secondaryUnit)}`
                    : ""}
                </span>
              ) : (
                <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                  {formatUnit(product.unit)}
                </span>
              )}
              {product.grade && (
                <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                  {formatGrade(product.grade)}
                </span>
              )}
              <span className="text-xs font-semibold text-muted">
                {product.brand}
              </span>
            </div>

            <h3 className="text-sm font-bold text-foreground  mt-1">
              {product.name}
            </h3>

            <div className="flex items-center gap-2 text-xs text-muted mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <strong className="font-bold text-foreground">
                  {formatToman(product.finalCustomerPricePerSqm)}
                </strong>
                <TomanIcon className="size-4" />
              </span>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onPress={() => onRemove(product.id)}
          className="size-8 px-2 py-1.5 rounded-lg text-foregorund hover:text-danger hover:bg-danger/15 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-0.5"
          aria-label={`حذف ${product.name}`}
        >
          <Trash2Icon size={15} />
        </Button>
      </div>

      {product.hasSupplySource && onRequestSupply && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">بیشتر از موجودی نیاز دارید؟</span>
          <Button size="sm" variant="ghost" onPress={() => onRequestSupply(product, area)}>
            درخواست تأمین
          </Button>
        </div>
      )}

      {calc.isExceedingStock && <p role="status" className="text-xs text-danger">موجودی به‌روز: {toPersianDigits(maxInventory)} {product.productType === 'other' ? formatUnit(product.unit) : 'مترمربع'}؛ مقدار درخواستی شما حفظ شده است.</p>}
      <div className="h-px bg-separator" />

      {/* 2. Meterage Controls: NumberField & Slider */}
      <div className="space-y-2.5 ">
        <div className="space-y-4 pt-0.5">
          <div className="w-full">
            <ThrottledSlider
              value={Math.min(area, Math.max(1, maxInventory))}
              minValue={1}
              maxValue={Math.max(1, maxInventory)}
              step={1}
              onChange={(val) => setArea(val)}
              ariaLabel={`اسلایدر متراژ ${product.name}`}
            />
          </div>

          <div className="flex justify-between rounded-lg mt-3 items-center text-xs text-foreground font-bold">
            <div className="flex items-center gap-1.5 justify-center shrink-0">
              <I18nProvider locale="fa-IR">
                <NumberField
                  minValue={1}
                  maxValue={Math.max(1, maxInventory)}
                  step={1}
                  value={area}
                  onChange={(val) => setArea(val)}
                  formatOptions={{
                    useGrouping: false,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 1,
                  }}
                  aria-label={`متراژ ${product.name}`}
                  className="max-w-36  shadow-none! [box-shadow:none]! border-none!"
                >
                  <NumberField.Group className="rounded-2xl bg-muted/10 transition-colors overflow-hidden shadow-none! [box-shadow:none]! border-none! ring-0!">
                    <NumberField.DecrementButton className="flex items-center justify-center text-muted hover:text-foreground active:scale-90 transition-all rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed [&_svg]:size-3 shadow-none! [box-shadow:none]! border-none!" />
                    <NumberField.Input className="font-bold text-center text-foreground shadow-none! [box-shadow:none]! border-none! ring-0!" />
                    <NumberField.IncrementButton className="flex items-center justify-center text-muted hover:text-foreground active:scale-90 transition-all rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed [&_svg]:size-3 shadow-none! [box-shadow:none]! border-none!" />
                  </NumberField.Group>
                </NumberField>
              </I18nProvider>
            </div>
            <div
              onClick={() => setArea(maxInventory)}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground cursor-pointer select-none active:scale-95 transition-transform"
            >
              سقف موجودی: {toPersianDigits(maxInventory)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 bg-muted/5 rounded-2xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <SolarRulerIcon size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-muted font-medium block leading-tight mb-1">
              {product.productType === 'other' ? 'مقدار تحویلی' : 'متراژ تحویلی'}
            </span>
            <span className="font-bold text-foreground text-sm leading-normal  block">
              {toPersianDigits(calc.deliverableArea)}
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-muted/5 rounded-2xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <SolarBoxIcon size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs text-muted font-medium block leading-tight mb-1">
              {product.productType === 'other' ? 'تعداد واحد فروش' : 'تعداد کارتن'}
            </span>
            <span className="font-bold text-primary text-sm leading-normal  block">
              {product.productType === 'other' ? `${toPersianDigits(calc.cartonCount)} ${formatUnit(product.unit)}` : formatCartons(calc.cartonCount, product.cartonsPerPallet)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-2.5 bg-success rounded-2xl flex items-center gap-2.5 text-xs">
        <div className="w-8 h-8 rounded-xl text-background flex items-center justify-center shrink-0">
          <MoneyBagOutlineIcon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs text-background font-medium block leading-tight mb-1">
            مبلغ برآورد
          </span>
          <span className="font-bold text-background text-sm leading-normal inline-flex items-center gap-1">
            <span>{formatToman(calc.totalPrice)}</span>
            <TomanIcon className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

export const ProductConfigCard = memo(ProductConfigCardComponent);
