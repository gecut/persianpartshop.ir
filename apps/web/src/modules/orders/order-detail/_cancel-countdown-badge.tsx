import { cn } from "@heroui/react"
import { ClockIcon } from "@/components/ui/icons"
import { Counter } from "@/components/ui/counter/counter"
import { match } from 'ts-pattern'

interface CancelCountdownBadgeProps {
  isWithin60Minutes: boolean;
  timeLeftSeconds: number;
}

export function CancelCountdownBadge({ isWithin60Minutes, timeLeftSeconds }: CancelCountdownBadgeProps) {
  const badgeConfig = match(isWithin60Minutes)
    .with(true, () => ({
      badgeClass: "bg-warning/15 text-warning",
      iconClass: "text-warning",
      text: "مهلت لغو سفارش: ",
    }))
    .with(false, () => ({
      badgeClass: "bg-muted/10 text-muted",
      iconClass: "text-muted",
      text: "مهلت لغو سفارش به پایان رسید",
    }))
    .exhaustive();

  return (
    <span
      className={cn(
        "px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border-none shadow-none",
        badgeConfig.badgeClass,
      )}
    >
      <ClockIcon
        size={20}
        className={badgeConfig.iconClass}
      />
      <span className="inline-flex items-center gap-1.5">
        <span>{badgeConfig.text}</span>
        {isWithin60Minutes && (
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
        )}
      </span>
    </span>
  );
}
