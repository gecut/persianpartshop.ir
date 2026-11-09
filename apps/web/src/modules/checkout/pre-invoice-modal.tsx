import { useSubmitOrder } from "@/modules/orders/use-submit-order"
import { customerErrorMessage } from '@/lib/utils/error'
import { summarizeQuantities } from '@/lib/utils/unit'
import { useProductSelection } from '@/modules/products/selection-store'
import { WarehouseSummary } from '@/modules/cart/warehouse-summary'
import { useMemo, useRef } from "react"
import { Button } from "@heroui/react"
import { AnimatePresence, motion } from "framer-motion"

import { useNavigate } from "@tanstack/react-router"
import type { Product } from "@/modules/products/product-types"
import { calculateCartonRequirement } from "@/lib/utils/math"
import { formatToman, toPersianDigits } from "@/lib/utils/currency"
import { CheckoutCommit } from "./checkout-commit"
import { CheckoutActionFooter } from "./checkout-action-footer"
import { orderStore } from "@/modules/orders/order-store"
import { selectionStore } from "@/modules/products/selection-store"
import { toast } from "@/components/feedback/toast"

import { XIcon, PencilIcon, TomanIcon, ArrowRightIcon } from "@/components/ui/icons"
import { PreInvoiceItemCard } from './_pre-invoice-item-card'

export interface PreInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  quantities: Record<string, number>;
  onSuccess: (orderId: string) => void;
}

