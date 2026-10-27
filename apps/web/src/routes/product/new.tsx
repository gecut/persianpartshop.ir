import { useState, useMemo, useEffect, useRef } from "react";
import {
  createFileRoute,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import {
  Slider,
  NumberField,
  I18nProvider,
  Button,
  Modal as HeroUIModal,
} from "@heroui/react";
import {
  useProducts,
  formatGrade,
} from "../../features/products/product-store";
import { useProductSelection } from "../../features/products/selection-store";
import type { Product } from "../../types";
import type { OrderItem } from "../../types/order";
import { calculateCartonRequirement } from "../../lib/utils/math";
import { formatToman, toPersianDigits } from "../../lib/utils/currency";
import { PreInvoiceModal } from "../../features/checkout/pre-invoice-modal";
import { toast } from "../../components/feedback/toast";
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  Trash2Icon,
  BoxIcon,
  SolarRulerIcon,
  SolarBoxIcon,
  SolarLayersIcon,
  TomanIcon,
} from "../../components/ui/icons";
import { useOrders, orderStore } from "../../features/orders/order-store";
import { MoneyBagOutlineIcon } from "@solar-icons/react";

export const Route = createFileRoute("/product/new")({
  component: ProductNewConfigurationPage,
});

function ProductNewConfigurationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchObj = (location.search || {}) as Record<string, any>;
  const editOrderId: string | undefined =
    searchObj.editOrderId ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("editOrderId") ||
        undefined
      : undefined);
  const { allProducts } = useProducts();
  const { getOrderById, cancelOrder } = useOrders();
  const {
    selectedIds,
    quantities,
    unselectProduct,
    setQuantity,
    clearSelection,
    setBatchSelection,
    reconcileWithProducts,
  } = useProductSelection();

  // Modal state for Pre-Invoice and order delete confirmation
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [showDeleteOrderConfirm, setShowDeleteOrderConfirm] = useState(false);
  const [pendingDeleteProductId, setPendingDeleteProductId] = useState<
    string | null
  >(null);

  // Single-run hydration ref: only hydrate once on mount, never re-hydrate when user clears products
  const hasHydratedRef = useRef(false);

  // Hydrate from order if editOrderId is provided
  useEffect(() => {
    if (editOrderId && !hasHydratedRef.current) {
      const order = getOrderById(editOrderId);
      if (order && order.items && order.items.length > 0) {
        hasHydratedRef.current = true;
        setBatchSelection(
          order.items.map((item) => ({
            id: item.productId,
            quantity: item.requestedArea || item.deliverableArea,
          })),
        );
      }
    }
  }, [editOrderId, getOrderById, setBatchSelection]);

  // Reconcile selected IDs with live products
  useEffect(() => {
    if (allProducts && allProducts.length > 0) {
      reconcileWithProducts(allProducts.map((p) => p.id));
    }
  }, [allProducts, reconcileWithProducts]);

  // Selected products resolved from live products database
  const selectedProducts = useMemo(() => {
    return selectedIds
      .map((id) => {
        const cleanId = String(id).replace(/["']/g, "").trim();
        return allProducts.find(
          (p) =>
            String(p.id) === cleanId || p.sku === cleanId || p.slug === cleanId,
        );
      })
      .filter((p): p is Product => p !== undefined);
  }, [selectedIds, allProducts]);

  // Automatically initialize quantities for new products in selection
  useEffect(() => {
    selectedProducts.forEach((prod) => {
      if (quantities[prod.id] === undefined || quantities[prod.id] < 1) {
        setQuantity(prod.id, Math.max(1, prod.sqmPerCarton || 1));
      }
    });
  }, [selectedProducts, quantities, setQuantity]);

  const handleAreaChange = (
    productId: string,
    val: number,
    inventorySqm: number,
  ) => {
    const minVal = 1;
    const maxVal = inventorySqm > 0 ? inventorySqm : 500;
    const rawVal = isNaN(val) || val < minVal ? minVal : Math.round(val * 10) / 10;
    const clampedVal = Math.max(minVal, Math.min(rawVal, maxVal));
    setQuantity(productId, clampedVal);
  };

  const handleRemoveProduct = (productId: string) => {
    if (editOrderId && selectedProducts.length <= 1) {
      setPendingDeleteProductId(productId);
      setShowDeleteOrderConfirm(true);
      return;
    }
    unselectProduct(productId);
  };

  const handleConfirmDeleteOrder = async () => {
    if (editOrderId) {
      await cancelOrder(
        editOrderId,
        "لغو سفارش به دلیل حذف تمامی اقلام فاکتور",
      );
    }
    if (pendingDeleteProductId) {
      unselectProduct(pendingDeleteProductId);
    }
    clearSelection();
    setShowDeleteOrderConfirm(false);
    toast.info(
      "فاکتور حذف شد",
      "فاکتور به دلیل حذف تمامی اقلام کلا پاک گردید.",
    );
    navigate({ to: "/orders" });
  };

  const handleSaveEditedOrder = () => {
    if (!editOrderId || !totals.hasValidQuantities) return;
    const existingOrder = getOrderById(editOrderId);
    if (!existingOrder) return;

    const orderItems: OrderItem[] = selectedProducts.map((p) => {
      const area = quantities[p.id] ?? 0;
      const calc = calculateCartonRequirement(
        area,
        p.sqmPerCarton,
        p.finalCustomerPricePerSqm,
        p.inventorySqm > 0 ? p.inventorySqm : 500,
      );
      return {
        productId: p.id,
        productName: p.name,
        productSlug: p.slug || p.id,
        productSku: p.sku,
        dimension: `${p.dimensions.width}×${p.dimensions.height}`,
        unitPrice: p.finalCustomerPricePerSqm,
        requestedArea: area,
        deliverableArea: calc.deliverableArea,
        cartonCount: calc.cartonCount,
        totalPrice: calc.totalPrice,
        productImage: p.images?.[0] || "/placeholder.png",
        status: existingOrder.status,
      };
    });

    const subtotal = totals.totalPrice;
    const taxAmount = Math.round(subtotal * 0.1);
    const finalTotal = subtotal + taxAmount;

    orderStore.updateOrder(editOrderId, {
      items: orderItems,
      subtotal,
      discountAmount: 0,
      taxAmount,
      finalTotal,
    });

    clearSelection();
    toast.success(
      "فاکتور به‌روزرسانی شد",
      "تغییرات فاکتور با موفقیت ذخیره گردید.",
    );
    navigate({
      to: "/orders/$id",
      params: { id: editOrderId },
    });
  };

  const handleBackToProducts = () => {
    navigate({
      to: "/product",
    });
  };

  // Calculate totals across all selected products
  const totals = useMemo(() => {
    let totalCartons = 0;
    let totalDeliverableArea = 0;
    let totalPrice = 0;

    selectedProducts.map((product) => {
      const maxInv = product.inventorySqm > 0 ? product.inventorySqm : 500;
      const area = Math.max(1, quantities[product.id] ?? 1);
      const calc = calculateCartonRequirement(
        area,
        product.sqmPerCarton,
        product.finalCustomerPricePerSqm,
        maxInv,
      );
      totalCartons += calc.cartonCount;
      totalDeliverableArea += calc.deliverableArea;
      totalPrice += calc.totalPrice;
    });

    return {
      totalCartons,
      totalDeliverableArea: Math.round(totalDeliverableArea * 100) / 100,
      totalPrice,
      hasValidQuantities:
        selectedProducts.length > 0 &&
        selectedProducts.every((p) => (quantities[p.id] ?? 0) >= 1),
    };
  }, [selectedProducts, quantities]);

  if (selectedProducts.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl text-muted flex items-center justify-center mx-auto">
          <BoxIcon size={32} />
        </div>
        <h2 className="text-base font-bold text-foreground">
          محصولی برای تعیین متراژ انتخاب نشده است
        </h2>
        <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
          لطفاً ابتدا به صفحه محصولات مراجعه کرده و با کلیک روی کارت‌ها،
          کاشی‌های مد نظر خود را انتخاب نمایید.
        </p>
        <Button
          type="button"
          onClick={() => navigate({ to: "/product" })}
          className="inline-flex items-center gap-2 h-12 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold cursor-pointer transition-all active:scale-95"
        >
          <ArrowRightIcon size={16} />
          <span>بازگشت به لیست محصولات</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-3 space-y-4 text-start pb-28">
      {/* Top Navigation & Step Indicator */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <Button
          type="button"
          onClick={handleBackToProducts}
          className="inline-flex items-center gap-1.5 h-12 px-5 py-2 rounded-2xl bg-muted/5 hover:bg-muted/20 text-foreground text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowRightIcon size={14} />
          <span>بازگشت به لیست محصولات</span>
        </Button>
      </div>

      <div className="space-y-4">
        {selectedProducts.map((product) => {
          const maxInventory =
            product.inventorySqm > 0 ? product.inventorySqm : 500;
          const area = Math.max(
            1,
            quantities[product.id] ??
              Math.min(maxInventory, Math.max(product.sqmPerCarton || 1, 1)),
          );
          const calc = calculateCartonRequirement(
            area,
            product.sqmPerCarton,
            product.finalCustomerPricePerSqm,
            maxInventory,
          );
          const percent =
            maxInventory > 0
              ? Math.min(100, Math.max(0, (area / maxInventory) * 100))
              : 0;

          return (
            <div
              key={product.id}
              className="bg-muted/4 rounded-2xl p-4 transition-all space-y-3.5"
            >
              {/* 1. Header Row: Thumbnail + Product Info + Delete Button */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-16 rounded-2xl overflow-hidden shrink-0 bg-muted/10">
                    <img
                      src={
                        product.images[0] || "/assets/images/placeholder.svg"
                      }
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        if (
                          !e.currentTarget.src.endsWith(
                            "/assets/images/placeholder.svg",
                          )
                        ) {
                          e.currentTarget.src =
                            "/assets/images/placeholder.svg";
                        }
                      }}
                    />
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-muted/10 text-foreground">
                        {toPersianDigits(product.dimensions.width)} ×{" "}
                        {toPersianDigits(product.dimensions.height)}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                        {formatGrade(product.grade)}
                      </span>
                      <span className="text-xs font-semibold text-muted">
                        {product.brand}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-foreground  mt-1">
                      {product.name}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-muted mt-0.5 flex-wrap">
                      {/* <span className="font-mono text-foreground font-bold" dir="ltr">{product.sku}</span> */}
                      <span className="inline-flex items-center gap-1">
                        <strong className="font-bold text-foreground">
                          {formatToman(product.finalCustomerPricePerSqm)}
                        </strong>
                        <TomanIcon className="size-4" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  onPress={() => handleRemoveProduct(product.id)}
                  className="size-8 px-2 py-1.5 rounded-lg text-foregorund hover:text-danger hover:bg-danger/15 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-0.5"
                  aria-label={`حذف ${product.name}`}
                >
                  <Trash2Icon size={15} />
                </Button>
              </div>

              <div className="h-px bg-separator" />

              {/* 2. Meterage Controls: NumberField & Slider */}
              <div className="space-y-2.5 ">
                <div className="space-y-4 pt-0.5">
                  <div className="w-full">
                    <I18nProvider locale="fa-IR">
                      <Slider
                        minValue={1}
                        maxValue={maxInventory}
                        step={1}
                        value={Math.max(1, area)}
                        onChange={(val) => {
                          const num =
                            typeof val === "number" ? val : (val[0] ?? 1);
                          handleAreaChange(product.id, Math.max(1, num), maxInventory);
                        }}
                        aria-label={`اسلایدر متراژ ${product.name}`}
                        className="w-full"
                      >
                        <Slider.Track className="relative h-2.5  w-full rounded-full bg-muted/20 border-none">
                          {/* RTL Accurate Fill: expands synchronously from right edge to the thumb without delay */}
                          <div
                            className="absolute left-auto right-0 top-0 bottom-0 rounded-full bg-primary pointer-events-none"
                            style={{
                              width: `${percent}%`,
                            }}
                          />
                          <Slider.Thumb className="w-5.5! h-5.5! min-w-0! rounded-full! bg-white border-2 border-primary cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary/40 outline-none" />
                        </Slider.Track>
                      </Slider>
                    </I18nProvider>
                  </div>

                  <div className="flex justify-between rounded-lg mt-3 items-center text-xs text-foreground font-bold">
                    <div className="flex items-center gap-1.5 justify-center shrink-0">
                      <I18nProvider locale="fa-IR">
                        <NumberField
                          minValue={1}
                          maxValue={maxInventory}
                          step={1}
                          value={area}
                          onChange={(val) =>
                            handleAreaChange(product.id, val, maxInventory)
                          }
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
                      onClick={() =>
                        handleAreaChange(product.id, maxInventory, maxInventory)
                      }
                      className="p-2.5 rounded-xl bg-secondary text-secondary-foreground cursor-pointer select-none active:scale-95 transition-transform"
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
                      متراژ انتخابی
                    </span>
                    <span className="font-bold text-foreground text-sm leading-normal  block">
                      {toPersianDigits(calc.requestedArea)}
                    </span>
                  </div>
                </div>

                {/* 2. تعداد کارتن */}
                <div className="p-2.5 bg-muted/5 rounded-2xl flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <SolarBoxIcon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-muted font-medium block leading-tight mb-1">
                      تعداد کارتن
                    </span>
                    <span className="font-bold text-primary text-sm leading-normal  block">
                      {toPersianDigits(calc.cartonCount)} کارتن
                    </span>
                  </div>
                </div>

                {/* 3. متراژ تحویلی واقعی */}
                <div className="p-2.5 bg-primary rounded-2xl flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 text-background flex items-center justify-center shrink-0">
                    <SolarLayersIcon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-primary-foreground    font-medium block leading-tight mb-1">
                      متراژ تحویلی
                    </span>
                    <span className="font-bold text-primary-foreground  text-sm leading-normal  block">
                      {toPersianDigits(calc.deliverableArea)}
                    </span>
                  </div>
                </div>

                {/* 4. مبلغ برآورد */}
                <div className="p-2.5 bg-success rounded-2xl flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl  text-background flex items-center justify-center shrink-0">
                    <MoneyBagOutlineIcon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-background font-medium block leading-tight  mb-1">
                      مبلغ برآورد
                    </span>
                    <span className="font-bold text-background text-sm leading-normal  inline-flex items-center gap-1">
                      <span>{formatToman(calc.totalPrice)}</span>
                      <TomanIcon className="size-4" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white/95 dark:bg-background/95 backdrop-blur-md z-40 p-4 border-t border-border/20">
        {editOrderId ? (
          <Button
            type="button"
            onPress={handleSaveEditedOrder}
            isDisabled={!totals.hasValidQuantities}
            className="w-full h-12 px-4 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer select-none touch-manipulation"
          >
            <span>ذخیره تغییرات فاکتور</span>
            <ArrowLeftIcon size={16} />
          </Button>
        ) : (
          <Button
            type="button"
            onPress={() => setIsInvoiceOpen(true)}
            isDisabled={!totals.hasValidQuantities}
            className="w-full h-12 px-4 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer select-none touch-manipulation"
          >
            <span>تایید</span>
            <ArrowLeftIcon size={16} />
          </Button>
        )}
      </div>

      {/* Delete Entire Order Confirmation Modal */}
      <HeroUIModal.Root
        isOpen={showDeleteOrderConfirm}
        onOpenChange={(open) => !open && setShowDeleteOrderConfirm(false)}
      >
        <HeroUIModal.Backdrop
          isDismissable
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
        >
          <HeroUIModal.Container className="pointer-events-none w-full max-w-sm h-auto p-0 flex flex-col items-center">
            <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
                <Trash2Icon size={24} />
              </div>
              <div>
                <HeroUIModal.Heading className="text-base font-bold text-foreground">
                  حذف کامل فاکتور
                </HeroUIModal.Heading>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  در صورت حذف این مورد فاکتور شما کلا پاک می‌شود. آیا از حذف
                  فاکتور اطمینان دارید؟
                </p>
              </div>
              <div className="w-full flex items-center justify-center gap-2 pt-2">
                <Button
                  type="button"
                  onPress={() => setShowDeleteOrderConfirm(false)}
                  className="h-11 px-4 w-full rounded-2xl bg-muted/10 text-foreground text-xs font-bold hover:bg-muted/15 cursor-pointer transition-all"
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  onPress={handleConfirmDeleteOrder}
                  className="h-11 px-4 w-full rounded-2xl bg-danger text-white hover:bg-danger/90 font-bold text-xs cursor-pointer transition-all shadow-md"
                >
                  حذف فاکتور
                </Button>
              </div>
            </HeroUIModal.Dialog>
          </HeroUIModal.Container>
        </HeroUIModal.Backdrop>
      </HeroUIModal.Root>

      {/* Pre-Invoice Modal */}
      <PreInvoiceModal
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        products={selectedProducts}
        quantities={quantities}
        editOrderId={editOrderId}
        onSuccess={(orderId) => {
          setIsInvoiceOpen(false);
          clearSelection();
          toast.success("ثبت سفارش", "سفارش با موفقیت ثبت شد.");
          navigate({
            to: "/orders/$id",
            params: { id: editOrderId || orderId },
          });
        }}
      />
    </div>
  );
}
