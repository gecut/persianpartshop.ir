import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Modal as HeroUIModal, Button, Dropdown, cn } from "@heroui/react";
import {
  useOrders,
  buildFullOrderTimeline,
} from "../../features/orders/order-store";
import {
  ORDER_STATUS_MAP,
  type Order,
  type OrderItem,
  type Product,
} from "../../types";
import { OrderTimeline } from "../../features/orders/order-timeline";
import { Badge } from "../../components/ui/badge";
import { formatToman, toPersianDigits } from "../../lib/utils/currency";
import { formatPersianDate } from "../../lib/utils/date";
import { toast } from "../../components/feedback/toast";
import { OrderDetailSkeleton } from "../../components/ui/skeleton";
import {
  ArrowRightIcon,
  RefreshCwIcon,
  XIcon,
  StoreIcon,
  MapPinIcon,
  PhoneIcon,
  AlertTriangleIcon,
  ClockIcon,
  TomanIcon,
  PencilIcon,
  ChevronDownIcon,
  CheckIcon,
} from "../../components/ui/icons";
import { PreInvoiceModal } from "../../features/checkout/pre-invoice-modal";
import { useProducts } from "../../features/products/product-store";
import { selectionStore } from "../../features/products/selection-store";
import { Counter } from "../../components/ui/counter";

export const Route = createFileRoute("/orders/$id")({
  loader: async ({ params }) => {
    return { orderId: params.id };
  },
  component: OrderDetailPage,
});

function formatInvoiceNumber(order: { id: string | number; orderNumber?: string } | string | number): string {
  if (typeof order === "object" && order !== null) {
    if (order.orderNumber && /^ptp\s+/i.test(order.orderNumber)) {
      return order.orderNumber.toLowerCase();
    }
    const cleanId = String(order.id)
      .replace(/^ord-/, "")
      .replace(/^PP-1405-|^PP-REQ-|^PP-|^ptp\s*/i, "");
    return `ptp ${cleanId}`;
  }
  const cleanId = String(order)
    .replace(/^ord-/, "")
    .replace(/^PP-1405-|^PP-REQ-|^PP-|^ptp\s*/i, "");
  return `ptp ${cleanId}`;
}

const CANCELLATION_REASONS = [
  "تغییر در متراژ یا اقلام سفارش",
  "تغییر در زمان‌بندی پروژه",
  "ثبت اشتباه فاکتور",
  "انصراف موقت خریدار",
] as const;

