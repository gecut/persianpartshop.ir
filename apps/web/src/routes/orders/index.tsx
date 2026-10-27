import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@heroui/react";
import { useOrders } from "../../features/orders/order-store";
import {
  ORDER_STATUS_MAP,
  type OrderStatus,
  type Order,
  type Product,
} from "../../types";
import { Badge } from "../../components/ui/badge";
import { formatToman, toPersianDigits } from "../../lib/utils/currency";
import { formatPersianDate } from "../../lib/utils/date";
import { toast } from "../../components/feedback/toast";
import { OrderCardSkeleton } from "../../components/ui/skeleton";
import {
  PackageIcon,
  RefreshCwIcon,
  ArrowLeftIcon,
  TomanIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "../../components/ui/icons";
import { PreInvoiceModal } from "../../features/checkout/pre-invoice-modal";
import { useProducts } from "../../features/products/product-store";

export const Route = createFileRoute("/orders/")({
  component: OrdersListPage,
});

function formatInvoiceNumber(
  order: { id: string | number; orderNumber?: string } | string | number,
): string {
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

const isCancelledStatus = (s: string) =>
  s === "cancel" ||
  s === "cancelled" ||
  s === "cancelled_by_customer" ||
  s === "cancelled_by_admin";

interface OrderCardProps {
  order: Order;
  onReorder: (orderId: string) => void;
}

const OrderCard = React.memo(function OrderCard({
  order,
  onReorder,
}: OrderCardProps) {
  const createdAtMs = order.createdAt
    ? new Date(order.createdAt).getTime()
    : Date.now();
  const is10MinutesPassed = Date.now() >= createdAtMs + 10 * 60 * 1000;

  let dynamicStatusLabel = order.statusLabel;
  let dynamicStatusColor: "primary" | "warning" | "success" | "danger" =
    "warning";

  if (order.status === "pending") {
    if (is10MinutesPassed) {
      dynamicStatusLabel = "در حال بررسی واحد بازرگانی";
      dynamicStatusColor = "warning";
    } else {
      dynamicStatusLabel = "سفارش ثبت شده";
      dynamicStatusColor = "primary";
    }
  } else if (
    order.status === "completed" ||
    order.status === "approve" ||
    order.status === "approved"
  ) {
    dynamicStatusLabel = "تکمیل شده";
    dynamicStatusColor = "success";
  } else if (
    order.status === "cancelled_by_customer" ||
    (isCancelledStatus(order.status) && order.cancelledBy === "customer")
  ) {
    dynamicStatusLabel = "لغو توسط کاربر";
    dynamicStatusColor = "danger";
  } else if (
    order.status === "cancelled_by_admin" ||
    (isCancelledStatus(order.status) && order.cancelledBy === "admin")
  ) {
    dynamicStatusLabel = "لغو توسط ادمین";
    dynamicStatusColor = "danger";
  } else {
    dynamicStatusLabel =
      ORDER_STATUS_MAP[order.status]?.label ||
      order.statusLabel ||
      "در حال بررسی";
    dynamicStatusColor =
      (ORDER_STATUS_MAP[order.status]?.color as any) || "warning";
  }

  const isCancelled = isCancelledStatus(order.status);

  const totalCartons = order.items.reduce((s, i) => s + i.cartonCount, 0);
  const totalArea =
    Math.round(
      order.items.reduce(
        (s, i) => s + (i.deliverableArea || i.requestedArea || 0),
        0,
      ) * 100,
    ) / 100;

  return (
    <div className="p-4 space-y-3 rounded-2xl bg-muted/3 select-none">
      {/* Order Top Bar */}
      <div className="flex items-center justify-between gap-2 pb-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-1.5 rounded-lg bg-muted/5 text-xs font-bold text-foreground flex items-center gap-1"
            dir="ltr"
          >
            <span className="text-muted text-xs font-normal">فاکتور</span>
            <span>{formatInvoiceNumber(order.id)}</span>
          </span>
          <Badge variant={dynamicStatusColor} size="sm">
            {dynamicStatusLabel}
          </Badge>
        </div>

        <span className="text-xs text-muted font-medium">
          {formatPersianDate(order.createdAt || order.date)}
        </span>
      </div>

      <div className="space-y-2 min-w-0">
        {/* Items summary */}
        <div className="flex items-center  justify-between text-xs text-muted">
          <div className="w-full flex flex-wrap items-center justify-start gap-1">
            {order.items.map((item, idx) => (
              <img
                key={idx}
                src={item.productImage || "/assets/images/placeholder.svg"}
                alt={item.productName}
                className="size-13 border border-primary/20 rounded-2xl object-cover shrink-0 select-none"
                title={item.productName}
                loading="lazy"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith("/assets/images/placeholder.svg")) {
                    target.src = "/assets/images/placeholder.svg";
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Scrollable Products Images */}
        <div className="w-full overflow-x-auto py-1 flex items-center gap-2 scrollbar-none overscroll-x-contain touch-pan-x">
          <span className="w-full flex items-center gap-2 font-bold rounded-lg py-3 px-4 bg-foreground text-background text-xs">
            {toPersianDigits(order.items.length)} محصول (
            {toPersianDigits(totalCartons)} کارتن)
            {totalArea > 0 && (
              <span className="text-background/70">
                متراژ کلی:{" "}
                <strong className="text-background/80">
                  {toPersianDigits(totalArea)}
                </strong>{" "}
                متر
              </span>
            )}
          </span>
        </div>

        {/* Financials & Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            <span className="text-xs text-muted block font-medium leading-tight mb-0.5">
              مبلغ کل:
            </span>
            <span className="text-sm font-bold text-foreground inline-flex items-center gap-1">
              <span>{formatToman(order.finalTotal)}</span>
              <TomanIcon className="size-3.5" />
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!isCancelled && (
              <Button
                type="button"
                onPress={() => onReorder(order.id)}
                className="h-10 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                aria-label="سفارش مجدد اقلام"
              >
                <RefreshCwIcon size={13} />
                <span>تکرار</span>
              </Button>
            )}

            <Link
              to="/orders/$id"
              params={{ id: order.id }}
              className="h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
            >
              <span>پیگیری</span>
              <ArrowLeftIcon size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
});

function OrdersListPage() {
  const navigate = useNavigate();
  const { orders, isLoading } = useOrders();
  const { allProducts } = useProducts();
  const [selectedStatusTab, setSelectedStatusTab] = useState<
    "all" | OrderStatus
  >("all");
  const [reorderOrder, setReorderOrder] = useState<Order | null>(null);

  const INITIAL_BATCH_SIZE = 10;
  const BATCH_STEP = 10;
  const LOAD_MORE_DELAY_MS = 300;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDisplayLimit(INITIAL_BATCH_SIZE);
  }, [selectedStatusTab]);

  const filteredOrders =
    selectedStatusTab === "all"
      ? orders
      : selectedStatusTab === "cancel" || selectedStatusTab === "cancelled"
        ? orders.filter((o) => isCancelledStatus(o.status))
        : selectedStatusTab === "completed" ||
            selectedStatusTab === "approve" ||
            selectedStatusTab === "approved"
          ? orders.filter(
              (o) =>
                o.status === "completed" ||
                o.status === "approve" ||
                o.status === "approved",
            )
          : selectedStatusTab === "pending"
            ? orders.filter(
                (o) => o.status === "pending" || o.status === "checking",
              )
            : orders.filter((o) => o.status === selectedStatusTab);

  const displayedOrders = useMemo(() => {
    return filteredOrders.slice(0, displayLimit);
  }, [filteredOrders, displayLimit]);

  const hasMore = displayLimit < filteredOrders.length;

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setDisplayLimit((prev) =>
              Math.min(prev + BATCH_STEP, filteredOrders.length),
            );
            setIsLoadingMore(false);
          }, LOAD_MORE_DELAY_MS);
        }
      },
      {
        rootMargin: "250px",
        threshold: 0.1,
      },
    );

    const currentTarget = observerTargetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, filteredOrders.length]);

  // Reorder data for PreInvoiceModal
  const { reorderProducts, reorderQuantities } = useMemo(() => {
    if (!reorderOrder?.items)
      return { reorderProducts: [], reorderQuantities: {} };
    const products: Product[] = reorderOrder.items.map((item) => {
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
    reorderOrder.items.forEach((item) => {
      quantities[item.productId] = item.requestedArea || item.deliverableArea;
    });
    return { reorderProducts: products, reorderQuantities: quantities };
  }, [reorderOrder?.items, allProducts]);

  const handleReorder = useCallback(
    (orderId: string) => {
      const target = orders.find((o) => o.id === orderId);
      if (target) {
        setReorderOrder(target);
      }
    },
    [orders],
  );

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (listContainerRef.current) {
      setScrollMargin(listContainerRef.current.offsetTop);
    }
  }, [selectedStatusTab]);

  useEffect(() => {
    const handleResize = () => {
      if (listContainerRef.current) {
        setScrollMargin(listContainerRef.current.offsetTop);
      }
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: displayedOrders.length,
    estimateSize: () => 180,
    overscan: 4,
    scrollMargin,
    gap: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= displayedOrders.length - 2 &&
      hasMore &&
      !isLoadingMore
    ) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayLimit((prev) =>
          Math.min(prev + BATCH_STEP, filteredOrders.length),
        );
        setIsLoadingMore(false);
      }, 200);
    }
  }, [
    virtualItems,
    displayedOrders.length,
    hasMore,
    isLoadingMore,
    filteredOrders.length,
  ]);

  const TABS = [
    { key: "all", label: "همه سفارش‌ها", icon: PackageIcon },
    { key: "pending", label: "در حال بررسی", icon: ClockIcon },
    { key: "completed", label: "تکمیل شده", icon: CheckCircle2Icon },
    { key: "cancel", label: "لغو شده", icon: AlertCircleIcon },
  ] as const;

  return (
    <div className="w-full h-full px-3 py-3 space-y-3 select-none">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center  gap-1.5">
          <PackageIcon size={20} className="text-primary" />
          <span>سفارش‌ها</span>
        </h1>
        <p className="text-xs text-muted mt-1">پیگیری وضعیت سفارش‌ها</p>
      </div>

      <div className="flex items-center gap-1.5 w-full">
        {TABS.map((tab) => {
          const isSelected = selectedStatusTab === tab.key;
          const IconComponent = tab.icon;

          return (
            <Button
              key={tab.key}
              type="button"
              onPress={() => setSelectedStatusTab(tab.key as any)}
              className={`h-18 flex-1 aspect-square p-1.5 flex flex-col items-center justify-center gap-1 text-[10.5px] sm:text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 active:scale-95 rounded-2xl ${
                isSelected
                  ? "bg-[#252745] text-background"
                  : "bg-muted/5 text-muted hover:bg-muted/10 hover:text-foreground"
              }`}
            >
              <IconComponent
                size={24}
                className={isSelected ? "text-background" : "text-muted"}
              />
              <span className="truncate">{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-2.5">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-muted/5 rounded-2xl p-8 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-muted/10 text-muted flex items-center justify-center mx-auto">
            <PackageIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-foreground">سفارشی یافت نشد</h3>
          <p className="text-xs text-muted">هنوز سفارشی ثبت نشده است.</p>
        </div>
      ) : (
        <div className="w-full">
          <div
            ref={listContainerRef}
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const order = displayedOrders[virtualRow.index];
              if (!order) return null;

              return (
                <div
                  key={order.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  <OrderCard order={order} onReorder={handleReorder} />
                </div>
              );
            })}
          </div>

          {/* Infinite Scroll Sentinel & Loading Indicator */}
          {hasMore && (
            <div
              ref={observerTargetRef}
              className="py-6 flex flex-col items-center justify-center gap-2 text-muted"
            >
              <RefreshCwIcon className="w-5 h-5 animate-spin text-primary" />
              <span className="text-xs font-medium">
                در حال بارگذاری سفارش‌های بیشتر...
              </span>
            </div>
          )}
        </div>
      )}

      <PreInvoiceModal
        isOpen={Boolean(reorderOrder)}
        onClose={() => setReorderOrder(null)}
        products={reorderProducts}
        quantities={reorderQuantities}
        onSuccess={(newOrderId) => {
          setReorderOrder(null);
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
