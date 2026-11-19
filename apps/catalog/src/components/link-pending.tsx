'use client'
import { useLinkStatus } from 'next/link'
export function LinkPending() {
  const { pending } = useLinkStatus()
  return pending ? (
    <span
      className="absolute inset-0 z-10 flex items-center justify-center gap-1 rounded-[inherit] bg-surface/80"
      role="status"
      aria-label="در حال دریافت محصول"
    >
      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
    </span>
  ) : null
}
