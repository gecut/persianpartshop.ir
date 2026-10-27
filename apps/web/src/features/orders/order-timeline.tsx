import type { TimelineStep } from '../../types'
import { CheckIcon, ClockIcon, XIcon } from '../../components/ui/icons'

export interface OrderTimelineProps {
  steps: TimelineStep[]
}

export function OrderTimeline({ steps }: OrderTimelineProps) {
  return (
    <div className="relative flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const isCompleted = step.status === 'completed'
        const isCurrent = step.status === 'current'
        const isCancelled = step.status === 'cancelled'

        return (
          <div
            key={step.id}
            className={`relative flex items-start gap-4 ${!isLast ? 'pb-8' : 'pb-1'}`}
          >
            {/* Connecting line to next circle only: strictly connects center-to-center */}
            {!isLast && (
              <div
                className="absolute start-3 -translate-x-1/2 top-3 -bottom-3 w-0.5 bg-border z-0"
                aria-hidden="true"
              />
            )}

            {/* Circle Node */}
            <div
              className={`relative z-10 mx-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-muted/20 shrink-0 ${
                isCompleted
                  ? 'bg-success text-success-foreground'
                  : isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : isCancelled
                  ? 'bg-danger text-danger-foreground ring-danger/20'
                  : 'bg-muted/40 text-muted'
              }`}
            >
              {isCompleted ? (
                <CheckIcon size={13} className="stroke-[3]" />
              ) : isCurrent ? (
                <ClockIcon size={13} />
              ) : isCancelled ? (
                <XIcon size={13} className="stroke-[3]" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-surface" />
              )}
            </div>

            {/* Details Card */}
            <div className="flex-1 min-w-0 pt-0.5 text-start">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-2">
                  <h4
                    className={`text-sm font-bold ${
                      isCurrent
                        ? 'text-foreground font-bold'
                        : isCompleted
                        ? 'text-foreground font-semibold'
                        : isCancelled
                        ? 'text-danger font-bold'
                        : 'text-muted font-medium'
                    }`}
                  >
                    {step.title}
                  </h4>
                  {isCancelled && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-danger/15 text-danger">
                      لغو نهایی
                    </span>
                  )}
                </div>

                {step.timestamp && (
                  <span
                    className={`text-xs font-medium ${
                      isCurrent ? 'text-foreground' : 'text-muted'
                    }`}
                  >
                    {step.timestamp}
                  </span>
                )}
              </div>

              <p
                className={`text-xs leading-relaxed ${
                  isCancelled
                    ? 'text-danger/90 font-medium'
                    : isCurrent
                    ? 'text-foreground font-medium'
                    : 'text-muted'
                }`}
              >
                {step.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

