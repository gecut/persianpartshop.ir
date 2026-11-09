import { Skeleton as HeroUISkeleton } from '@heroui/react'

export function OrderCardSkeleton() {
  return (
    <div className="bg-muted/5 rounded-2xl p-3.5 space-y-3">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <HeroUISkeleton className="w-24 h-6 rounded-lg" />
          <HeroUISkeleton className="w-20 h-6 rounded-lg" />
        </div>
        <HeroUISkeleton className="w-20 h-4 rounded-lg" />
      </div>

      {/* Items Thumbnails & Specs */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <HeroUISkeleton className="w-12 h-12 rounded-2xl shrink-0" />
          <HeroUISkeleton className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="ps-1 space-y-1.5 flex-1">
            <HeroUISkeleton className="w-20 h-4 rounded-lg" />
            <HeroUISkeleton className="w-28 h-3.5 rounded-lg" />
          </div>
        </div>

        {/* Financials & Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="space-y-1">
            <HeroUISkeleton className="w-16 h-3 rounded-lg" />
            <HeroUISkeleton className="w-24 h-5 rounded-lg" />
          </div>

          <div className="flex items-center gap-1.5">
            <HeroUISkeleton className="w-14 h-8 rounded-2xl" />
            <HeroUISkeleton className="w-16 h-8 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
