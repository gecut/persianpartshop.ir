import { customerErrorMessage } from '../../lib/utils/error'
import { summarizeQuantities } from '../../lib/utils/unit'
import { useProductSelection } from '../products/selection-store'
import { WarehouseSummary } from '../cart/warehouse-selection'
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Product } from "../../types";
import { calculateCartonRequirement } from "../../lib/utils/math";
import { formatToman, toPersianDigits } from "../../lib/utils/currency";
import { SlideCommit } from "../../components/ui/slide-commit";
import { orderStore } from "../orders/order-store";
import { selectionStore } from "../products/selection-store";
import { formatGrade, formatUnit } from "../products/product-store";
import { toast } from "../../components/feedback/toast";
import { api } from "../../lib/api-client";
import { queryKeys, mutationKeys } from "../../lib/query-keys";
import {
  XIcon,
  PencilIcon,
  TomanIcon,
  ArrowRightIcon,
} from "../../components/ui/icons";

export interface PreInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  quantities: Record<string, number>;
  onSuccess: (orderId: string) => void;
}

interface PreInvoiceItemCardProps {
  item: {
    product: Product;
    requestedArea: number;
    cartonCount: number;
    deliverableArea: number;
    unitPrice: number;
    totalPrice: number;
  };
}

function PreInvoiceItemCard({ item }: PreInvoiceItemCardProps) {
  return (
    <div className="p-3 bg-muted/5 rounded-2xl space-y-2.5 text-xs text-start select-none">
      {/* Product Thumbnail & Details Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img
            src={item.product.images[0] || "/assets/images/placeholder.svg"}
            alt={item.product.name}
            className="w-13 h-13 rounded-2xl object-cover shrink-0"
            onError={(e) => {
              if (
                !e.currentTarget.src.endsWith("/assets/images/placeholder.svg")
              ) {
                e.currentTarget.src = "/assets/images/placeholder.svg";
              }
            }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-foreground text-xs sm:text-sm truncate leading-snug">
              {item.product.name}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-muted mt-1 flex-wrap">
              {item.product.dimensions?.width &&
              item.product.dimensions?.height ? (
                <span className="px-2 py-0.5 rounded-lg bg-muted/10 text-foreground font-semibold text-xs">
                  ابعاد: {toPersianDigits(item.product.dimensions.width)} ×{" "}
                  {toPersianDigits(item.product.dimensions.height)}
                </span>
              ) : item.product.weight ? (
                <span className="px-2 py-0.5 rounded-lg bg-muted/10 text-foreground font-semibold text-xs">
                  {formatUnit(item.product.unit)}{" "}
                  {toPersianDigits(item.product.weight)}
                </span>
              ) : item.product.unit ? (
                <span className="px-2 py-0.5 rounded-lg bg-muted/10 text-foreground font-semibold text-xs">
                  {formatUnit(item.product.unit)}
                </span>
              ) : null}
              <span className="text-muted">•</span>
              <span className="text-muted font-medium text-[11px]">
                {item.product.brand}
              </span>
            </div>
          </div>
        </div>

        {/* Total price displayed once */}
        <div className="flex items-center shrink-0">
          <span className="font-extrabold text-foreground inline-flex items-center gap-1 text-xs">
            <span>{formatToman(item.totalPrice)}</span>
            <TomanIcon className="size-3.5" />
          </span>
        </div>
      </div>

      {/* Calculation Metrics & Quality Grade */}
      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-border/10 bg-transparent">
        <div className="text-start">
          <span className="text-[11px] text-muted block mb-0.5">
            {item.product.productType === 'other' ? 'تعداد' : 'تعداد کارتن'}
          </span>
          <span className="font-bold text-primary">
            {toPersianDigits(item.cartonCount)} {item.product.productType === 'other' ? formatUnit(item.product.unit) : 'کارتن'}
          </span>
        </div>

        <div className="text-center">
          <span className="text-[11px] text-muted block mb-0.5">
            {item.product.productType === 'other' ? 'مقدار تحویلی' : 'متراژ تحویلی'}
          </span>
          <span className="font-bold text-foreground">
            {toPersianDigits(item.deliverableArea)} {item.product.productType === 'other' ? formatUnit(item.product.unit) : 'مترمربع'}
          </span>
        </div>

        <div className="text-end">
          {item.product.grade ? (
            <span className="text-xs text-muted block mb-0.5">درجه کیفی</span>
          ) : (
            ""
          )}
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary inline-block">
            {formatGrade(item.product.grade)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PreInvoiceModal({
  isOpen,
  onClose,
  products,
  quantities,
  onSuccess,
}: PreInvoiceModalProps) {
  const draft = useProductSelection();
  useEffect(() => { if (isOpen) void selectionStore.revalidate() }, [isOpen]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotencyKeyRef = useRef<string | null>(null);
  const submitOrderMutation = useMutation({
    mutationKey: mutationKeys.orders.submit,
    mutationFn: async (payload: any) => {
      return await api.order.submit(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });

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
          <div className="w-full bg-background border-t border-border/30 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
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
                <SlideCommit
                  label="برای ثبت سفارش بکشید"
                  doneLabel="سفارش تایید شد"
                  errorLabel="خطا در ثبت سفارش"
                  height={48}
                  radius={20}
                  trackColor="rgba(5, 150, 105, 0.12)"
                  handleColor="#059669"
                  successColor="#059669"
                  textColor="var(--color-foreground, #0e0c2d)"
                  disabled={
                    invoiceItems.length === 0 || submitOrderMutation.isPending || draft.busy || !draft.warehouse || draft.quotes.length !== draft.selectedIds.length
                  }
                  onConfirm={handleFinalConfirm}
                  className="w-full h-12! border-none! shadow-none! [box-shadow:none]!"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
