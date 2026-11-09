import { Skeleton as HeroUISkeleton } from '@heroui/react'

export function PlanCardSkeleton() {
  return (
    <div className="bg-muted/5 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <HeroUISkeleton className="w-28 h-5 rounded-lg" />
            <HeroUISkeleton className="w-24 h-5 rounded-lg" />
          </div>
          <HeroUISkeleton className="w-48 h-6 rounded-lg" />
        </div>
      </div>
      <HeroUISkeleton className="w-full h-16 rounded-2xl" />
      <div className="pt-2 space-y-2">
        <HeroUISkeleton className="w-32 h-4 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <HeroUISkeleton className="w-full h-14 rounded-2xl" />
          <HeroUISkeleton className="w-full h-14 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
