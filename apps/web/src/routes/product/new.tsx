import { useMemo, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@heroui/react";
import { useProducts } from "../../features/products/product-store";
import {
  selectionStore,
  useSelectedIds,
} from "../../features/products/selection-store";
import { ProductConfigCard } from "../../features/products/product-config-card";
import { CartSummary } from "../../features/checkout/cart-summary";
import type { Product } from "../../types";
import { toast } from "../../components/feedback/toast";
import { ArrowRightIcon, BoxIcon } from "../../components/ui/icons";
import { useAuth, isProductAllowedForUser } from "../../features/auth/auth-store";

export const Route = createFileRoute("/product/new")({
  component: ProductNewConfigurationPage,
});

function ProductNewConfigurationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isOrderingDisabled = Boolean(user?.disableOrdering) || Boolean(user?.hideExactStock);

  useEffect(() => {
    if (isOrderingDisabled) {
      toast.warning(
        "محدودیت دسترسی",
        "حساب کاربری شما در وضعیت «فقط مشاهده کاتالوگ» تنظیم شده است و امکان ثبت سفارش را ندارد.",
      );
      navigate({ to: "/product" });
    }
  }, [isOrderingDisabled, navigate]);

  const { allProducts } = useProducts();
  const selectedIds = useSelectedIds();

  // Reconcile selected IDs with live products and prune out-of-stock items
  useEffect(() => {
    if (allProducts && allProducts.length > 0) {
      selectionStore.reconcileWithProducts(allProducts.map((p) => p.id));
      allProducts.forEach((p) => {
        const isOutOfStock =
          p.stockStatus === "out_of_stock" ||
          p.inStock === false ||
          (Number.isFinite(Number(p.inventorySqm)) &&
            Number(p.inventorySqm) <= 0);
        if (isOutOfStock && selectedIds.includes(String(p.id))) {
          selectionStore.unselectProduct(p.id);
        }
      });
    }
  }, [allProducts, selectedIds]);

  // Selected products resolved from live products database (excluding out-of-stock)
  const selectedProducts = useMemo(() => {
    return selectedIds
      .map((id) => {
        const cleanId = String(id).replace(/["']/g, "").trim();
        return allProducts.find(
          (p) =>
            String(p.id) === cleanId || p.sku === cleanId || p.slug === cleanId,
        );
      })
      .filter((p): p is Product => {
        if (!p) return false;
        if (!isProductAllowedForUser(p, user)) return false;
        const isOutOfStock =
          p.stockStatus === "out_of_stock" ||
          p.inStock === false ||
          (Number.isFinite(Number(p.inventorySqm)) &&
            Number(p.inventorySqm) <= 0);
        return !isOutOfStock;
      });
  }, [selectedIds, allProducts, user]);

  // Initialize quantities for newly selected products
  useEffect(() => {
    const { quantities } = selectionStore.getSnapshot();
    selectedProducts.forEach((prod) => {
      if (quantities[prod.id] === undefined || quantities[prod.id] < 1) {
        selectionStore.setQuantity(prod.id, Math.max(1, prod.sqmPerCarton || 1));
      }
    });
  }, [selectedProducts]);

  const handleRemoveProduct = (productId: string) => {
    selectionStore.unselectProduct(productId);
  };

  const handleBackToProducts = () => {
    navigate({ to: "/product" });
  };

  const handleOrderCreated = (orderId: string) => {
    selectionStore.clearSelection();
    toast.success("ثبت سفارش", "سفارش با موفقیت ثبت شد.");
    navigate({
      to: "/orders/$id",
      params: { id: orderId },
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
          onPress={handleBackToProducts}
          className="h-10 px-6 rounded-2xl bg-primary text-primary-foreground text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer"
        >
          رفتن به صفحه محصولات
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 pt-4 pb-28 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={handleBackToProducts}
            className="w-8 h-8 rounded-xl text-muted hover:text-foreground cursor-pointer"
            aria-label="بازگشت به محصولات"
          >
            <ArrowRightIcon size={18} />
          </Button>
          <div>
            <h1 className="text-base font-bold text-foreground">
              تعیین متراژ سفارش
            </h1>
            <p className="text-xs text-muted">
              متراژ مد نظر خود را برای هر محصول مشخص کنید
            </p>
          </div>
        </div>
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
        onOrderCreated={handleOrderCreated}
      />
    </div>
  );
}