function OrderDetailPage() {
  const { orderId } = Route.useLoaderData();
  const navigate = useNavigate();
  const { getOrderById, fetchOrderById, cancelOrder, orders } = useOrders();
  const { allProducts } = useProducts();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>(
    CANCELLATION_REASONS[0],
  );
  const [isCancelReasonOpen, setIsCancelReasonOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(
    () => getOrderById(orderId) || null,
  );
  const [isLoading, setIsLoading] = useState(!order);

  const isCancelled =
    order?.status === "cancel" ||
    order?.status === "cancelled" ||
    order?.status === "cancelled_by_customer" ||
    order?.status === "cancelled_by_admin";

  const isCompleted =
    order?.status === "completed" ||
    order?.status === "approved" ||
    order?.status === "approve";

  // 10-Minute Countdown Timer calculation (starts at 10 minutes for pending orders)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(600);

  useEffect(() => {
    let isMounted = true;
    const cached = getOrderById(orderId);
    if (cached) {
      setOrder(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchOrderById(orderId).then((res) => {
      if (isMounted) {
        setOrder(res);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [orderId, orders]);

  useEffect(() => {
    if (!order || isCancelled || isCompleted) return;

    // Set to 10 minutes (600s) as requested
    const initialTime = 600;
    const startTime = Date.now();

    setTimeLeftSeconds(initialTime);

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, initialTime - elapsed);
      setTimeLeftSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [order?.id, isCancelled, isCompleted, order?.updatedAt, order?.status]);

  const isWithin10Minutes = timeLeftSeconds > 0;
  const is10MinutesPassed = timeLeftSeconds <= 0;
  const isCancellableByCustomer =
    !isCancelled && !isCompleted && isWithin10Minutes;

  const timeline = useMemo(() => {
    if (!order) return [];
    return buildFullOrderTimeline(
      order,
      formatPersianDate(order.createdAt || order.date),
      is10MinutesPassed,
    );
  }, [order, is10MinutesPassed]);

  const displayStatusLabel = useMemo(() => {
    if (!order) return "";
    if (order.status === "pending") {
      return is10MinutesPassed ? "در حال بررسی واحد بازرگانی" : "سفارش ثبت شده";
    }
    if (
      order.status === "approve" ||
      order.status === "approved" ||
      order.status === "completed"
    ) {
      return "تکمیل شده";
    }
    if (isCancelled) {
      return order.cancelledBy === "customer" ||
        order.status === "cancelled_by_customer"
        ? "لغو توسط کاربر"
        : "لغو توسط ادمین";
    }
    return (
      ORDER_STATUS_MAP[order.status as keyof typeof ORDER_STATUS_MAP]?.label ||
      order.statusLabel
    );
  }, [order, is10MinutesPassed, isCancelled]);

  const statusConfig = order
    ? {
        label: displayStatusLabel,
        color: isCancelled
          ? ("danger" as const)
          : isCompleted
            ? ("success" as const)
            : is10MinutesPassed
              ? ("warning" as const)
              : ("primary" as const),
      }
    : { label: "", color: "warning" as const };

  // Reorder data for PreInvoiceModal
  const { reorderProducts, reorderQuantities } = useMemo(() => {
    if (!order?.items) return { reorderProducts: [], reorderQuantities: {} };
    const products: Product[] = order.items.map((item) => {
      const found = allProducts.find(
        (p) =>
          String(p.id) === String(item.productId) || p.sku === item.productSku,
      );
      if (found) return found;
      return {
        id: item.productId,
        slug: item.productSlug || item.productId,
        name: item.productName,
        sku: item.productSku,
        dimension: item.dimension,
        dimensions: { width: 0, height: 0 },
        brand: "پرشین پارت",
        color: "",
        grade: "درجه ۱" as const,
        category: "پرسلان کف" as const,
        finalCustomerPricePerSqm: item.unitPrice,
        pricePerM2: item.unitPrice,
        sqmPerCarton:
          item.deliverableArea && item.cartonCount
            ? Math.round((item.deliverableArea / item.cartonCount) * 100) / 100
            : 1.44,
        areaPerCarton:
          item.deliverableArea && item.cartonCount
            ? Math.round((item.deliverableArea / item.cartonCount) * 100) / 100
            : 1.44,
        piecesPerCarton: 4,
        tilesPerCarton: 4,
        cartonWeightKg: 25,
        inventorySqm: 9999,
        stockCartons: 999,
        inStock: true,
        stockStatus: "in_stock" as const,
        applications: [],
        tags: [],
        images: [item.productImage || "/placeholder.png"],
        gallery: [item.productImage || "/placeholder.png"],
      };
    });
    const quantities: Record<string, number> = {};
    order.items.forEach((item) => {
      quantities[item.productId] = item.requestedArea || item.deliverableArea;
    });
    return { reorderProducts: products, reorderQuantities: quantities };
  }, [order?.items, allProducts]);

  const handleCancel = async () => {
    if (!order) return;
    await cancelOrder(order.id, cancelReason);
    setShowCancelModal(false);
    toast.info(
      "سفارش لغو شد",
      `سفارش ${formatInvoiceNumber(order)} با موفقیت لغو شد و موجودی به انبار بازگردانی گردید.`,
    );
    const fresh = await fetchOrderById(order.id);
    if (fresh) setOrder(fresh);
  };

  const handleReorder = async () => {
    if (!order || isCancelled) return;
    setIsReorderModalOpen(true);
  };

  const handleEditOrder = () => {
    if (!order) return;
    selectionStore.setBatchSelection(
      order.items.map((item) => ({
        id: item.productId,
        quantity: item.requestedArea || item.deliverableArea,
      })),
    );
    (navigate as any)({
      to: "/product/new",
      search: { editOrderId: order.id },
    });
  };

  if (isLoading) {
    return <OrderDetailSkeleton />;
  }

  if (!order) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <h2 className="text-sm font-bold text-foreground">
          سفارش مورد نظر یافت نشد
        </h2>
        <p className="text-xs text-muted">
          ممکن است این سفارش حذف شده باشد یا به حساب دیگری تعلق داشته باشد.
        </p>
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
        >
          <ArrowRightIcon size={14} />
          <span>مشاهده همه سفارش‌ها</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full px-3 py-3 space-y-3 select-none">
      {/* Top Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted">
        <Link
          to="/orders"
          className="hover:text-primary transition-colors flex items-center gap-1"
        >
          <ArrowRightIcon size={14} />
          <span>سفارش‌های من</span>
        </Link>
        <span>/</span>
        <span className="text-foreground font-bold" dir="ltr">
          {formatInvoiceNumber(order)}
        </span>
      </nav>

      {/* Main Order Header Card */}
      <div className="bg-muted/5 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-xs font-bold text-primary flex items-center gap-1.5" dir="ltr">
              <span className="text-primary text-xs font-semibold">فاکتور</span>
              <span>{formatInvoiceNumber(order)}</span>
            </span>
            <Badge variant={statusConfig.color} size="md">
              {displayStatusLabel}
            </Badge>

            {/* 10-Minute Customer Countdown Badge */}
            {!isCancelled && !isCompleted && (
              <span
                className={cn(
                  "px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border-none shadow-none",
                  isWithin10Minutes
                    ? "bg-warning/15 text-warning"
                    : "bg-muted/10 text-muted",
                )}
              >
                <ClockIcon
                  size={20}
                  className={cn(
                    isWithin10Minutes ? "text-warning" : "text-muted",
                  )}
                />
                <span className="inline-flex items-center gap-1.5">
                  <span>
                    به مدت ۱۰ دقیقه وقت دارید سفارش خود را ویرایش یا لغو کنید
                  </span>
                  {isWithin10Minutes ? (
                    <span
                      className="inline-flex items-center gap-0.5 font-bold tracking-wider"
                      dir="ltr"
                    >
                      <Counter
                        value={Math.floor(timeLeftSeconds / 60)}
                        minDigits={2}
                        bounce={0}
                        stagger={0.11}
                        duration={0.6}
                        fontSize={16}
                        fontWeight={700}
                        textColor="currentColor"
                        locale="fa-IR"
                        fade={0.2}
                        tabular
                      />
                      <span className="font-bold -translate-y-[0.5px]">:</span>
                      <Counter
                        value={timeLeftSeconds % 60}
                        minDigits={2}
                        bounce={0}
                        stagger={0.11}
                        duration={0.6}
                        fontSize={13}
                        fontWeight={700}
                        textColor="currentColor"
                        locale="fa-IR"
                        fade={0.2}
                        tabular
                      />
                    </span>
                  ) : (
                    <span>پایان یافت</span>
                  )}
                </span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted">
            تاریخ ثبت سفارش:{" "}
            <strong className="text-foreground">
              {formatPersianDate(order.createdAt || order.date)}
            </strong>
          </p>
        </div>

        {/* Action Buttons - زیر تاریخ */}
        {isCancelled ? (
          <div className="pt-3">
            <div className="w-full py-3 px-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <XIcon size={16} className="shrink-0 text-danger" />
                <span>این سفارش لغو شده است و امکان سفارش مجدد آن وجود ندارد.</span>
              </div>
              {((order as any).cancellationReason || order.notes) && (
                <span className="text-[11px] font-semibold text-danger/80">
                  علت: {(order as any).cancellationReason || order.notes}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-3 flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {isCancellableByCustomer && (
              <>
                <Button
                  type="button"
                  onPress={() => setShowCancelModal(true)}
                  className="flex-1 h-10 px-4 rounded-2xl bg-danger/15 text-danger hover:bg-danger/20 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <XIcon size={16} />
                  <span>لغو سفارش</span>
                </Button>

                <Button
                  type="button"
                  onPress={handleEditOrder}
                  className="flex-1 h-10 px-4 rounded-2xl bg-muted/5 text-foreground hover:bg-muted/15 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <PencilIcon size={16} />
                  <span>ویرایش فاکتور</span>
                </Button>
              </>
            )}

            <Button
              type="button"
              onPress={handleReorder}
              className="flex-1 h-10 px-4 whitespace-nowrap rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCwIcon size={16} />
              <span>سفارش مجدد</span>
            </Button>
          </div>
        )}
      </div>

      {/* Visual Stepper Timeline */}
      <div className="bg-muted/5 rounded-2xl p-5 pb-10 sm:p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-foreground pb-1">
          وضعیت سفارش
        </h3>
        <OrderTimeline steps={timeline} />
      </div>

      {/* Products in this order */}
      <div className="bg-muted/5 rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-foreground pb-1 flex items-center justify-between">
          <span>اقلام سفارش</span>
          <span className="text-xs text-muted font-normal">
            {toPersianDigits(order.items.length)} کالا انتخاب شده
            {(() => {
              const totalArea =
                Math.round(
                  order.items.reduce(
                    (s, i) => s + (i.deliverableArea || i.requestedArea || 0),
                    0,
                  ) * 100,
                ) / 100;
              return totalArea > 0
                ? ` • متراژ کلی: ${toPersianDigits(totalArea)} متر`
                : "";
            })()}
          </span>
        </h3>

        <div className="divide-y divide-separator/50">
          {order.items.map((item: OrderItem, idx: number) => (
            <div
              key={idx}
              className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <Link
                  to="/product"
                  search={{ productname: item.productSlug }}
                  className="relative w-16 h-16 shrink-0 block hover:opacity-90 transition-opacity"
                >
                  <img
                    src={item.productImage || "/assets/images/placeholder.svg"}
                    alt={item.productName}
                    className="w-16 h-16 rounded-2xl object-cover"
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
                </Link>
                <div>
                  <Link
                    to="/product"
                    search={{ productname: item.productSlug }}
                    className="text-sm font-extrabold text-foreground hover:text-primary transition-colors"
                  >
                    {item.productName}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted mt-1">
                    <span>{toPersianDigits(item.dimension)}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    متراژ کلی:{" "}
                    <strong>
                      {toPersianDigits(
                        item.deliverableArea || item.requestedArea,
                      )}
                    </strong>{" "}
                    متر ({toPersianDigits(item.cartonCount)} کارتن)
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="pt-4 space-y-2 text-xs text-muted">
          {order.discountAmount > 0 && (
            <div className="flex justify-between items-center text-success font-semibold">
              <span>تخفیف:</span>
              <span className="inline-flex items-center gap-1">
                <span>- {formatToman(order.discountAmount)}</span>
                <TomanIcon className="size-3.5" />
              </span>
            </div>
          )}

          <div className="pt-2 flex justify-between items-center text-sm font-bold text-foreground">
            <span>مبلغ نهایی:</span>
            <span className="text-base font-bold text-primary inline-flex items-center gap-1">
              <span>{formatToman(order.finalTotal)}</span>
              <TomanIcon className="size-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Delivery Information */}
      <div className="bg-muted/5 rounded-2xl p-5 sm:p-6 space-y-3">
        <h3 className="text-sm font-extrabold text-foreground pb-1">
          اطلاعات تحویل
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-start gap-2.5">
            <StoreIcon size={16} className="text-muted mt-0.5 shrink-0" />
            <div>
              <span className="text-muted block">فروشگاه:</span>
              <span className="font-bold text-foreground">
                {order.storeName}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <PhoneIcon size={16} className="text-muted mt-0.5 shrink-0" />
            <div>
              <span className="text-muted block">تحویل‌گیرنده:</span>
              <span className="font-bold text-foreground">
                {order.customerName} ({toPersianDigits(order.customerPhone)})
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPinIcon size={16} className="text-muted mt-0.5 shrink-0" />
            <div>
              <span className="text-muted block">نشانی تحویل:</span>
              <span className="font-bold text-foreground">
                {order.deliveryAddress}
              </span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="p-3 bg-muted/5 rounded-2xl text-xs text-muted mt-2">
            <strong>یادداشت سفارش:</strong> {order.notes}
          </div>
        )}
      </div>

      {/* HeroUI Cancel Order Confirmation Modal */}
      <HeroUIModal.Root
        isOpen={showCancelModal}
        onOpenChange={(open) => !open && setShowCancelModal(false)}
      >
        <HeroUIModal.Backdrop
          isDismissable
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
        >
          <HeroUIModal.Container className="pointer-events-none w-full max-w-sm h-auto p-0 flex flex-col items-center">
            <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
                <AlertTriangleIcon size={24} />
              </div>
              <div>
                <HeroUIModal.Heading className="text-base font-bold text-foreground">
                  لغو سفارش
                </HeroUIModal.Heading>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  آیا از لغو سفارش{" "}
                  <strong dir="ltr">
                    {formatInvoiceNumber(order)}
                  </strong>{" "}
                  در مهلت ۱۰ دقیقه‌ای اطمینان دارید؟
                </p>
                <div className="mt-2.5 p-2 bg-success/15 rounded-xl text-[11px] text-success text-start">
                  اقلام سفارش به موجودی انبار بازگردانده می‌شوند.
                </div>
              </div>

              {/* Cancellation Reason Selector with HeroUI Dropdown */}
              <div className="text-start space-y-1.5 w-full">
                <label className="text-[11px] font-bold text-foreground block">
                  دلیل لغو:
                </label>
                <Dropdown
                  className="w-full"
                  isOpen={isCancelReasonOpen}
                  onOpenChange={setIsCancelReasonOpen}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between h-11 px-3.5 rounded-2xl bg-muted/5 text-foreground font-semibold text-xs flex items-center cursor-pointer hover:bg-muted/10 transition-colors border-none shadow-none"
                  >
                    <span className="truncate">{cancelReason}</span>
                    <ChevronDownIcon
                      size={16}
                      className={cn(
                        "text-muted transition-transform duration-200 shrink-0 ms-2",
                        isCancelReasonOpen && "rotate-180",
                      )}
                    />
                  </Button>

                  <Dropdown.Popover
                    dir="rtl"
                    placement="bottom"
                    className="w-[var(--trigger-width)] text-right rounded-2xl p-1.5 bg-surface z-60 shadow-xl border border-border/20"
                  >
                    <Dropdown.Menu
                      dir="rtl"
                      className="text-right"
                      selectionMode="single"
                      selectedKeys={new Set([cancelReason])}
                      onAction={(key) => {
                        setCancelReason(String(key));
                        setIsCancelReasonOpen(false);
                      }}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        if (selected) setCancelReason(selected);
                        setIsCancelReasonOpen(false);
                      }}
                    >
                      {CANCELLATION_REASONS.map((reason) => {
                        const isSelected = cancelReason === reason;
                        return (
                          <Dropdown.Item
                            key={reason}
                            id={reason}
                            textValue={reason}
                            className={cn(
                              "rounded-xl w-full px-3 py-2.5 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between text-right w-full",
                              isSelected
                                ? "bg-primary/15 text-primary"
                                : "hover:bg-default/20 text-foreground",
                            )}
                          >
                            <span className="truncate">{reason}</span>
                            {isSelected && (
                              <CheckIcon
                                size={14}
                                className="shrink-0 text-primary ms-2"
                              />
                            )}
                          </Dropdown.Item>
                        );
                      })}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  onPress={() => setShowCancelModal(false)}
                  className="h-10 px-4 rounded-2xl bg-muted/5 text-foreground text-xs font-bold hover:bg-muted/15 cursor-pointer transition-all"
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  onPress={handleCancel}
                  className="h-10 px-4 rounded-2xl bg-danger hover:bg-danger/90 text-danger-foreground text-xs font-bold cursor-pointer transition-all"
                >
                  تأیید لغو سفارش
                </Button>
              </div>
            </HeroUIModal.Dialog>
          </HeroUIModal.Container>
        </HeroUIModal.Backdrop>
      </HeroUIModal.Root>

      {/* Pre-Invoice Modal for Reordering */}
      <PreInvoiceModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        products={reorderProducts}
        quantities={reorderQuantities}
        editOrderId={order?.id}
        onEdit={() => {
          setIsReorderModalOpen(false);
          handleEditOrder();
        }}
        onSuccess={(newOrderId) => {
          setIsReorderModalOpen(false);
          toast.success("سفارش مجدد شما با موفقیت ثبت شد.");
          navigate({
            to: "/orders/$id",
            params: { id: newOrderId },
          });
        }}
      />
    </div>
  );
}
