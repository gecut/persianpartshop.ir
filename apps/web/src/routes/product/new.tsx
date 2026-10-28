import { useState, useMemo, useEffect, useRef } from "react";
import {
  createFileRoute,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { Button, Modal as HeroUIModal } from "@heroui/react";
import { useProducts } from "../../features/products/product-store";
import {
  selectionStore,
  useSelectedIds,
} from "../../features/products/selection-store";
import { ProductConfigCard } from "../../features/products/product-config-card";
import { CartSummary } from "../../features/checkout/cart-summary";
import { computeCartTotals } from "../../features/checkout/cart-totals";
import type { Product } from "../../types";
import type { OrderItem } from "../../types/order";
import { calculateCartonRequirement } from "../../lib/utils/math";
import { toast } from "../../components/feedback/toast";
import {
  ArrowRightIcon,
  Trash2Icon,
  BoxIcon,
} from "../../components/ui/icons";
import { useOrders, orderStore } from "../../features/orders/order-store";

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

  // Only subscribe to selection IDs here. Quantity changes are subscribed to
  // per-card, so dragging one slider never re-renders the rest of the page.
  const selectedIds = useSelectedIds();

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
        selectionStore.setBatchSelection(
          order.items.map((item) => ({
            id: item.productId,
            quantity: item.requestedArea || item.deliverableArea,
          })),
        );
      }
    }
  }, [editOrderId, getOrderById]);

  // Reconcile selected IDs with live products
  useEffect(() => {
    if (allProducts && allProducts.length > 0) {
      selectionStore.reconcileWithProducts(allProducts.map((p) => p.id));
    }
  }, [allProducts]);

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

  // Initialize quantities for newly selected products without subscribing to the
  // whole quantity map (read it imperatively from the snapshot instead).
  useEffect(() => {
    const { quantities } = selectionStore.getSnapshot();
    selectedProducts.forEach((prod) => {
      if (quantities[prod.id] === undefined || quantities[prod.id] < 1) {
        selectionStore.setQuantity(prod.id, Math.max(1, prod.sqmPerCarton || 1));
      }
    });
  }, [selectedProducts]);

  const handleRemoveProduct = (productId: string) => {
    if (editOrderId && selectedProducts.length <= 1) {
      setPendingDeleteProductId(productId);
      setShowDeleteOrderConfirm(true);
      return;
    }
    selectionStore.unselectProduct(productId);
  };

  const handleConfirmDeleteOrder = async () => {
    if (editOrderId) {
      await cancelOrder(
        editOrderId,
        "لغو سفارش به دلیل حذف تمامی اقلام فاکتور",
      );
    }
    if (pendingDeleteProductId) {
      selectionStore.unselectProduct(pendingDeleteProductId);
    }
    selectionStore.clearSelection();
    navigate({ to: "/orders" });
  };

  const handleSaveEditedOrder = () => {
    if (!editOrderId) return;
    const existingOrder = getOrderById(editOrderId);
    if (!existingOrder) return;

    const { quantities } = selectionStore.getSnapshot();
    const totals = computeCartTotals(selectedProducts, quantities);
    if (!totals.hasValidQuantities) return;

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

    selectionStore.clearSelection();
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

  const handleOrderCreated = (orderId: string) => {
    selectionStore.clearSelection();
    toast.success("ثبت سفارش", "سفارش با موفقیت ثبت شد.");
    navigate({
      to: "/orders/$id",
      params: { id: editOrderId || orderId },
    });
  };

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
    <div className="w-full max-w-xl mx-auto px-4 py-3 space-y-4 text-start pb-8">
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
        {selectedProducts.map((product) => (
          <ProductConfigCard
            key={product.id}
            product={product}
            onRemove={handleRemoveProduct}
          />
        ))}
      </div>

      <CartSummary
        selectedProducts={selectedProducts}
        editOrderId={editOrderId}
        onSaveEditedOrder={handleSaveEditedOrder}
        onOrderCreated={handleOrderCreated}
      />

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
    </div>
  );
}