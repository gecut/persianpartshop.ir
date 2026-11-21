'use client'
import { useEffect, useState } from 'react'
import { cn } from '@heroui/react'

const REVEAL_DELAY_MS = 2000

export function BuiltBy() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const reveal = () => {
      timer = setTimeout(() => setVisible(true), REVEAL_DELAY_MS)
    }
    if (document.readyState === 'complete') reveal()
    else window.addEventListener('load', reveal, { once: true })
    return () => {
      window.removeEventListener('load', reveal)
      clearTimeout(timer)
    }
  }, [])
  return (
    <a
      href="https://gecut.ir"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="طراحی و توسعه توسط جیکات وب (gecut.ir)"
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 block select-none pb-[env(safe-area-inset-bottom,0px)] bg-linear-to-t from-white/95 to-white/70 backdrop-blur-md backdrop-saturate-150 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#3fb868]/35 to-transparent"
      />
      <span className="h-8 px-4 flex items-center justify-center gap-2.5 text-[10px] leading-none text-foreground/50 transition-colors hover:text-foreground/70">
        <span className="font-medium">طراحی و توسعه توسط</span>
        <img
          src="/assets/images/gecut-web.png"
          alt=""
          width={58}
          height={16}
          className="h-4 w-auto"
        />
        <span className="h-3 w-px bg-foreground/15" aria-hidden="true" />
        <span className="font-medium">راهکارهای نرم‌افزاری سازمانی</span>
      </span>
    </a>
  )
}
