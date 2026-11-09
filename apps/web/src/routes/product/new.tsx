import { SupplyRequestModal } from '../../features/supply-requests/supply-request-modal';
import { SupplyRequestRecovery } from '../../features/supply-requests/supply-request-recovery';
import { supplyDraftStore } from '../../features/supply-requests/supply-request-draft';
import { useMemo, useEffect, useState, useRef } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@heroui/react";
import { useCatalogIds } from "../../features/products/catalog-data";
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
  const [supplyProductId, setSupplyProductId] = useState<number | null>(null);
  const [registeredSupplyId, setRegisteredSupplyId] = useState<number | null>(null);
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

  const selectedIds = useSelectedIds();
  const productQuery = useCatalogIds(selectedIds);
  const productsLoading = productQuery.isPending;
  const productsFailed = !!productQuery.error;
  const selectedProducts = useMemo(() => productQuery.data.filter((p): p is Product => isProductAllowedForUser(p, user)), [productQuery.data, user]);
  const entryChecked = useRef(false);
  useEffect(() => {
    if (!selectedIds.length || entryChecked.current) return;
    entryChecked.current = true;
    const draft = selectionStore.getSnapshot();
    if (!draft.warehouse || draft.quotes.length !== draft.selectedIds.length) void selectionStore.revalidate();
  }, [selectedIds]);

  // Initialize quantities for newly selected products
  useEffect(() => {
    const { quantities } = selectionStore.getSnapshot();
    selectedProducts.forEach((prod) => {
      if (quantities[prod.id] === undefined || quantities[prod.id] < 1) {
        selectionStore.setDraftQuantity(prod.id, Math.max(1, prod.sqmPerCarton || 1));
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
    toast.success("ثبت سفارش", "سفارش با موفقیت ثبت شد.");
    navigate({
      to: "/orders/$id",
      params: { id: orderId },
    });
  };

  if (productsLoading || productsFailed) {
    return <div className="p-6 text-center" role="status">{productsFailed ? "دریافت محصولات انتخاب‌شده ممکن نشد. دوباره تلاش کنید." : "در حال دریافت محصولات…"}{productsFailed && <Button onPress={() => void productQuery.refetch()}>تلاش مجدد</Button>}</div>;
  }

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
      {supplyProductId === null && <SupplyRequestRecovery onSuccess={(id) => void navigate({ to: '/orders', search: { view: 'supply', requestId: id } })} />}
      {registeredSupplyId && <p role="status" className="rounded-2xl bg-success/10 p-3 text-sm">درخواست تأمین ثبت شد. <Link to="/orders" search={{ view: 'supply', requestId: registeredSupplyId }} className="text-primary underline">پیگیری درخواست</Link></p>}
      {supplyProductId !== null && <SupplyRequestModal key={supplyProductId} productId={supplyProductId} onClose={() => setSupplyProductId(null)} onPurchase={() => setSupplyProductId(null)} onSuccess={id => { setRegisteredSupplyId(id); setSupplyProductId(null) }} />}
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
            onRequestSupply={(product, quantity) => {
              const existing = supplyDraftStore.getSnapshot().draft;
              if (!supplyDraftStore.open(Number(product.id))) return;
              if (!existing || existing.productId !== Number(product.id) || (!existing.pending && !(existing.edited ?? (existing.requestedQuantity !== 1 || !!existing.notes.trim())))) {
                supplyDraftStore.update({ requestedQuantity: quantity });
              }
              supplyDraftStore.deselect();
              setSupplyProductId(Number(product.id));
            }}
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
