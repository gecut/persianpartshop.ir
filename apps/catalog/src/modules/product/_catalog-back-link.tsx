'use client'
import { ArrowLeftIcon } from '@solar-icons/react/linear'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { parseCatalogSearch } from '@/lib/catalog-search'
import { LinkPending } from '@/components/link-pending'

export function CatalogBackLink() {
  const [href, setHref] = useState('/')
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem('catalog:view') ?? 'null',
      )
      if (
        saved &&
        typeof saved === 'object' &&
        'search' in saved &&
        typeof saved.search === 'string' &&
        (!saved.search || saved.search.startsWith('?'))
      ) {
        parseCatalogSearch(saved.search)
        setHref('/' + saved.search)
      }
    } catch {
      /* Direct links and unavailable storage return to the unfiltered catalog. */
    }
  }, [])
  return (
    <Link
      className="relative size-10 shrink-0 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
      href={href}
      prefetch={false}
      aria-label="بازگشت به محصولات"
    >
      <ArrowLeftIcon size={20} />
      <LinkPending />
    </Link>
  )
}
