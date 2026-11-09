import { DataStatus } from '@/components/feedback/data-status'
import { customerErrorMessage } from '@/lib/utils/error'
import { prepareReorderDraft } from '@/modules/products/selection-store'
import { useState, useMemo } from "react"
import { Link, useNavigate, getRouteApi } from "@tanstack/react-router"


import { useOrderDetail, useCancelOrder, buildFullOrderTimeline } from "@/modules/orders/order-store"
import { ORDER_STATUS_MAP } from "@/modules/orders/order-types"
import { OrderTimeline } from "@/modules/orders/order-timeline"
import { formatPersianDate } from "@/lib/utils/date"
import { toast } from "@/components/feedback/toast"
import { OrderDetailSkeleton } from "@/modules/orders/order-detail-skeleton"
import { ArrowRightIcon } from "@/components/ui/icons"
import { PreInvoiceModal } from "@/modules/checkout/pre-invoice-modal"
import { OrderInvoiceModal } from "@/modules/orders/order-invoice-modal/order-invoice-modal"
import { useCatalogIds } from "@/modules/products/catalog-data"
import { CANCELLATION_REASONS, formatInvoiceNumber } from "./_order-helpers"
import { useCancelCountdown } from "./_use-cancel-countdown"
import { buildReorderDraft } from "./_build-reorder-draft"
import { OrderHeaderCard } from "./_order-header-card"
import { OrderItemsCard } from "./_order-items-card"
import { OrderDeliveryCard } from "./_order-delivery-card"
import { CancelOrderModal } from "./_cancel-order-modal"

const routeApi = getRouteApi('/orders/$id')

export function OrderDetailView() {
  const { orderId } = routeApi.useLoaderData();
  const navigate = useNavigate();

  const detailQuery = useOrderDetail(orderId);
  const order = detailQuery.data ?? null;
  const cancellation = useCancelOrder();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>(
    CANCELLATION_REASONS[0],
  );
  const [isCancelReasonOpen, setIsCancelReasonOpen] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const { data: allProducts } = useCatalogIds(isReorderModalOpen ? order?.items.map(item => item.productId) ?? [] : []);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const detailError = detailQuery.error;
  const detailRefreshing = detailQuery.isFetching;
  const isLoading = detailQuery.isPending;

  const isCancelled =
    order?.status === "cancel" ||
    order?.status === "cancelled" ||
    order?.status === "cancelled_by_customer" ||
    order?.status === "cancelled_by_admin";

  const isCompleted =
    order?.status === "completed" ||
    order?.status === "approved" ||
    order?.status === "approve";


  const timeLeftSeconds = useCancelCountdown(order, isCancelled, isCompleted);

  const isWithin60Minutes = timeLeftSeconds > 0;
  const isCancellableByCustomer =
    !isCancelled && !isCompleted && isWithin60Minutes;

  const createdAtMs = order?.createdAt
    ? new Date(order.createdAt).getTime()
    : Date.now();
  const is60MinutesPassed = Date.now() >= createdAtMs + 60 * 60 * 1000;

  const timeline = useMemo(() => {
    if (!order) return [];
    return buildFullOrderTimeline(
      order,
      formatPersianDate(order.createdAt || order.date),
      is60MinutesPassed,
    );
  }, [order, is60MinutesPassed]);

  const displayStatusLabel = useMemo(() => {
    if (!order) return "";
    if (order.status === "pending") {
      return is60MinutesPassed ? "در حال بررسی واحد بازرگانی" : "سفارش ثبت شده";
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
  }, [order, is60MinutesPassed, isCancelled]);

  const statusConfig = order
    ? {
        label: displayStatusLabel,
        color: isCancelled
          ? ("danger" as const)
          : isCompleted
            ? ("success" as const)
            : is60MinutesPassed
              ? ("warning" as const)
              : ("primary" as const),
      }
    : { label: "", color: "warning" as const };

  // Reorder data for PreInvoiceModal
  const { reorderProducts, reorderQuantities } = useMemo(
    () => buildReorderDraft(order?.items, allProducts),
    [order?.items, allProducts],
  );

  const refreshDetail = async () => { await detailQuery.refetch(); };

  const handleCancel = async () => {
    if (!order) return;
    try {
    await cancellation.mutateAsync({ orderId: order.id, reason: cancelReason });
    setShowCancelModal(false);
    toast.info(
      "سفارش لغو شد",
      `سفارش ${formatInvoiceNumber(order)} با موفقیت لغو شد و موجودی به انبار بازگردانی گردید.`,
    );

    } catch (error) {
      toast.error('لغو سفارش انجام نشد', customerErrorMessage(error, 'دوباره تلاش کنید.'));
    }
  };

  const handleReorder = async () => {
    if (!order || isCancelled) return;
    if (await prepareReorderDraft(order.items)) setIsReorderModalOpen(true);
  };

  if (isLoading) {
    return <OrderDetailSkeleton />;
  }

  if (detailError && !order) return <DataStatus error={detailError} onRetry={() => void detailQuery.refetch()} />;

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
      <DataStatus error={detailError} hasData fetching={detailRefreshing} onRetry={() => void refreshDetail()} />
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

      <OrderHeaderCard
        order={order}
        statusColor={statusConfig.color}
        displayStatusLabel={displayStatusLabel}
        isCancelled={isCancelled}
        isCompleted={isCompleted}
        isWithin60Minutes={isWithin60Minutes}
        timeLeftSeconds={timeLeftSeconds}
        isCancellableByCustomer={isCancellableByCustomer}
        onShowInvoice={() => setShowInvoiceModal(true)}
        onShowCancel={() => setShowCancelModal(true)}
        onReorder={handleReorder}
      />

      {/* Visual Stepper Timeline */}
      <div className="bg-muted/5 rounded-2xl p-5 pb-10 sm:p-6 space-y-4">
        <h3 className="text-sm font-extrabold text-foreground pb-1">
          وضعیت سفارش
        </h3>
        <OrderTimeline steps={timeline} />
      </div>

      <OrderItemsCard order={order} />

      <OrderDeliveryCard order={order} />

      <CancelOrderModal
        order={order}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        cancelReason={cancelReason}
        onCancelReasonChange={setCancelReason}
        isReasonOpen={isCancelReasonOpen}
        onReasonOpenChange={setIsCancelReasonOpen}
        onConfirm={handleCancel}
      />

      {/* Official Printable Pre-Invoice Modal (Not available for cancelled orders) */}
      {!isCancelled && (
        <OrderInvoiceModal
          order={order}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* Pre-Invoice Modal for Reordering */}
      <PreInvoiceModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        products={reorderProducts}
        quantities={reorderQuantities}
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
