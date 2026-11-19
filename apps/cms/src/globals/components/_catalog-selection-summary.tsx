'use client'
import { useEffect, useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import { z } from 'zod'
import { countCatalogCriteria, type CatalogFormSettings } from './_catalog-form'

const categoriesSchema = z.object({
  docs: z.array(z.object({ id: z.number(), name: z.string() })),
})
export function CatalogSelectionSummary({
  settings,
}: {
  settings: CatalogFormSettings
}) {
  const { config } = useConfig()
  const [names, setNames] = useState<Record<number, string>>({})
  const ids =
    settings.base === 'filtered'
      ? settings.criteria.categoryIds.slice(0, 3).join(',')
      : ''
  useEffect(() => {
    if (!ids) return
    const controller = new AbortController()
    const query = new URLSearchParams({
      'where[id][in]': ids,
      limit: '3',
      depth: '0',
      'select[name]': 'true',
    })
    void fetch(`${config.routes.api}/categories?${query}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return
        const data = categoriesSchema.parse(await response.json())
        if (!controller.signal.aborted)
          setNames((previous) => ({
            ...previous,
            ...Object.fromEntries(
              data.docs.map((item) => [item.id, item.name]),
            ),
          }))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [ids, config.routes.api])
  const categoryNames = settings.criteria.categoryIds
    .slice(0, 3)
    .map((id) => names[id])
    .filter(Boolean)
  const categories = settings.criteria.categoryIds.length
  const criteria = countCatalogCriteria(settings.criteria)
  const base =
    settings.base === 'none'
      ? 'فقط محصولات انتخاب‌شدهٔ دستی'
      : settings.base === 'all_active' || criteria === 0
        ? 'همهٔ محصولات فعال'
        : categories > 0
          ? `محصولات فعال ${categoryNames.length === Math.min(categories, 3) ? `دستهٔ ${categoryNames.join('، ')}${categories > 3 ? ' و دسته‌های دیگر' : ''}` : 'دسته‌های انتخاب‌شده'} و زیرشاخه‌ها${criteria > 1 ? ' با شرایط دیگر' : ''}`
          : 'محصولات فعال با شرایط مشخص'
  return (
    <p aria-live="polite">
      <strong>خلاصهٔ انتخاب: </strong>
      {base}؛ {settings.additions.length.toLocaleString('fa-IR')} محصول اضافه و{' '}
      {settings.exclusions.length.toLocaleString('fa-IR')} محصول حذف‌شده. این
      خلاصه، شمارش محصولات نیست.
    </p>
  )
}
