import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CheckoutActionFooterProps {
  children: ReactNode
  fixed?: boolean
}

/** The footer owns safe-area padding and reserves its measured height in page flow. */
export function CheckoutActionFooter({ children, fixed = false }: CheckoutActionFooterProps) {
  const footer = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    if (!fixed || !footer.current) return
    const element = footer.current
    const measure = () => setHeight(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fixed])

  return <>
    {fixed && <div aria-hidden style={{ blockSize: height }} />}
    <div ref={footer} className={cn(
      'w-full shrink-0 border-t border-border/30 bg-background pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
      fixed && 'fixed inset-x-0 bottom-0 z-40',
    )}>
      {children}
    </div>
  </>
}
