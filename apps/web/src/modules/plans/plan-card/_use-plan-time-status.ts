import { useMemo } from "react";
import { useNow } from "@/lib/use-now";
import type { Plan } from "@/modules/plans/plan-types"
import { toPersianDigits } from "@/lib/utils/currency";
import { formatPersianDate } from "@/lib/utils/date";
import { match, P } from "ts-pattern";

function formatDiffRemaining(diffMs: number, suffix: string): string {
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  return match([diffDays > 1, diffDays === 1, diffHours > 1] as const)
    .with([true, P._, P._], () => `${toPersianDigits(diffDays)} روز ${suffix}`)
    .with([false, true, P._], () => `۱ روز ${suffix}`)
    .with([false, false, true], () => `${toPersianDigits(diffHours)} ساعت ${suffix}`)
    .with([false, false, false], () => `کمتر از ۱ ساعت ${suffix}`)
    .exhaustive();
}

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

    upcomingDaysText = match([diffDays > 1, diffHours > 1] as const)
      .with([true, P._], () => `${toPersianDigits(diffDays)} روز دیگر تا شروع این طرح مانده`)
      .with([false, true], () => `${toPersianDigits(diffHours)} ساعت دیگر تا شروع این طرح مانده`)
      .with([false, false], () => "کمتر از ۱ ساعت تا شروع این طرح مانده")
      .exhaustive();
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
    return formatDiffRemaining(expireTime - now, "مانده به پایان");
  }, [expireTime, isExpired, now]);

  const timeBadgeText = useMemo(() => {
    return match([isExpired, isUpcoming] as const)
      .with([true, P._], () =>
        plan.expiresAt ? `پایان: ${formatPersianDate(plan.expiresAt)}` : "پایان یافته"
      )
      .with([false, true], () => {
        if (startTime) {
          return formatDiffRemaining(startTime - now, "مانده تا شروع");
        }
        return plan.startsAt ? `شروع: ${formatPersianDate(plan.startsAt)}` : "به‌زودی";
      })
      .with([false, false], () => {
        if (remainingDaysText) return remainingDaysText;
        if (plan.expiresAt) return `پایان: ${formatPersianDate(plan.expiresAt)}`;
        return "بدون محدودیت زمانی";
      })
      .exhaustive();
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
    return match([isExpired, isUpcoming] as const)
      .with([true, P._], () => "bg-danger/10 text-danger")
      .with([false, true], () => "bg-warning/10 text-warning")
      .with([false, false], () => "bg-primary/10 text-primary")
      .exhaustive();
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
