import type { ReactNode } from 'react'

interface DialogIntroProps {
  title: string
  children: ReactNode
  statusIcon?: ReactNode
}

export function DialogIntro({ title, children, statusIcon }: DialogIntroProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-surface-secondary p-3">
      <img src="/icon-192.png" alt="" width={40} height={40} className="shrink-0 rounded-xl" />
      <div className="min-w-0 space-y-1">
        <h3 tabIndex={-1} data-pwa-view-heading className="flex items-center gap-1.5 text-sm font-bold leading-6 text-foreground">
          {statusIcon}
          {title}
        </h3>
        <p className="text-xs leading-5 text-muted">{children}</p>
      </div>
    </div>
  )
}
