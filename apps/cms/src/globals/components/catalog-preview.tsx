'use client'
import { useEffect, useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import {
  CatalogPreviewSchema,
  CatalogLocationSchema,
  type CatalogSettings,
} from '@persianpart/contract/public-catalog'
import type { z } from 'zod'
import {
  formatToman,
  formatSquareMeters,
  formatUnit,
} from '../../lib/product-format'
import styles from './catalog-settings-field.module.css'

const reasons: Record<string, string> = {
  ENABLED: 'کاتالوگ فعال است',
  ACTIVE: 'محصول فعال است',
  EXCLUDED: 'در استثناها قرار دارد',
  ADDED: 'دستی افزوده شده',
  BASE: 'عضو مجموعهٔ پایه است',
  FILTER_CATEGORY: 'دسته‌بندی و زیرشاخه‌ها',
  FILTER_BRAND: 'برند',
  FILTER_DIMENSION: 'ابعاد',
  FILTER_COLOR: 'رنگ',
  FILTER_GRADE: 'درجه',
  FILTER_STATUS: 'وضعیت موجودی',
  FILTER_PRODUCTTYPE: 'نوع محصول',
  FILTER_TAGS: 'برچسب‌ها',
  FILTER_PRICE: 'بازهٔ قیمت',
  FILTER_VALID_PRICE: 'قیمت معتبر',
  FILTER_IMAGE: 'تصویر معتبر',
}
export function CatalogPreview({ settings }: { settings: CatalogSettings }) {
  const { config } = useConfig()
  const [productId, setProductId] = useState('')
  const [result, setResult] = useState<z.infer<
    typeof CatalogPreviewSchema
  > | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [location, setLocation] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${config.routes.api}/catalog-location`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        const result = CatalogLocationSchema.safeParse(value)
        if (result.success) setLocation(result.data.url)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [config.routes.api])
  async function preview() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch(`${config.routes.api}/catalog-preview`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          ...(productId ? { productId: Number(productId) } : {}),
        }),
      })
      if (!response.ok) throw new Error('preview')
      setResult(CatalogPreviewSchema.parse(await response.json()))
    } catch {
      setError('پیش‌نمایش دریافت نشد؛ تنظیمات و اتصال سرویس را بررسی کنید.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.section}>
      <h3>پیش‌نمایش تنظیمات ذخیره‌نشده</h3>
      {location && (
        <p>
          <a href={location} target="_blank" rel="noopener noreferrer">
            مشاهدهٔ کاتالوگ
          </a>{' '}
          ·{' '}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(location)
                .catch(() => setError('کپی پیوند ممکن نشد.'))
            }}
          >
            کپی نشانی کاتالوگ
          </button>
        </p>
      )}
      <div className={styles.grid}>
        <label className={styles.field}>
          شناسهٔ محصول برای بررسی علت
          <input
            type="number"
            min="1"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={styles.button}
          disabled={busy}
          onClick={() => void preview()}
        >
          {busy ? 'در حال دریافت…' : 'بررسی و پیش‌نمایش'}
        </button>
      </div>
      <p>
        پیش‌نمایش، تنظیمات را ذخیره نمی‌کند. پس از تغییر فرم دوباره بررسی کنید.
      </p>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>
            محصولات منطبق: {result.matchedCount.toLocaleString('fa-IR')}؛
            منتشرشونده: {result.publishedCount.toLocaleString('fa-IR')}
          </p>
          {result.emptyFilteredIsAll && (
            <p role="status">
              همهٔ معیارها خالی‌اند؛ حالت فیلترشده معادل همهٔ محصولات فعال است.
            </p>
          )}
          <div className={styles.grid}>
            {result.sample.map((product) => (
              <article key={product.id} className={styles.sample}>
                <strong>{product.name}</strong>
                <p>
                  <bdi>{product.sku}</bdi>
                </p>
                {product.price.mode !== 'hidden' && (
                  <p>
                    {product.price.mode === 'amount'
                      ? `${formatToman(product.price.amount)} تومان${product.unit ? ` / ${formatUnit(product.unit)}` : ''}`
                      : 'قیمت اعلام نشده'}
                  </p>
                )}
                {product.stock.mode !== 'hidden' && (
                  <p>
                    {product.stock.mode === 'numeric'
                      ? `${formatSquareMeters(product.stock.quantity)}${product.stock.capped ? '+' : ''} ${product.unit ? formatUnit(product.unit) : ''}؛ `
                      : ''}
                    {
                      {
                        available: 'موجود',
                        inquiry: 'نیازمند استعلام',
                        out_of_stock: 'ناموجود',
                      }[product.stock.status]
                    }
                  </p>
                )}
              </article>
            ))}
          </div>
          {result.explain && (
            <div>
              <h4>
                {result.explain.published
                  ? 'محصول منتشر می‌شود'
                  : 'محصول منتشر نمی‌شود'}
              </h4>
              <p>
                اولویت: غیرفعال ← استثنا ← افزودنی ← مجموعهٔ پایه. شکست فیلتر با
                افزودن دستی قابل عبور است.
              </p>
              <ul>
                {result.explain.clauses.map((clause) => (
                  <li key={clause.reasonCode}>
                    {reasons[clause.reasonCode] || clause.reasonCode}:{' '}
                    {clause.passed ? 'بله' : 'خیر'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {productId && !result.explain && <p>محصولی با این شناسه پیدا نشد.</p>}
        </>
      )}
    </section>
  )
}
