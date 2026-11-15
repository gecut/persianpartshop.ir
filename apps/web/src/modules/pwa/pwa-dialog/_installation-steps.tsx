import type { ReactNode } from 'react'

export function InstallationSteps({ children }: { children: ReactNode }) {
  return (
    <ol className="list-[persian] space-y-2 ps-7 pe-2 text-sm leading-6 text-foreground marker:font-bold marker:text-accent">
      {children}
    </ol>
  )
}
