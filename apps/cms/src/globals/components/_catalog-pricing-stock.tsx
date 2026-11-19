'use client'
import {
  CatalogCheck,
  CatalogNumber,
  CatalogSection,
  CatalogSelect,
  CatalogText,
} from './_catalog-controls'
import type { CatalogEditorProps } from './_catalog-form'
import styles from './catalog-settings-field.module.css'

export function CatalogPricingStock({
  settings,
  field,
  hasError,
  group,
  savedPercentage,
  needsConfirmation,
  confirmed,
  confirm,
  confirmationError,
}: CatalogEditorProps & {
  savedPercentage: number
  needsConfirmation: boolean
  confirmed: boolean
  confirm: (value: boolean) => void
  confirmationError?: string
}) {
  const stockLabels = {
    status: 'موجودی فقط وضعیتی',
    numeric: 'موجودی عددی',
    hidden: 'موجودی پنهان',
  }
  return (
    <CatalogSection
      title={`قیمت و موجودی · ${settings.pricing.showPrice ? 'قیمت نمایان' : 'قیمت پنهان'} · ${stockLabels[settings.stock.mode]}`}
      hasError={hasError('pricing') || hasError('stock') || !!confirmationError}
    >
      <h3>قیمت عمومی</h3>
      <CatalogCheck
        {...field('pricing.showPrice')}
        label="قیمت نمایش داده شود"
        value={settings.pricing.showPrice}
        onChange={(showPrice) => group('pricing', { showPrice })}
      />
      {!settings.pricing.showPrice && (
        <p>
          قیمت به بازدیدکننده نمایش داده نمی‌شود؛ محاسبهٔ آن همچنان می‌تواند بر
          شرایط انتخاب و بازهٔ قیمت اثر داشته باشد.
        </p>
      )}
      <div className={styles.grid}>
        <CatalogNumber
          {...field('pricing.percentage')}
          label="درصد افزایش یا کاهش قیمت پایه"
          value={settings.pricing.percentage}
          description="۱۰ یعنی افزایش ۱۰٪؛ ‎−۱۰ یعنی کاهش ۱۰٪. درصد مشتری اعمال نمی‌شود."
          onChange={(percentage) => group('pricing', { percentage })}
        />
        <CatalogSelect
          {...field('pricing.roundingStep')}
          label="گردکردن قیمت به نزدیک‌ترین (تومان)"
          value={String(settings.pricing.roundingStep)}
          choices={[1, 100, 1000, 10000].map(
            (step) => [String(step), step.toLocaleString('fa-IR')] as const,
          )}
          onChange={([step]) =>
            group('pricing', {
              roundingStep: Number(step) as 1 | 100 | 1000 | 10000,
            })
          }
        />
      </div>
      {needsConfirmation && (
        <div>
          <p>
            درصد ذخیره‌شده:{' '}
            <bdi>{savedPercentage.toLocaleString('fa-IR')}٪</bdi>؛ درصد جدید:{' '}
            <bdi>{settings.pricing.percentage?.toLocaleString('fa-IR')}٪</bdi>.
          </p>
          <CatalogCheck
            path="confirmPriceChange"
            label="تغییر بیش از ۱۰ واحد درصد را تأیید می‌کنم"
            value={confirmed}
            readOnly={field('pricing.percentage').readOnly}
            error={confirmationError}
            description="این تأیید برای یک ذخیره است؛ با تغییر دوبارهٔ درصد باید دوباره تأیید کنید."
            onChange={confirm}
          />
        </div>
      )}
      <CatalogText
        {...field('pricing.note')}
        label="یادداشت عمومی قیمت"
        multiline
        value={settings.pricing.note}
        onChange={(note) => group('pricing', { note })}
      />
      <h3>موجودی</h3>
      <div className={styles.grid}>
        <CatalogSelect
          {...field('stock.mode')}
          label="نمایش موجودی به بازدیدکننده"
          value={settings.stock.mode}
          choices={
            [
              ['status', 'فقط موجود/ناموجود و استعلام'],
              ['numeric', 'مقدار عددی'],
              ['hidden', 'عدم نمایش موجودی'],
            ] as const
          }
          onChange={([mode]) => group('stock', { mode })}
        />
        {(settings.stock.mode === 'numeric' ||
          hasError('stock.displayCap')) && (
          <CatalogNumber
            {...field('stock.displayCap')}
            label="سقف نمایش مقدار موجودی"
            value={settings.stock.displayCap}
            description="خالی یعنی بدون سقف. سقف ۱۰۰: مقادیر بیشتر به شکل ۱۰۰+ نمایش داده می‌شوند."
            onChange={(displayCap) => group('stock', { displayCap })}
          />
        )}
      </div>
      <CatalogSection title="دربارهٔ محاسبهٔ قیمت و موجودی">
        <p>
          قیمت نامعتبر با «قیمت اعلام نشده» نمایش داده می‌شود. اگر گردکردن قیمت
          را صفر کند، نزدیک‌ترین تومان صحیح با حداقل یک تومان استفاده می‌شود.
        </p>
        <p>
          موجودی از بیشترین مقدار یک انبار قطعی فعال به دست می‌آید؛ موجودی
          انبارها جمع نمی‌شود. کاشی برای موجودبودن حداقل یک کارتن کامل نیاز
          دارد. منبع استعلامی موجودی قطعی نیست.
        </p>
        <p>
          در حالت سقف‌دار، مقدار واقعی بالاتر از سقف برای بازدیدکننده ارسال
          نمی‌شود.
        </p>
      </CatalogSection>
    </CatalogSection>
  )
}
