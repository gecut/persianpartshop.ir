import { Skeleton as HeroUISkeleton } from '@heroui/react'

export function OrderDetailSkeleton() {
  return (
    <div className="w-full max-w-xl mx-auto px-3 py-3 space-y-3.5">
      {/* Top navigation & badge */}
      <div className="flex items-center justify-between gap-2">
        <HeroUISkeleton className="w-24 h-8 rounded-2xl" />
        <HeroUISkeleton className="w-28 h-6 rounded-lg" />
      </div>

      {/* Header card */}
      <div className="bg-muted/5 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <HeroUISkeleton className="w-32 h-6 rounded-lg" />
          <HeroUISkeleton className="w-20 h-4 rounded-lg" />
        </div>
        <HeroUISkeleton className="w-48 h-4 rounded-lg" />
      </div>

      {/* Timeline card */}
      <div className="bg-muted/5 rounded-2xl p-4 space-y-3">
        <HeroUISkeleton className="w-36 h-5 rounded-lg" />
        <div className="space-y-3 pt-2">
          <HeroUISkeleton className="w-full h-12 rounded-2xl" />
          <HeroUISkeleton className="w-full h-12 rounded-2xl" />
          <HeroUISkeleton className="w-full h-12 rounded-2xl" />
        </div>
      </div>

      {/* Items card */}
      <div className="bg-muted/5 rounded-2xl p-4 space-y-3">
        <HeroUISkeleton className="w-28 h-5 rounded-lg" />
        <div className="space-y-2 pt-1">
          <HeroUISkeleton className="w-full h-16 rounded-2xl" />
          <HeroUISkeleton className="w-full h-16 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
