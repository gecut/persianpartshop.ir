'use client'
import { useEffect, useRef } from 'react'
import { Button } from '@heroui/react'
import { toPersianDigits } from '@/lib/format'
import type { PublicCatalogPage } from '@persianpart/contract/public-catalog'
import { isDefaultCatalogSearch } from '@/lib/catalog-search'
import { CatalogSkeleton } from '@/components/catalog-skeleton'
import { CatalogContact } from '@/components/catalog-contact'
import { CatalogFilters } from './_catalog-filters'
import { ProductCard } from './_product-card'
import { useCatalogQuery } from './_use-catalog-query'
import { useCatalogRestoration } from './_use-catalog-restoration'

type CatalogViewProps = { initialPage: PublicCatalogPage }

export function CatalogView({ initialPage }: CatalogViewProps) {
  const { search, parsed, query } = useCatalogQuery(initialPage)
  const sentinel = useRef<HTMLDivElement>(null)
  const current = query.data?.pages.at(-1)
  const ready = !parsed.valid || !!current || !!query.error
  useEffect(() => {
    if (ready && window.location.search === search)
      document.documentElement.removeAttribute('data-catalog-filtered')
  }, [ready, search])
  const saveView = useCatalogRestoration({
    state: current?.state,
    search,
    pageCount: query.data?.pages.length ?? 0,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  })
  useEffect(() => {
    const target = sentinel.current
    if (
      !target ||
      !query.hasNextPage ||
      query.isFetching ||
      query.isFetchNextPageError
    )
      return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          void query.fetchNextPage({ cancelRefetch: false })
      },
      { rootMargin: '200px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [
    query.hasNextPage,
    query.isFetching,
    query.isFetchNextPageError,
    query.fetchNextPage,
  ])
  if (!parsed.valid)
    return (
      <section role="alert">
        <h1>نشانی فیلتر معتبر نیست</h1>
        <a href="/">بازگشت به محصولات</a>
      </section>
    )
  const page = current ?? initialPage
  const products =
    query.data?.pages
      .flatMap((item) => item.items)
      .filter(
        (item, index, all) =>
          all.findIndex((product) => product.id === item.id) === index,
      ) ?? []
  return (
    <div className="w-full px-4 py-3 space-y-3 text-start pb-8 bg-background">
      {page.config.introduction && (
        <p className="text-xs text-muted leading-relaxed">
          {page.config.introduction}
        </p>
      )}
      {page.state !== 'paused' && (
        <CatalogFilters input={parsed.input} page={page} search={search} />
      )}
      <div className="catalog-initial-skeleton">
        <CatalogSkeleton />
      </div>
      <div data-catalog-results>
        {!current && !query.error && <CatalogSkeleton />}
        {query.error && !current && (
          <section className="catalog-empty" role="alert">
            <h2>دریافت کاتالوگ ممکن نشد</h2>
            <p>اتصال را بررسی کنید و دوباره تلاش کنید.</p>
            <Button onPress={() => void query.refetch()}>تلاش مجدد</Button>
          </section>
        )}
        {current?.state === 'paused' && (
          <section className="catalog-empty" data-testid="paused">
            <h2>{current.config.pausedMessage}</h2>
          </section>
        )}
        {current?.state === 'active' && (
          <>
            {!products.length && (
              <section className="catalog-empty">
                <h2>
                  {isDefaultCatalogSearch(parsed.input)
                    ? 'هنوز محصولی در کاتالوگ منتشر نشده است'
                    : 'محصولی با این ویژگی‌ها پیدا نشد'}
                </h2>
                {!isDefaultCatalogSearch(parsed.input) && (
                  <a href="/">مشاهدهٔ همهٔ محصولات</a>
                )}
              </section>
            )}
            <div className="catalog-grid flex flex-col gap-2">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  config={page.config}
                  priority={index === 0}
                  onNavigate={saveView}
                />
              ))}
            </div>
            {query.isFetchNextPageError && (
              <p role="alert">دریافت ادامهٔ محصولات ممکن نشد.</p>
            )}
            {query.isRefetchError && (
              <p role="status">
                به‌روزرسانی اطلاعات ممکن نشد؛ اطلاعات قبلی نمایش داده می‌شود.
              </p>
            )}
            {query.hasNextPage && (
              <div ref={sentinel} className="pt-2" aria-label="ادامهٔ محصولات">
                {query.isFetchingNextPage && <CatalogSkeleton />}
                {query.isFetchNextPageError && (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      void query.fetchNextPage({ cancelRefetch: false })
                    }
                  >
                    تلاش مجدد
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {page.config.priceNote && (
        <p className="catalog-price-note">{page.config.priceNote}</p>
      )}
      <CatalogContact config={page.config} />
    </div>
  )
}
