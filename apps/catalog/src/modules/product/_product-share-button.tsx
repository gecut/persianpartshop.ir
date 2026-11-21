'use client'
import { ShareIcon } from '@solar-icons/react/linear'

export function ProductShareButton({ name }: { name: string }) {
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: name, url })
      else await navigator.clipboard.writeText(url)
    } catch {
      /* Dismissing the native share sheet rejects with AbortError. */
    }
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="size-10 shrink-0 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
      aria-label="اشتراک‌گذاری محصول"
    >
      <ShareIcon size={20} />
    </button>
  )
}
