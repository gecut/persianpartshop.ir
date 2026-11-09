import { useState, useEffect } from "react";
import type { Order } from "@/modules/orders/order-types";

// 60-Minute Countdown Timer calculation (calculated from database timestamp)
const calculateRemainingSeconds = (orderDoc: Order | null) => {
  if (!orderDoc) return 0;
  const deadlineMs = orderDoc.cancellationDeadline
    ? new Date(orderDoc.cancellationDeadline).getTime()
    : orderDoc.createdAt
      ? new Date(orderDoc.createdAt).getTime() + 60 * 60 * 1000
      : 0;
  return Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
};

export function useCancelCountdown(
  order: Order | null,
  isCancelled: boolean,
  isCompleted: boolean,
): number {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);

  useEffect(() => {
    if (!order || isCancelled || isCompleted) {
      setTimeLeftSeconds(0);
      return;
    }

    const updateTimer = () => {
      const remaining = calculateRemainingSeconds(order);
      setTimeLeftSeconds(remaining);
      return remaining;
    };

    updateTimer();

    const timer = setInterval(() => {
      const rem = updateTimer();
      if (rem <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    order?.id,
    order?.createdAt,
    order?.cancellationDeadline,
    isCancelled,
    isCompleted,
    order?.updatedAt,
    order?.status,
  ]);

  return timeLeftSeconds;
}
