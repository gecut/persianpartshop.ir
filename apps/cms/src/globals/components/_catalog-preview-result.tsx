'use client'
import { Banner } from '@payloadcms/ui'
import type { CatalogPreviewSchema } from '@persianpart/contract/public-catalog'
import type { z } from 'zod'
import {
  formatToman,
  formatSquareMeters,
  formatUnit,
} from '../../lib/product-format'
import { CatalogSection } from './_catalog-controls'
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

export function CatalogPreviewResult({
  result,
  paused,
  productId,
}: {
  result: z.infer<typeof CatalogPreviewSchema>
  paused: boolean
  productId: number | null
}) {
  return (
    <>
      <p>
        <strong>
          محصولات انتخاب‌شده: {result.matchedCount.toLocaleString('fa-IR')}
        </strong>
      </p>
      <p>
        <strong>
          محصولات قابل انتشار با این تنظیمات:{' '}
          {result.publishedCount.toLocaleString('fa-IR')}
        </strong>
      </p>
      {paused && (
        <Banner type="info">
          کاتالوگ در تنظیمات فرم متوقف است؛ به همین دلیل تعداد قابل انتشار صفر
          است. تعداد انتخاب‌شده، ظرفیت انتخاب فعلی را نشان می‌دهد.
        </Banner>
      )}
      {result.emptyFilteredIsAll && (
        <Banner type="warning">
          شرطی تعیین نکرده‌اید؛ همهٔ محصولات فعال انتخاب می‌شوند.
        </Banner>
      )}
      {result.publishedCount === 0 && !paused && (
        <p role="status">محصولی برای نمایش با این تنظیمات انتخاب نشده است.</p>
      )}
      {result.sample.length > 0 && (
        <>
          <h3>نمونهٔ اطلاعات قابل نمایش به بازدیدکننده</h3>
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
                    {product.stock.mode === 'numeric' && (
                      <>
                        <bdi>
                          {formatSquareMeters(product.stock.quantity)}
                          {product.stock.capped ? '+' : ''}
                        </bdi>{' '}
                        {product.unit ? formatUnit(product.unit) : ''}؛{' '}
                      </>
                    )}
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
        </>
      )}
      {result.explain && (
        <>
          <Banner type={result.explain.published ? 'success' : 'info'}>
            {result.explain.published
              ? 'این محصول نمایش داده می‌شود.'
              : 'این محصول نمایش داده نمی‌شود.'}
          </Banner>
          <CatalogSection title="علت این نتیجه">
            <p>
              محصول غیرفعال یا حذف‌شده نمایش داده نمی‌شود. انتخاب دستی، شرایط
              فیلتر را دور می‌زند. «خیر» در یک ردیف به‌تنهایی به معنی رد نهایی
              نیست.
            </p>
            <ul>
              {result.explain.clauses.map((clause) => (
                <li key={clause.reasonCode}>
                  {reasons[clause.reasonCode] || clause.reasonCode}:{' '}
                  {clause.passed ? 'بله' : 'خیر'}
                </li>
              ))}
            </ul>
          </CatalogSection>
        </>
      )}
      {productId && !result.explain && (
        <p role="status">محصولی با این شناسه پیدا نشد.</p>
      )}
    </>
  )
}
