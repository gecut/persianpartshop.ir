import type { TimelineStep } from './order-types'
import { CheckIcon, ClockIcon, XIcon } from '@/components/ui/icons'
import { match, P } from 'ts-pattern'

export interface OrderTimelineProps {
  steps: TimelineStep[]
}

export function OrderTimeline({ steps }: OrderTimelineProps) {
  return (
    <div className="relative flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1

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
              className={`relative z-10 mx-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-muted/20 shrink-0 ${match(step.status)
                .with('completed', () => 'bg-success text-success-foreground')
                .with('current', () => 'bg-primary text-primary-foreground')
                .with('cancelled', () => 'bg-danger text-danger-foreground ring-danger/20')
                .with('pending', () => 'bg-muted/40 text-muted')
                .exhaustive()}`}
            >
              {match(step.status)
                .with('completed', () => <CheckIcon size={13} className="stroke-[3]" />)
                .with('current', () => <ClockIcon size={13} />)
                .with('cancelled', () => <XIcon size={13} className="stroke-[3]" />)
                .with('pending', () => <span className="w-2 h-2 rounded-full bg-surface" />)
                .exhaustive()}
            </div>

            {/* Details Card */}
            <div className="flex-1 min-w-0 pt-0.5 text-start">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-2">
                  <h4
                    className={`text-sm ${match(step.status)
                      .with('current', () => 'text-foreground font-bold')
                      .with('completed', () => 'text-foreground font-semibold')
                      .with('cancelled', () => 'text-danger font-bold')
                      .with('pending', () => 'text-muted font-medium')
                      .exhaustive()}`}
                  >
                    {step.title}
                  </h4>
                  {step.status === 'cancelled' && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-danger/15 text-danger">
                      لغو نهایی
                    </span>
                  )}
                </div>

                {step.timestamp && (
                  <span
                    className={`text-xs font-medium ${
                      step.status === 'current' ? 'text-foreground' : 'text-muted'
                    }`}
                  >
                    {step.timestamp}
                  </span>
                )}
              </div>

              <p
                className={`text-xs leading-relaxed ${match(step.status)
                  .with('cancelled', () => 'text-danger/90 font-medium')
                  .with('current', () => 'text-foreground font-medium')
                  .with(P.union('completed', 'pending'), () => 'text-muted')
                  .exhaustive()}`}
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
