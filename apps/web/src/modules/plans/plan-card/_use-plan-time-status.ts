import { useMemo } from "react";
import { useNow } from "@/lib/use-now";
import type { Plan } from "@/modules/plans/plan-types"
import { toPersianDigits } from "@/lib/utils/currency";
import { formatPersianDate } from "@/lib/utils/date";

export function usePlanTimeStatus(plan: Plan) {
  // Time & Status computations
  const now = useNow();
  const startTime = plan.startsAt ? new Date(plan.startsAt).getTime() : null;
  const isUpcoming = startTime !== null && !isNaN(startTime) && startTime > now;

  let upcomingDaysText = "";
  if (isUpcoming && startTime) {
    const diffMs = startTime - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

    if (diffDays > 1) {
      upcomingDaysText = `${toPersianDigits(diffDays)} روز دیگر تا شروع این طرح مانده`;
    } else if (diffHours > 1) {
      upcomingDaysText = `${toPersianDigits(diffHours)} ساعت دیگر تا شروع این طرح مانده`;
    } else {
      upcomingDaysText = "کمتر از ۱ ساعت تا شروع این طرح مانده";
    }
  }

  const expireTime = plan.expiresAt ? new Date(plan.expiresAt).getTime() : null;
  const isExpired =
    Boolean(plan.isExpired) ||
    plan.status === "expired" ||
    (expireTime !== null && !isNaN(expireTime) && expireTime <= now);

  const isActive =
    !isExpired &&
    !isUpcoming &&
    (plan.status === "active" || (plan.status === undefined && plan.isActive));

  const remainingDaysText = useMemo(() => {
    if (!expireTime || isExpired) return "";
    const diffMs = expireTime - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (diffDays > 1) {
      return `${toPersianDigits(diffDays)} روز مانده به پایان`;
    }
    if (diffDays === 1) {
      return "۱ روز مانده به پایان";
    }
    if (diffHours > 1) {
      return `${toPersianDigits(diffHours)} ساعت مانده به پایان`;
    }
    return "کمتر از ۱ ساعت مانده به پایان";
  }, [expireTime, isExpired, now]);

  const timeBadgeText = useMemo(() => {
    if (isExpired) {
      return plan.expiresAt
        ? `پایان: ${formatPersianDate(plan.expiresAt)}`
        : "پایان یافته";
    }
    if (isUpcoming) {
      if (startTime) {
        const diffMs = startTime - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        if (diffDays > 1)
          return `${toPersianDigits(diffDays)} روز مانده تا شروع`;
        if (diffDays === 1) return "۱ روز مانده تا شروع";
        if (diffHours > 1)
          return `${toPersianDigits(diffHours)} ساعت مانده تا شروع`;
        return "کمتر از ۱ ساعت تا شروع";
      }
      return plan.startsAt
        ? `شروع: ${formatPersianDate(plan.startsAt)}`
        : "به‌زودی";
    }
    if (remainingDaysText) {
      return remainingDaysText;
    }
    if (plan.expiresAt) {
      return `پایان: ${formatPersianDate(plan.expiresAt)}`;
    }
    return "بدون محدودیت زمانی";
  }, [
    isExpired,
    isUpcoming,
    plan.expiresAt,
    plan.startsAt,
    startTime,
    now,
    remainingDaysText,
  ]);

  const timeBadgeClass = useMemo(() => {
    if (isExpired) return "bg-danger/10 text-danger";
    if (isUpcoming) return "bg-warning/10 text-warning";
    return "bg-primary/10 text-primary";
  }, [isExpired, isUpcoming]);

  return {
    isUpcoming,
    upcomingDaysText,
    isExpired,
    isActive,
    timeBadgeText,
    timeBadgeClass,
  };
}
