import { Skeleton as HeroUISkeleton } from '@heroui/react'

export { HeroUISkeleton as Skeleton }

export function ProductCardSkeleton({
  viewMode = 'list',
}: {
  viewMode?: 'list' | 'grid-2' | 'grid-3' | 'compact' | 'showcase'
} = {}) {
  if (viewMode === 'grid-2' || viewMode === 'grid-3') {
    return (
      <div className="flex flex-col bg-muted/5 rounded-2xl p-2.5 sm:p-3 space-y-2.5">
        <HeroUISkeleton className="w-full aspect-square rounded-2xl" />
        <div className="space-y-1.5">
          <HeroUISkeleton className="w-16 h-3 rounded-lg" />
          <HeroUISkeleton className="w-4/5 h-4 rounded-lg" />
          <div className="flex gap-1.5 pt-0.5">
            <HeroUISkeleton className="w-12 h-4 rounded-lg" />
            <HeroUISkeleton className="w-12 h-4 rounded-lg" />
          </div>
        </div>
        <div className="pt-2 flex justify-between items-center">
          <HeroUISkeleton className="w-18 h-4 rounded-lg" />
          <HeroUISkeleton className="w-10 h-3 rounded-lg" />
        </div>
      </div>
    )
  }

  if (viewMode === 'compact') {
    return (
      <div className="flex items-center justify-between p-2 sm:px-3 bg-muted/5 rounded-2xl">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <HeroUISkeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl shrink-0" />
          <div className="space-y-1 flex-1 min-w-0">
            <HeroUISkeleton className="w-2/5 h-3.5 rounded-lg" />
            <HeroUISkeleton className="w-1/4 h-2.5 rounded-lg" />
          </div>
        </div>
        <HeroUISkeleton className="w-16 h-4 rounded-lg shrink-0 ms-2" />
      </div>
    )
  }

  if (viewMode === 'showcase') {
    return (
      <div className="flex flex-col bg-muted/5 rounded-2xl p-3 sm:p-3.5 space-y-3">
        <HeroUISkeleton className="w-full aspect-16/10 rounded-2xl" />
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <HeroUISkeleton className="w-24 h-4 rounded-lg" />
            <HeroUISkeleton className="w-16 h-5 rounded-lg" />
          </div>
          <HeroUISkeleton className="w-3/5 h-5 rounded-lg" />
          <HeroUISkeleton className="w-full h-3 rounded-lg" />
        </div>
        <div className="pt-2 flex justify-between items-center">
          <HeroUISkeleton className="w-24 h-5 rounded-lg" />
          <HeroUISkeleton className="w-20 h-7 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
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
  )
}

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
