'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import type { StockBoardResponse } from '@persianpart/contract'
import type { BoardQuery } from '../../_board-query'
import { StockImport } from '../stock-import'
import { BoardFilters, type FilterOption } from './_board-filters'
import { BoardTable } from './_board-table'
import {
  dirtyKey,
  emptyDirty,
  hasDirty,
  inquiryBatches,
  parseAmount,
  setAmount,
  setInquiry,
  type DirtyKey,
  type DirtyState,
} from './_dirty'
import styles from './stock-board.module.css'

const initialQuery: BoardQuery = {
  q: '',
  category: null,
  brand: null,
  filter: 'all',
  page: 1,
  limit: 50,
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null) as { errors?: { message?: string }[]; error?: string } | null
  return data?.errors?.[0]?.message ?? data?.error ?? fallback
}

function buildBoardParams(query: BoardQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.category !== null) params.set('category', String(query.category))
  if (query.brand !== null) params.set('brand', String(query.brand))
  params.set('filter', query.filter)
  params.set('page', String(query.page))
  params.set('limit', String(query.limit))
  return params
}

export function StockBoard() {
  const { config } = useConfig()
  const api = config.routes.api

  const [query, setQuery] = useState<BoardQuery>(initialQuery)
  const [data, setData] = useState<StockBoardResponse | null>(null)
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [brands, setBrands] = useState<FilterOption[]>([])
  const [dirty, setDirty] = useState<DirtyState>(emptyDirty)
  const [failures, setFailures] = useState<Partial<Record<DirtyKey, string>>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  // Revision each numeric edit was based on; a save never silently adopts a newer revision.
  const [baseRevisions, setBaseRevisions] = useState<Partial<Record<DirtyKey, number | null>>>({})

  const dirtyActive = hasDirty(dirty)
  const dirtyCount = Object.keys(dirty.amounts).length + Object.keys(dirty.inquiry).length

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          fetch(`${api}/categories?limit=1000&depth=0&sort=name`),
          fetch(`${api}/brands?limit=1000&depth=0&sort=name`),
        ])
        if (!active) return
        if (catRes.ok) {
          const catData = await catRes.json() as { docs?: FilterOption[] }
          if (active && Array.isArray(catData.docs)) setCategories(catData.docs)
        }
        if (brandRes.ok) {
          const brandData = await brandRes.json() as { docs?: FilterOption[] }
          if (active && Array.isArray(brandData.docs)) setBrands(brandData.docs)
        }
      } catch {
        // Filter dropdowns stay empty if taxonomy fetch fails; board still works.
      }
    })()
    return () => { active = false }
  }, [api])

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      try {
        const params = buildBoardParams(query)
        const response = await fetch(`${api}/warehouse-stock/board?${params.toString()}`, { cache: 'no-store' })
        if (!active) return
        if (!response.ok) {
          const errMsg = await readApiError(response, 'دریافت موجودی انبارها ممکن نشد.')
          if (active) {
            setError(true)
            setMessage(errMsg)
          }
          return
        }
        const boardData = await response.json() as StockBoardResponse
        if (!active) return
        if (boardData.rows.length === 0 && query.page > boardData.totalPages) {
          setQuery({ ...query, page: boardData.totalPages })
          return
        }
        setData(boardData)
      } catch {
        if (active) {
          setError(true)
          setMessage('خطای ارتباط با سرور.')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [api, query, reload])

  useEffect(() => {
    if (!dirtyActive) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirtyActive])

  const handleQueryChange = useCallback((next: BoardQuery): boolean => {
    if (
      next.q === query.q &&
      next.category === query.category &&
      next.brand === query.brand &&
      next.filter === query.filter &&
      next.page === query.page &&
      next.limit === query.limit
    ) {
      return true
    }
    if (busy) return false
    if (dirtyActive && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return false
    }
    setDirty(emptyDirty)
    setBaseRevisions({})
    setFailures({})
    setMessage('')
    setError(false)
    setQuery(next)
    return true
  }, [busy, dirtyActive, query])

  const handleAmountChange = useCallback(
    (productId: number, warehouseId: number, text: string, original: number | null) => {
      const key = dirtyKey(productId, warehouseId)
      const revision = data?.rows.find(row => row.productId === productId)?.cells[String(warehouseId)]?.revision ?? null
      setBaseRevisions(prev => key in prev ? prev : { ...prev, [key]: revision })
      setDirty(prev => setAmount(prev, key, text, original))
      setFailures(prev => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [data],
  )

  const handleInquiryChange = useCallback(
    (productId: number, warehouseId: number, checked: boolean, original: boolean) => {
      const key = dirtyKey(productId, warehouseId)
      setDirty(prev => setInquiry(prev, key, checked, original))
    },
    [],
  )

  const handleBulkInquiry = useCallback(
    (warehouseId: number, enabled: boolean) => {
      if (!data) return
      setDirty(prev => {
        let next = prev
        for (const row of data.rows) {
          const cell = row.cells[String(warehouseId)] ?? null
          const original = cell?.isActive === true
          next = setInquiry(next, dirtyKey(row.productId, warehouseId), enabled, original)
        }
        return next
      })
    },
    [data],
  )

  const handleDiscard = () => {
    setDirty(emptyDirty)
    setBaseRevisions({})
    setFailures({})
    setMessage('')
    setError(false)
  }

  const handleSave = async () => {
    setBusy(true)
    setMessage('')
    setError(false)

    const nextDirty: DirtyState = {
      amounts: { ...dirty.amounts },
      inquiry: { ...dirty.inquiry },
    }
    const nextFailures: Partial<Record<DirtyKey, string>> = {}
    let ok = 0
    let failed = 0

    try {
      for (const batch of inquiryBatches(dirty)) {
        const response = await fetch(`${api}/warehouse-stock/inquiry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        })
        if (!response.ok) {
          const errMsg = await readApiError(response, 'ذخیره تغییرات استعلام ممکن نشد.')
          setDirty(nextDirty)
          setFailures(nextFailures)
          setError(true)
          setMessage(errMsg)
          if (ok > 0) setReload(value => value + 1)
          return
        }
        for (const change of batch.changes) {
          delete nextDirty.inquiry[dirtyKey(change.productId, batch.warehouseId)]
        }
        ok += batch.changes.length
      }

      for (const [rawKey, rawText] of Object.entries(dirty.amounts) as [DirtyKey, string][]) {
        const [productIdText, warehouseIdText] = rawKey.split(':')
        const productId = Number(productIdText)
        const warehouseId = Number(warehouseIdText)
        const amount = parseAmount(rawText)

        if (amount === null) {
          nextFailures[rawKey] = 'مقدار نامعتبر است.'
          failed++
          continue
        }

        try {
          const response = await fetch(`${api}/warehouse-stock/for-product/${productId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              warehouseId,
              revision: baseRevisions[rawKey] ?? null,
              amount,
            }),
          })
          if (response.ok) {
            delete nextDirty.amounts[rawKey]
            ok++
          } else {
            // Drop the edit so the reload shows the current server value; the accountant re-enters it after review.
            nextFailures[rawKey] = `${await readApiError(response, 'ثبت موجودی ممکن نشد.')} (مقدار واردشده: ${rawText})`
            delete nextDirty.amounts[rawKey]
            failed++
          }
        } catch {
          nextFailures[rawKey] = 'خطای ارتباط با سرور.'
          failed++
        }
      }

      setDirty(nextDirty)
      setBaseRevisions(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => key in nextDirty.amounts)))
      setFailures(nextFailures)
      setReload(value => value + 1)
      setError(failed > 0)
      setMessage(`ذخیره شد: ${ok.toLocaleString('fa-IR')}، ناموفق: ${failed.toLocaleString('fa-IR')}`)
    } catch {
      setDirty(nextDirty)
      setFailures(nextFailures)
      setError(true)
      setMessage('خطای ارتباط با سرور.')
      if (ok > 0) setReload(value => value + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div dir="rtl">
      <StockImport onApplied={() => setReload(value => value + 1)} />

      <section className={styles.panel} aria-labelledby="stock-board-title">
        <div className={styles.header}>
          <h2 id="stock-board-title">موجودی انبارها</h2>
          <p>موجودی انبارهای عددی و قابلیت استعلام کالاها را بررسی و ویرایش کنید.</p>
        </div>

        <div className={styles.body}>
          <BoardFilters
            query={query}
            categories={categories}
            brands={brands}
            busy={busy}
            onQueryChange={handleQueryChange}
          />

          {!data ? (
            loading ? (
              <p className={styles.status} role="status">در حال دریافت موجودی…</p>
            ) : (
              <p className={styles.error} role="alert">{message || 'دریافت موجودی انبارها ممکن نشد.'}</p>
            )
          ) : (
            <BoardTable
              data={data}
              dirty={dirty}
              failures={failures}
              busy={busy || loading}
              onAmountChange={handleAmountChange}
              onInquiryChange={handleInquiryChange}
              onBulkInquiry={handleBulkInquiry}
              onPageChange={page => handleQueryChange({ ...query, page })}
            >
              <div className={styles.actionBar}>
                <div className={styles.actionButtons}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!dirtyActive || busy || loading}
                    onClick={() => { void handleSave() }}
                  >
                    ذخیره تغییرات ({dirtyCount.toLocaleString('fa-IR')})
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={!dirtyActive || busy}
                    onClick={handleDiscard}
                  >
                    لغو تغییرات
                  </button>
                </div>
                {(busy || loading || message) && (
                  <p className={error ? styles.error : styles.status} role={error ? 'alert' : 'status'}>
                    {busy ? 'در حال ذخیره تغییرات…' : loading ? 'در حال دریافت موجودی…' : message}
                  </p>
                )}
              </div>
            </BoardTable>
          )}
        </div>
      </section>
    </div>
  )
}
