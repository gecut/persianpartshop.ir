'use client'

import type { ReactNode } from 'react'
import type { StockBoardResponse } from '@persianpart/contract'
import { dirtyKey, parseAmount, type DirtyKey, type DirtyState } from './_dirty'
import styles from './stock-board.module.css'

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeZone: 'Asia/Tehran',
})

function formatDate(iso: string | null): string | null {
  if (!iso || Number.isNaN(Date.parse(iso))) return null
  return dateFormatter.format(new Date(iso))
}

export function BoardTable({
  data,
  dirty,
  failures,
  busy,
  onAmountChange,
  onInquiryChange,
  onBulkInquiry,
  onPageChange,
  children,
}: {
  data: StockBoardResponse
  dirty: DirtyState
  failures: Partial<Record<DirtyKey, string>>
  busy: boolean
  onAmountChange: (productId: number, warehouseId: number, text: string, original: number | null) => void
  onInquiryChange: (productId: number, warehouseId: number, checked: boolean, original: boolean) => void
  onBulkInquiry: (warehouseId: number, enabled: boolean) => void
  onPageChange: (page: number) => void
  children?: ReactNode
}) {
  return (
    <>
      <div className={styles.tableWrap}>
        {data.rows.length === 0 ? (
          <p className={styles.empty}>کالایی با این شرایط یافت نشد.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>کالا / کد</th>
                <th>قیمت پایه (تومان)</th>
                {data.warehouses.map(warehouse => (
                  <th key={warehouse.id}>
                    <div className={styles.warehouseHeader}>
                      <span>{warehouse.name}</span>
                      <span className={styles.warehouseMode}>
                        {warehouse.stockMode === 'exact' ? 'عددی' : 'استعلامی'}
                      </span>
                      {warehouse.stockMode === 'inquiry' && (
                        <div className={styles.bulkButtons}>
                          <button
                            type="button"
                            className={styles.bulkBtn}
                            disabled={busy}
                            onClick={() => onBulkInquiry(warehouse.id, true)}
                          >
                            همه این صفحه ✓
                          </button>
                          <button
                            type="button"
                            className={styles.bulkBtn}
                            disabled={busy}
                            onClick={() => onBulkInquiry(warehouse.id, false)}
                          >
                            همه این صفحه ✗
                          </button>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={row.productId}>
                  <td>
                    <div className={styles.productCell}>
                      <div className={styles.productTitle}>
                        <span>{row.name}</span>
                        {!row.isActive && <span className={styles.badge}>غیرفعال</span>}
                      </div>
                      <span className={styles.sku}><bdi>{row.sku}</bdi></span>
                    </div>
                  </td>
                  <td className={styles.priceCell}>
                    {row.basePricePerSqm == null ? '—' : row.basePricePerSqm.toLocaleString('fa-IR')}
                  </td>
                  {data.warehouses.map(warehouse => {
                    const cell = row.cells[String(warehouse.id)] ?? null
                    const key = dirtyKey(row.productId, warehouse.id)

                    if (warehouse.stockMode === 'exact') {
                      const original = cell?.amount ?? null
                      const isDirty = Object.prototype.hasOwnProperty.call(dirty.amounts, key)
                      const value = isDirty ? dirty.amounts[key]! : (original == null ? '' : String(original))
                      const parsed = parseAmount(value)
                      const cartonHint =
                        row.productType === 'tile' && row.salesFactor && parsed !== null
                          ? Math.floor(Math.round(parsed * 100) / Math.round(row.salesFactor * 100))
                          : null
                      const inactiveCell = cell !== null && cell.isActive === false
                      const cellError = failures[key]

                      return (
                        <td key={warehouse.id} className={isDirty ? styles.cellDirty : undefined}>
                          <div className={styles.cellStack}>
                            <input
                              type="text"
                              inputMode="decimal"
                              dir="ltr"
                              className={styles.amountInput}
                              value={value}
                              disabled={busy || inactiveCell}
                              title={inactiveCell ? 'ردیف غیرفعال است' : undefined}
                              aria-label={`موجودی ${row.name} در ${warehouse.name}`}
                              onChange={event => onAmountChange(row.productId, warehouse.id, event.target.value, original)}
                            />
                            {cartonHint !== null && (
                              <p className={styles.hintText}>≈ {cartonHint.toLocaleString('fa-IR')} کارتن</p>
                            )}
                            {cellError && (
                              <p className={styles.cellError} role="alert">{cellError}</p>
                            )}
                          </div>
                        </td>
                      )
                    }

                    const original = cell?.isActive === true
                    const isDirty = Object.prototype.hasOwnProperty.call(dirty.inquiry, key)
                    const checked = isDirty ? dirty.inquiry[key]! : original
                    const reportedAt = checked ? formatDate(cell?.lastReportedAt ?? null) : null

                    return (
                      <td key={warehouse.id} className={isDirty ? styles.cellDirty : undefined}>
                        <div className={styles.cellStack}>
                          <label className={styles.inquiryLabel}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy}
                              aria-label={`قابل استعلام بودن ${row.name} در ${warehouse.name}`}
                              onChange={event => onInquiryChange(row.productId, warehouse.id, event.target.checked, original)}
                            />
                            <span>قابل استعلام</span>
                          </label>
                          {reportedAt && <span className={styles.reportedAt}>{reportedAt}</span>}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {children}

      <div className={styles.pager}>
        <span>
          صفحه {data.page.toLocaleString('fa-IR')} از {data.totalPages.toLocaleString('fa-IR')}
        </span>
        <div className={styles.pagerButtons}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy || data.page <= 1}
            onClick={() => onPageChange(data.page - 1)}
          >
            قبلی
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy || data.page >= data.totalPages}
            onClick={() => onPageChange(data.page + 1)}
          >
            بعدی
          </button>
        </div>
      </div>
    </>
  )
}
