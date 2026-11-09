

import { cn } from "@heroui/react"
import { ClockIcon } from "@/components/ui/icons"
import { Counter } from "@/components/ui/counter/counter"

interface CancelCountdownBadgeProps {
  isWithin60Minutes: boolean;
  timeLeftSeconds: number;
}

export function CancelCountdownBadge({ isWithin60Minutes, timeLeftSeconds }: CancelCountdownBadgeProps) {
  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border-none shadow-none",
        isWithin60Minutes
          ? "bg-warning/15 text-warning"
          : "bg-muted/10 text-muted",
      )}
    >
      <ClockIcon
        size={20}
        className={cn(
          isWithin60Minutes ? "text-warning" : "text-muted",
        )}
      />
      <span className="inline-flex items-center gap-1.5">
        <span>{isWithin60Minutes ? "مهلت لغو سفارش: " : "مهلت لغو سفارش به پایان رسید"}</span>
        {isWithin60Minutes ? (
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
          ""
        )}
      </span>
    </span>
  );
}
