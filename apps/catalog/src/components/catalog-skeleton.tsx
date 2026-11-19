import { Skeleton as HeroUISkeleton } from '@heroui/react'

export function CatalogSkeleton() {
  return (
    <div
      className="flex flex-col gap-2"
      role="status"
      aria-label="در حال دریافت کاتالوگ"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index}>
          <div className="flex flex-row items-center justify-between gap-3 p-2.5 sm:p-3 bg-muted/5 rounded-2xl">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
              <HeroUISkeleton className="size-19 aspect-square rounded-2xl shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                <div className="space-y-1.5">
                  <HeroUISkeleton className="w-14 h-3.5 rounded-md" />
                  <HeroUISkeleton className="w-3/4 h-4.5 rounded-md" />
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <HeroUISkeleton className="w-14 h-5 rounded-xl" />
                  <HeroUISkeleton className="w-12 h-5 rounded-xl" />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between shrink-0 self-stretch p-2 sm:p-2.5 rounded-xl bg-default/35 min-w-[105px]">
              <div className="flex flex-col items-end space-y-1 w-full">
                <HeroUISkeleton className="w-16 h-4 rounded-md" />
              </div>
              <HeroUISkeleton className="w-16 h-6 rounded-lg mt-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
