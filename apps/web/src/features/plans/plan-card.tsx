import { useState, useMemo, useSyncExternalStore } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Drawer, Button } from "@heroui/react";
import type { Plan, Product } from "../../types";
import { toPersianDigits, formatToman } from "../../lib/utils/currency";
import { formatPersianDate, formatPersianDateLong } from "../../lib/utils/date";
import { cn } from "../../lib/utils";
import {
  BoxIcon,
  ArrowLeftIcon,
  TomanIcon,
  ClockIcon,
  XIcon,
  TagIcon,
  CheckIcon,
  PlusIcon,
} from "../../components/ui/icons";
import { ProductBottomSheet } from "../products/product-bottom-sheet";
import { selectionStore } from "../products/selection-store";
import { useAuth } from "../auth/auth-store";

export interface PlanCardProps {
  plan: Plan;
  products: Product[];
}

function formatProdDimension(prod: any): string {
  if (!prod) return "";
  const d = prod.dimension;
  if (typeof d === "object" && d !== null) {
    if (d.name) {
      return toPersianDigits(String(d.name).replace(/x/gi, " × "));
    }
    if (d.width && d.height) {
      return `${toPersianDigits(d.width)} × ${toPersianDigits(d.height)}`;
    }
  }
  if (
    typeof d === "string" &&
    d.trim() &&
    d !== "[object Object]" &&
    !d.includes("object Object")
  ) {
    return toPersianDigits(d.replace(/x/gi, " × "));
  }
  if (prod.dimensions?.width && prod.dimensions?.height) {
    return `${toPersianDigits(prod.dimensions.width)} × ${toPersianDigits(prod.dimensions.height)}`;
  }
  return "";
}

