'use client'

import { useEffect, useState } from 'react'
import type { StockBoardFilter } from '@persianpart/contract'
import type { BoardQuery } from '../../_board-query'
import styles from './stock-board.module.css'

export type FilterOption = { id: number; name: string }

const filterOptions: { value: StockBoardFilter; label: string }[] = [
  { value: 'all', label: 'همه' },
  { value: 'in_stock', label: 'موجود در انبار عددی' },
  { value: 'out_of_stock', label: 'ناموجود در انبار عددی' },
  { value: 'inquiry', label: 'قابل استعلام' },
  { value: 'not_inquiry', label: 'غیرقابل استعلام' },
]

const pageSizes: (25 | 50 | 100)[] = [25, 50, 100]

export function BoardFilters({
  query,
  categories,
  brands,
  busy,
  onQueryChange,
}: {
  query: BoardQuery
  categories: readonly FilterOption[]
  brands: readonly FilterOption[]
  busy: boolean
  onQueryChange: (next: BoardQuery) => boolean
}) {
  const [search, setSearch] = useState(query.q)

  useEffect(() => {
    setSearch(query.q)
  }, [query.q])

  useEffect(() => {
    const trimmed = search.trim()
    // While saving, hold the typed text and retry once busy clears instead of reverting it.
    if (trimmed === query.q || busy) return
    const timer = window.setTimeout(() => {
      if (!onQueryChange({ ...query, q: trimmed, page: 1 })) {
        setSearch(query.q)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, query, busy, onQueryChange])

  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span>جستجو (نام یا کد کالا)</span>
        <input
          type="search"
          maxLength={100}
          placeholder="نام یا کد کالا…"
          value={search}
          disabled={busy}
          onChange={event => setSearch(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>دسته‌بندی</span>
        <select
          value={query.category ?? ''}
          disabled={busy}
          onChange={event => {
            const raw = event.target.value
            onQueryChange({ ...query, category: raw ? Number(raw) : null, page: 1 })
          }}
        >
          <option value="">همه دسته‌بندی‌ها</option>
          {categories.map(item => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>برند</span>
        <select
          value={query.brand ?? ''}
          disabled={busy}
          onChange={event => {
            const raw = event.target.value
            onQueryChange({ ...query, brand: raw ? Number(raw) : null, page: 1 })
          }}
        >
          <option value="">همه برندها</option>
          {brands.map(item => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>وضعیت</span>
        <select
          value={query.filter}
          disabled={busy}
          onChange={event => {
            onQueryChange({ ...query, filter: event.target.value as StockBoardFilter, page: 1 })
          }}
        >
          {filterOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className={`${styles.field} ${styles.fieldLimit}`}>
        <span>تعداد در صفحه</span>
        <select
          value={query.limit}
          disabled={busy}
          onChange={event => {
            onQueryChange({ ...query, limit: Number(event.target.value) as 25 | 50 | 100, page: 1 })
          }}
        >
          {pageSizes.map(size => (
            <option key={size} value={size}>{size.toLocaleString('fa-IR')}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