export function PreInvoiceModal({
  isOpen,
  onClose,
  products,
  quantities,
  onSuccess,
}: PreInvoiceModalProps) {
  const draft = useProductSelection();

  const navigate = useNavigate();
  const idempotencyKeyRef = useRef<string | null>(null);
  const submitOrderMutation = useSubmitOrder();

  // Calculate detailed items and invoice totals
  const invoiceItems = useMemo(() => {
    return products.map((product) => {
      const area = quantities[product.id] ?? 0;
      const calc = calculateCartonRequirement(
        area,
        product.sqmPerCarton,
        product.finalCustomerPricePerSqm,
        product.inventorySqm,
      );
      const quote = draft.quotes.find(item => String(item.productId) === product.id);
      return {
        product,
        requestedArea: area,
        cartonCount: quote?.cartonCount ?? calc.cartonCount,
        deliverableArea: quote?.deliverableArea ?? calc.deliverableArea,
        unitPrice: quote?.unitPrice ?? product.finalCustomerPricePerSqm,
        totalPrice: quote?.totalPrice ?? calc.totalPrice,
      };
    });
  }, [products, quantities, draft.quotes]);

  const invoiceTotals = useMemo(() => {
    return {
      totalCartons: invoiceItems.filter(item => item.product.productType !== 'other').reduce((total, item) => total + item.cartonCount, 0),
      finalPayable: invoiceItems.reduce((total, item) => total + item.totalPrice, 0),
    };
  }, [invoiceItems]);

  const handleFinalConfirm = async () => {
    if (invoiceItems.length !== draft.selectedIds.length || invoiceItems.some(item => draft.quantities[item.product.id] !== item.requestedArea)) throw new Error('سبد تغییر کرده است؛ پیش‌فاکتور را دوباره دریافت کنید.');
    if (!draft.warehouse || draft.busy || draft.quotes.length !== draft.selectedIds.length) throw new Error('ابتدا انبار و موجودی سبد را بررسی کنید.');
    let createdId = "";


    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("persianpart_token")
        : null;
    if (!token) {
      toast.warning(
        "نیاز به ورود",
        "جهت ثبت و نهایی‌سازی سفارش، ابتدا وارد حساب کاربری خود شوید.",
      );
      onClose();
      navigate({ to: "/login" as any });
      return;
    }

    try {
      idempotencyKeyRef.current = selectionStore.submissionKey("ثبت سفارش از لیست محصولات");
      const submittedDraft = selectionStore.submissionSnapshot();
      const res = await submitOrderMutation.mutateAsync({
        warehouseId: draft.warehouse.id,
        items: invoiceItems.map((item) => ({
          productId: isNaN(Number(item.product.id))
            ? item.product.id
            : Number(item.product.id),
          requestedArea: item.requestedArea,
        })),
        notes: "ثبت سفارش از لیست محصولات",
        idempotencyKey: idempotencyKeyRef.current,
      });
      if (res?.id) {
        if (!selectionStore.finishSubmission(submittedDraft)) return;
        orderStore.acceptOrder(res);
        idempotencyKeyRef.current = null;
        createdId = String(res.id);

      }
    } catch (err) {
      toast.error('خطا در ثبت سفارش', customerErrorMessage(err, 'ثبت سفارش ممکن نشد؛ دوباره تلاش کنید.'));
      throw err;
    }

    if (!createdId) {
      return;
    }

    // Slight delay to allow the user to see the complete 360 spin & checkmark animation
    setTimeout(() => {
      onSuccess(createdId);
    }, 450);
  };

  const handleEditClick = () => {
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.includes("/product/new")
    ) {
      selectionStore.setBatchSelection(
        products.map((p) => ({
          id: p.id,
          quantity: quantities[p.id] ?? p.sqmPerCarton ?? 10,
        })),
      );
      onClose();
      (navigate as any)({
        to: "/product/new",
      });
      return;
    }
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pre-invoice-fullpage"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 bg-background flex flex-col h-dvh w-full overflow-hidden select-none"
        >
          {/* Header Bar */}
          <div className="w-full bg-background border-b border-border/30 shrink-0 pt-[env(safe-area-inset-top,0px)]">
            <div className="w-full max-w-xl mx-auto flex items-center justify-between px-4 py-3">
              <Button
                type="button"
                onClick={handleClose}
                aria-label="بازگشت"
                className="h-10 px-3.5 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <ArrowRightIcon size={16} />
                <span>بازگشت</span>
              </Button>

              <div className="flex flex-col items-center">
                <h1 className="text-sm font-extrabold text-foreground">
                  پیش‌فاکتور تایید سفارش
                </h1>
                <span className="text-[11px] font-medium text-muted">
                  {toPersianDigits(invoiceItems.length)} قلم کالا
                </span>
              </div>

              <Button
                type="button"
                onClick={handleClose}
                aria-label="بستن پیش‌فاکتور"
                className="size-10 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <XIcon size={18} />
              </Button>
            </div>
          </div>

          {/* Scrollable Body: Items List */}
          <div className="flex-1 w-full max-w-xl mx-auto overflow-y-auto overscroll-contain px-4 py-3 space-y-2.5 scrollbar-none">
            <WarehouseSummary />
            {invoiceItems.map((item) => (
              <PreInvoiceItemCard key={item.product.id} item={item} />
            ))}
          </div>

          {/* Financial Summary & Action Footer */}
          <CheckoutActionFooter>
            <div className="w-full max-w-xl mx-auto px-4 py-2.5 space-y-1.5 text-xs">
              {invoiceTotals.totalCartons > 0 && <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">
                  تعداد کارتن‌ها:
                </span>
                <span className="text-xs font-bold text-foreground">
                  {toPersianDigits(invoiceTotals.totalCartons)} عدد
                </span>
              </div>}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">
                  مقدار تحویلی:
                </span>
                <span className="text-xs font-bold text-foreground">
                  {summarizeQuantities(invoiceItems.map(item => ({ unit: item.product.productType === 'other' ? (item.product.unit ?? 'piece') : 'm2', quantity: item.deliverableArea })))}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-foreground">
                  قیمت کل:
                </span>
                <span className="text-base font-extrabold text-foreground inline-flex items-center gap-1">
                  <span>{formatToman(invoiceTotals.finalPayable)}</span>
                  <TomanIcon className="size-4" />
                </span>
              </div>
            </div>

            <div className="w-full max-w-xl mx-auto px-4 pt-1 flex items-center gap-2.5">
              {/* Button: ویرایش مقادیر */}
              <Button
                type="button"
                onPress={handleEditClick}
                className="w-auto h-12 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 touch-manipulation shrink-0"
              >
                <PencilIcon size={16} />
                <span>ویرایش</span>
              </Button>

              <div className="flex-1">
                <CheckoutCommit
                  label="برای ثبت سفارش بکشید"
                  doneLabel="سفارش تایید شد"
                  errorLabel="خطا در ثبت سفارش"
                  disabled={
                    invoiceItems.length === 0 || submitOrderMutation.isPending || draft.busy || !draft.warehouse || draft.quotes.length !== draft.selectedIds.length
                  }
                  onConfirm={handleFinalConfirm}
                />
              </div>
            </div>
          </CheckoutActionFooter>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