export function PlanCard({ plan, products }: PlanCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] =
    useState<Product | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOrderingDisabled =
    Boolean(user?.disableOrdering) || Boolean(user?.hideExactStock);

  const selectedIds = useSyncExternalStore(
    selectionStore.subscribe,
    () => selectionStore.getSnapshot().selectedIds,
    () => [],
  );

  // Time & Status computations
  const now = Date.now();
  const startTime = plan.startsAt ? new Date(plan.startsAt).getTime() : null;
  const isUpcoming = startTime !== null && !isNaN(startTime) && startTime > now;

  let upcomingDaysText = "";
  if (isUpcoming && startTime) {
    const diffMs = startTime - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

    if (diffDays > 1) {
      upcomingDaysText = `${toPersianDigits(diffDays)} روز دیگر تا شروع این طرح مانده`;
    } else if (diffHours > 1) {
      upcomingDaysText = `${toPersianDigits(diffHours)} ساعت دیگر تا شروع این طرح مانده`;
    } else {
      upcomingDaysText = "کمتر از ۱ ساعت تا شروع این طرح مانده";
    }
  }

  const expireTime = plan.expiresAt ? new Date(plan.expiresAt).getTime() : null;
  const isExpired =
    Boolean(plan.isExpired) ||
    plan.status === "expired" ||
    (expireTime !== null && !isNaN(expireTime) && expireTime <= now);

  const isActive =
    !isExpired &&
    !isUpcoming &&
    (plan.status === "active" || (plan.status === undefined && plan.isActive));

  // Product resolution from relation or list
  const planProducts = useMemo(() => {
    if (
      Array.isArray(plan.products) &&
      plan.products.length > 0 &&
      typeof plan.products[0] === "object" &&
      plan.products[0] !== null
    ) {
      return plan.products.map((p: any) => {
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
      .filter((p): p is Product => Boolean(p));
  }, [plan, products]);

  const rawDescription =
    plan.content || plan.notes || "شرایط این طرح توسط مدیریت تعیین شده است.";

  return (
    <>
      <div
        className={cn(
          "p-5 flex flex-col bg-muted/5 gap-3.5 text-start transition-all h-fit rounded-3xl text-foreground relative overflow-hidden border border-border/40",
          isExpired && "opacity-80 border-danger/25",
          !isActive && !isUpcoming && !isExpired && "opacity-85",
        )}
      >
        {/* Upcoming Alert Banner */}
        {isUpcoming && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold animate-pulse">
            <ClockIcon className="size-4 shrink-0" />
            <span>{upcomingDaysText}</span>
          </div>
        )}

        {/* Header Section */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-bold text-foreground leading-snug">
              {plan.title}
            </h3>
            {/* 3 Date Fields: ۱- تاریخ ایجاد (خودکار) ۲- تاریخ شروع ۳- تاریخ پایان */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
              {plan.startsAt && (
                <span>تاریخ شروع: {formatPersianDate(plan.startsAt)}</span>
              )}
              {plan.expiresAt && (
                <span>تاریخ پایان: {formatPersianDate(plan.expiresAt)}</span>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {isExpired ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-danger/15 text-danger">
                منقضی شده
              </span>
            ) : isUpcoming ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                در انتظار شروع
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-success/15 text-success">
                فعال
              </span>
            )}
          </div>
        </div>

        {/* Conditions Box with 3-line clamping */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsDetailsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsDetailsOpen(true);
            }
          }}
          className="rounded-2xl p-3.5 bg-muted/10 hover:bg-muted/15 transition-colors cursor-pointer space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">شرایط طرح</span>
          </div>
          <p className="text-xs text-muted leading-relaxed line-clamp-3">
            {rawDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDetailsOpen(true);
          }}
          className="text-xs font-semibold text-primary-foreground p-3 rounded-2xl bg-primary transition-color duration-200 hover:bg-primary/80"
        >
          مشاهده جزئیات طرح
        </button>
      </div>

      {/* Plan Details HeroUI Bottom Sheet (Drawer) */}
      <Drawer>
        <Drawer.Backdrop
          isOpen={isDetailsOpen}
          onOpenChange={(open) => !open && setIsDetailsOpen(false)}
          className="fixed z-40 backdrop-blur-xs bg-foreground/30 min-h-60 flex items-end justify-center fade-up transition-all duration-300"
        >
          <Drawer.Content
            placement="bottom"
            className="w-full max-w-xl sm:max-w-2xl mx-auto fixed z-40 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[92dvh] sm:max-h-[94dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0! shadow-2xl"
          >
            <Drawer.Dialog className="flex flex-col bg-background h-auto! max-h-[92dvh] sm:max-h-[94dvh] min-h-0 outline-none text-start overscroll-contain m-0! mb-0! p-0! rounded-b-none!">
              {/* Drag Handle UI */}
              <div className="flex justify-center w-full shrink-0 pt-2 pb-1">
                <Drawer.Handle className="w-16 h-1.5 rounded-full" />
              </div>

              {/* Bottom Sheet Header */}
              <Drawer.Header className="w-full flex flex-row! items-center justify-between px-5 pt-1 pb-2 shrink-0 border-b border-border/40">
                <div className="flex items-center gap-2 min-w-0 flex-1 pe-2">
                  <TagIcon className="size-4 text-primary shrink-0" />
                  <Drawer.Heading className="text-sm font-extrabold text-foreground truncate">
                    {plan.title}
                  </Drawer.Heading>
                  {isExpired && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/15 text-danger shrink-0">
                      منقضی شده
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onPress={() => setIsDetailsOpen(false)}
                  aria-label="بستن"
                  className="size-9 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <XIcon size={16} />
                </Button>
              </Drawer.Header>

              {/* Bottom Sheet Body */}
              <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3.5 space-y-3.5 scrollbar-none pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-start">
                {/* Upcoming Notice in Bottom Sheet */}
                {isUpcoming && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold">
                    <ClockIcon className="size-4 shrink-0" />
                    <span>{upcomingDaysText}</span>
                  </div>
                )}

                {/* 3 Date Fields: ۱- تاریخ ایجاد (خودکار) ۲- تاریخ شروع ۳- تاریخ پایان */}
                <div className="rounded-2xl p-3.5 bg-muted/10 border border-border/30 space-y-2">
                  <span className="text-xs font-bold text-foreground block">
                    مشخصات طرح{" "}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-muted">
                    {plan.startsAt && plan.expiresAt && (
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-foreground">
                          بازه زمانی طرح:{" "}
                        </span>
                        <span>
                          از {formatPersianDateLong(plan.startsAt)} تا{" "}
                          {formatPersianDateLong(plan.expiresAt)}
                        </span>
                      </div>
                    )}

                    {plan.startsAt && (
                      <div>
                        <span>تاریخ شروع: </span>
                        <span className="font-semibold text-foreground">
                          {formatPersianDate(plan.startsAt)}
                        </span>
                      </div>
                    )}
                    {plan.expiresAt && (
                      <div>
                        <span>تاریخ پایان: </span>
                        <span className="font-semibold text-foreground">
                          {formatPersianDate(plan.expiresAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Complete Unabridged Conditions */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-foreground block">
                    شرایط و ضوابط کامل طرح
                  </span>
                  <div className="p-3.5 rounded-2xl bg-muted/5 border border-border/20 text-xs leading-relaxed text-foreground whitespace-pre-line">
                    {rawDescription}
                  </div>
                </div>

                {/* Products in Bottom Sheet */}
                {planProducts.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <BoxIcon size={14} className="text-primary" />
                        <span>کالاهای شامل این طرح</span>
                      </span>
                      <span className="text-[11px] text-muted">
                        {toPersianDigits(planProducts.length)} محصول
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {planProducts.map((prod) => {
                        const price =
                          prod.finalCustomerPricePerSqm &&
                          prod.finalCustomerPricePerSqm > 0
                            ? prod.finalCustomerPricePerSqm
                            : Number((prod as any).basePricePerSqm) > 0
                              ? Number((prod as any).basePricePerSqm)
                              : Number(prod.pricePerM2) || 0;

                        const dimText = formatProdDimension(prod);
                        const isProdOutOfStock =
                          prod.stockStatus === "out_of_stock" ||
                          prod.inStock === false ||
                          (Number.isFinite(Number(prod.inventorySqm)) &&
                            Number(prod.inventorySqm) <= 0);
                        const isSelected =
                          !isProdOutOfStock &&
                          selectedIds.includes(String(prod.id));

                        return (
                          <div
                            key={prod.id}
                            role={isExpired ? undefined : "button"}
                            tabIndex={isExpired ? -1 : 0}
                            onClick={
                              isExpired
                                ? undefined
                                : () => setSelectedProductForDetail(prod)
                            }
                            onKeyDown={
                              isExpired
                                ? undefined
                                : (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setSelectedProductForDetail(prod);
                                    }
                                  }
                            }
                            className={cn(
                              "flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all text-start",
                              isExpired
                                ? "opacity-40 blur-[1.5px] pointer-events-none cursor-not-allowed select-none bg-muted/5 border-border/20 grayscale-[0.2]"
                                : cn(
                                    "cursor-pointer select-none",
                                    isSelected
                                      ? "bg-primary/8 ring-1 ring-primary border-primary/30"
                                      : "bg-muted/10 hover:bg-muted/15 border-border/20",
                                    isProdOutOfStock && "opacity-80",
                                  ),
                            )}
                            title={
                              isExpired
                                ? "این طرح منقضی شده است"
                                : "مشاهده مشخصات کامل کالا"
                            }
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img
                                src={
                                  prod.images[0] ||
                                  "/assets/images/placeholder.svg"
                                }
                                alt={prod.name}
                                className="size-12 rounded-xl object-cover shrink-0 bg-muted/20"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (
                                    !target.src.endsWith(
                                      "/assets/images/placeholder.svg",
                                    )
                                  ) {
                                    target.src =
                                      "/assets/images/placeholder.svg";
                                  }
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-foreground truncate block">
                                  {prod.name}
                                </span>
                                {dimText && (
                                  <span className="text-[11px] text-muted block mt-0.5">
                                    ابعاد: {dimText}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-foreground inline-flex items-center gap-0.5 mt-1">
                                  <span>
                                    {price > 0
                                      ? formatToman(price)
                                      : "استعلام قیمت"}
                                  </span>
                                  {price > 0 && (
                                    <TomanIcon className="size-2.5" />
                                  )}
                                </span>
                              </div>
                            </div>

                            {isExpired ? (
                              <span className="h-8 px-2.5 rounded-xl bg-danger/10 text-danger text-[11px] font-bold shrink-0 flex items-center justify-center">
                                منقضی شده
                              </span>
                            ) : isUpcoming ? (
                              <span className="h-8 px-2.5 rounded-xl bg-muted/20 text-muted text-[11px] font-semibold shrink-0 flex items-center justify-center">
                                به‌زودی
                              </span>
                            ) : isProdOutOfStock ? (
                              <span className="h-8 px-2.5 rounded-xl bg-danger/15 text-danger text-[11px] font-bold shrink-0 flex items-center justify-center">
                                ناموجود
                              </span>
                            ) : isSelected && !isOrderingDisabled ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectionStore.unselectProduct(prod.id);
                                }}
                                className="h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                              >
                                <CheckIcon size={13} className="stroke-3" />
                              </button>
                            ) : isActive && !isOrderingDisabled ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectionStore.selectProduct(prod.id);
                                }}
                                className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shrink-0 flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                              >
                                <PlusIcon size={13} />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Drawer.Body>

              {/* Bottom Sheet Footer */}
              <div className="p-4 border-t border-border/40 flex items-center justify-between gap-3 shrink-0 bg-background">
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setIsDetailsOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  بستن
                </Button>

                {isExpired ? (
                  <span className="text-xs font-bold text-danger">
                    این طرح منقضی شده است
                  </span>
                ) : isActive ? (
                  isOrderingDisabled ? (
                    <span className="px-3 py-2 rounded-lg text-xs font-semibold bg-muted/15 text-muted">
                      فقط مشاهده کاتالوگ
                    </span>
                  ) : (
                    <Button
                      type="button"
                      onPress={() => {
                        const availablePlanProducts = planProducts.filter(
                          (p) =>
                            p.stockStatus !== "out_of_stock" &&
                            p.inStock !== false &&
                            !(
                              Number.isFinite(Number(p.inventorySqm)) &&
                              Number(p.inventorySqm) <= 0
                            ),
                        );
                        if (availablePlanProducts.length === 0) {
                          return;
                        }
                        // Add only available plan products to selection
                        availablePlanProducts.forEach((p) => {
                          selectionStore.selectProduct(p.id);
                        });
                        setIsDetailsOpen(false);
                        navigate({ to: "/product/new" });
                      }}
                      className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <span>ثبت سفارش کالاها</span>
                      <ArrowLeftIcon size={13} />
                    </Button>
                  )
                ) : (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    طرح به‌زودی آغاز می‌شود
                  </span>
                )}
              </div>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      {/* Product Details Bottom Sheet (Same as /product page) */}
      <ProductBottomSheet
        product={selectedProductForDetail}
        isOpen={Boolean(selectedProductForDetail)}
        isSelected={
          selectedProductForDetail
            ? selectedIds.includes(String(selectedProductForDetail.id))
            : false
        }
        isOrderingDisabled={isOrderingDisabled}
        onClose={() => setSelectedProductForDetail(null)}
        onToggleSelect={
          selectedProductForDetail && !isOrderingDisabled
            ? () => selectionStore.toggleProduct(selectedProductForDetail.id)
            : undefined
        }
        onOrderDirect={(product) => {
          if (isOrderingDisabled) return;
          selectionStore.selectProduct(product.id);
          setSelectedProductForDetail(null);
          setIsDetailsOpen(false);
          navigate({
            to: "/product/new",
          });
        }}
      />
    </>
  );
}
