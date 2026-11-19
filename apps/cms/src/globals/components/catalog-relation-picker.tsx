'use client'
import { useEffect, useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import { z } from 'zod'
import styles from './catalog-settings-field.module.css'

const documents = z.object({
  docs: z.array(
    z.object({
      id: z.number(),
      name: z.string().optional(),
      filename: z.string().nullable().optional(),
      alt: z.string().optional(),
    }),
  ),
})
interface CatalogRelationPickerProps {
  label: string
  collection:
    | 'products'
    | 'categories'
    | 'brands'
    | 'dimensions'
    | 'tags'
    | 'media'
  values: number[]
  onChange: (values: number[]) => void
  single?: boolean
}
export function CatalogRelationPicker({
  label,
  collection,
  values,
  onChange,
  single = false,
}: CatalogRelationPickerProps) {
  const { config } = useConfig()
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<{ id: number; name: string }[]>([])
  const [names, setNames] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const query = new URLSearchParams({
        limit: '50',
        depth: '0',
        sort: collection === 'media' ? '-id' : 'name',
        'select[id]': 'true',
      })
      if (collection === 'media') {
        query.set('select[filename]', 'true')
        query.set('select[alt]', 'true')
      } else query.set('select[name]', 'true')
      if (search.trim())
        query.set(
          `where[${collection === 'media' ? 'filename' : 'name'}][contains]`,
          search.trim(),
        )
      try {
        const response = await fetch(
          `${config.routes.api}/${collection}?${query}`,
          { signal: controller.signal, credentials: 'same-origin' },
        )
        if (!response.ok) throw new Error('lookup')
        const result = documents
          .parse(await response.json())
          .docs.map((doc) => ({
            id: doc.id,
            name: doc.name || doc.alt || doc.filename || String(doc.id),
          }))
        setOptions(result)
        setNames((previous) => ({
          ...previous,
          ...Object.fromEntries(result.map((item) => [item.id, item.name])),
        }))
        setError('')
      } catch {
        if (!controller.signal.aborted) setError('دریافت گزینه‌ها ممکن نشد.')
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [collection, config.routes.api, search])
  const all = [
    ...values
      .filter((id) => !options.some((option) => option.id === id))
      .map((id) => ({ id, name: names[id] || `شناسهٔ ${id}` })),
    ...options,
  ]
  return (
    <label className={styles.field}>
      {label}
      <input
        type="search"
        placeholder="جست‌وجوی نام…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <select
        multiple={!single}
        size={single ? 1 : 5}
        value={single ? String(values[0] ?? '') : values.map(String)}
        onChange={(event) =>
          onChange(
            Array.from(event.currentTarget.selectedOptions)
              .map((option) => Number(option.value))
              .filter((id) => id > 0),
          )
        }
      >
        {single && <option value="">بدون تصویر</option>}
        {all.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <small>۵۰ نتیجهٔ اول؛ برای یافتن موارد دیگر جست‌وجو کنید. {error}</small>
    </label>
  )
}
