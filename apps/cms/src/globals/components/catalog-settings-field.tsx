'use client'
import { useField } from '@payloadcms/ui'
import { PRODUCT_GRADE_OPTIONS } from '@persianpart/contract'
import { CatalogSettingsSchema, defaultCatalogSettings, type CatalogSettings } from '@persianpart/contract/public-catalog'
import { CatalogRelationPicker } from './catalog-relation-picker'
import { CatalogPreview } from './catalog-preview'
import styles from './catalog-settings-field.module.css'

const sortOptions = [
  ['default', 'نام محصول'],
  ['newest', 'جدیدترین'],
  ['oldest', 'قدیمی‌ترین'],
  ['cheapest', 'ارزان‌ترین'],
  ['expensive', 'گران‌ترین'],
] as const
function Check({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className={styles.check}>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <label className={styles.field}>
      {label}
      <input
        type="number"
        step="any"
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : event.target.valueAsNumber,
          )
        }
      />
    </label>
  )
}
function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className={styles.field}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
function Choices<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: T[]
  choices: readonly (readonly [T, string])[]
  onChange: (value: T[]) => void
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      {choices.map(([key, title]) => (
        <Check
          key={key}
          label={title}
          value={value.includes(key)}
          onChange={(checked) =>
            onChange(
              checked ? [...value, key] : value.filter((item) => item !== key),
            )
          }
        />
      ))}
    </fieldset>
  )
}

export function CatalogSettingsField({
  path,
  readOnly,
}: {
  path: string
  readOnly?: boolean
}) {
  const { value, setValue, errorMessage, showError } =
    useField<CatalogSettings>({ path })
  const parsed = CatalogSettingsSchema.safeParse(value)
  const settings = parsed.success
    ? parsed.data
    : (value ?? defaultCatalogSettings())
  const change = <K extends keyof CatalogSettings>(
    key: K,
    next: CatalogSettings[K],
  ) => setValue({ ...settings, [key]: next })
  const group = <
    K extends
      | 'criteria'
      | 'pricing'
      | 'stock'
      | 'presentation'
      | 'sharing'
      | 'contact',
  >(
    key: K,
    next: Partial<CatalogSettings[K]>,
  ) => change(key, { ...settings[key], ...next })
  return (
    <fieldset className={styles.root} dir="rtl" disabled={readOnly}>
      {showError && <p role="alert">{errorMessage}</p>}
      <section className={styles.section}>
        <h3>انتشار</h3>
        <Check
          label="کاتالوگ متوقف باشد"
          value={settings.paused}
          onChange={(paused) => change('paused', paused)}
        />
        <TextField
          label="پیام توقف"
          value={settings.pausedMessage}
          onChange={(value) => change('pausedMessage', value)}
        />
        <p>
          نشانی کاتالوگ از تنظیمات استقرار خوانده می‌شود. تغییرات صفحات با ISR
          پنج‌دقیقه‌ای اعمال می‌شوند؛ در خطای بازسازی، نسخهٔ موفق قبلی باقی
          می‌ماند.
        </p>
      </section>
      <section className={styles.section}>
        <h3>انتخاب محصولات</h3>
        <label className={styles.field}>
          مجموعهٔ پایه
          <select
            value={settings.base}
            onChange={(event) =>
              change('base', event.target.value as CatalogSettings['base'])
            }
          >
            <option value="none">هیچ محصولی</option>
            <option value="all_active">همهٔ محصولات فعال</option>
            <option value="filtered">محصولات منطبق با معیارها</option>
          </select>
        </label>
        <p>
          افزودنی‌ها معیارها را دور می‌زنند؛ محصول غیرفعال و استثنا هیچ‌گاه
          منتشر نمی‌شوند. فیلترشده با معیارهای خالی یعنی همهٔ محصولات فعال.
        </p>
        <div className={styles.grid}>
          <CatalogRelationPicker
            label="افزودنی‌های دستی"
            collection="products"
            values={settings.additions}
            onChange={(value) => change('additions', value)}
          />
          <CatalogRelationPicker
            label="محصولات مستثنا"
            collection="products"
            values={settings.exclusions}
            onChange={(value) => change('exclusions', value)}
          />
        </div>
      </section>
      <section className={styles.section}>
        <h3>معیارهای مجموعهٔ فیلترشده</h3>
        <p>
          معیارهای متفاوت با «و» و چند انتخاب داخل یک معیار با «یا» ترکیب
          می‌شوند. دستهٔ مادر شامل تمام زیرشاخه‌هاست. معیار خالی محدودیتی ایجاد
          نمی‌کند.
        </p>
        <div className={styles.grid}>
          <CatalogRelationPicker
            label="دسته‌بندی‌ها و زیرشاخه‌ها"
            collection="categories"
            values={settings.criteria.categoryIds}
            onChange={(categoryIds) => group('criteria', { categoryIds })}
          />
          <CatalogRelationPicker
            label="برندها"
            collection="brands"
            values={settings.criteria.brandIds}
            onChange={(brandIds) => group('criteria', { brandIds })}
          />
          <CatalogRelationPicker
            label="ابعاد"
            collection="dimensions"
            values={settings.criteria.dimensionIds}
            onChange={(dimensionIds) => group('criteria', { dimensionIds })}
          />
          <CatalogRelationPicker
            label="برچسب‌ها"
            collection="tags"
            values={settings.criteria.tagIds}
            onChange={(tagIds) => group('criteria', { tagIds })}
          />
          <label className={styles.field}>
            تطبیق برچسب‌ها
            <select
              value={settings.criteria.tagMatch}
              onChange={(event) =>
                group('criteria', {
                  tagMatch: event.target.value as 'any' | 'all',
                })
              }
            >
              <option value="any">حداقل یکی</option>
              <option value="all">همه</option>
            </select>
          </label>
          <TextField
            label="رنگ‌ها؛ جداشده با ویرگول فارسی"
            value={settings.criteria.colors.join('، ')}
            onChange={(value) =>
              group('criteria', {
                colors: value.trim()
                  ? value.split(/[،,]/).map((v) => v.trim())
                  : [],
              })
            }
          />
          <Choices
            label="نوع محصول"
            value={settings.criteria.productTypes}
            choices={[
              ['tile', 'کاشی و سرامیک'],
              ['other', 'سایر اقلام'],
            ]}
            onChange={(productTypes) => group('criteria', { productTypes })}
          />
          <Choices
            label="درجه"
            value={settings.criteria.grades}
            choices={PRODUCT_GRADE_OPTIONS.map(
              (item) => [item.value, item.label] as const,
            )}
            onChange={(grades) => group('criteria', { grades })}
          />
          <Choices
            label="وضعیت موجودی"
            value={settings.criteria.stockStatuses}
            choices={[
              ['available', 'موجود'],
              ['inquiry', 'نیازمند استعلام'],
              ['out_of_stock', 'ناموجود'],
            ]}
            onChange={(stockStatuses) => group('criteria', { stockStatuses })}
          />
          <NumberField
            label="حداقل قیمت نهایی (تومان)"
            value={settings.criteria.minPrice}
            onChange={(minPrice) => group('criteria', { minPrice })}
          />
          <NumberField
            label="حداکثر قیمت نهایی (تومان)"
            value={settings.criteria.maxPrice}
            onChange={(maxPrice) => group('criteria', { maxPrice })}
          />
        </div>
        <Check
          label="فقط دارای تصویر معتبر"
          value={settings.criteria.onlyWithImage}
          onChange={(onlyWithImage) => group('criteria', { onlyWithImage })}
        />
        <Check
          label="فقط دارای قیمت معتبر"
          value={settings.criteria.onlyWithValidPrice}
          onChange={(onlyWithValidPrice) =>
            group('criteria', { onlyWithValidPrice })
          }
        />
      </section>
      <section className={styles.section}>
        <h3>قیمت عمومی</h3>
        <Check
          label="قیمت نمایش داده شود"
          value={settings.pricing.showPrice}
          onChange={(showPrice) => group('pricing', { showPrice })}
        />
        <div className={styles.grid}>
          <NumberField
            label="درصد تعدیل قیمت پایه"
            value={settings.pricing.percentage}
            onChange={(percentage) =>
              group('pricing', { percentage: percentage ?? 0 })
            }
          />
          <label className={styles.field}>
            گام گردکردن (تومان)
            <select
              value={settings.pricing.roundingStep}
              onChange={(event) =>
                group('pricing', {
                  roundingStep: Number(event.target.value) as
                    | 1
                    | 100
                    | 1000
                    | 10000,
                })
              }
            >
              {[1, 100, 1000, 10000].map((step) => (
                <option key={step} value={step}>
                  {step.toLocaleString('fa-IR')}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="یادداشت عمومی قیمت"
            value={settings.pricing.note}
            onChange={(note) => group('pricing', { note })}
          />
        </div>
        <p>
          درصد مشتری اعمال نمی‌شود. قیمت نامعتبر «قیمت اعلام نشده» است. اگر گام
          بزرگ قیمت را صفر کند، مبلغ به تومان صحیح و حداقل یک تومان برمی‌گردد.
        </p>
      </section>
      <section className={styles.section}>
        <h3>موجودی</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            حالت نمایش
            <select
              value={settings.stock.mode}
              onChange={(event) =>
                group('stock', {
                  mode: event.target.value as CatalogSettings['stock']['mode'],
                })
              }
            >
              <option value="status">فقط وضعیت</option>
              <option value="numeric">عددی</option>
              <option value="hidden">کاملاً پنهان</option>
            </select>
          </label>
          <NumberField
            label="سقف انتشار عدد؛ خالی یعنی بدون سقف"
            value={settings.stock.displayCap}
            onChange={(displayCap) => group('stock', { displayCap })}
          />
        </div>
        <p>
          عدد موجودی، بیشترین مقدار یک انبار قطعی فعال است؛ جمع انبارها نیست.
          کاشی برای موجودبودن حداقل یک کارتن کامل نیاز دارد. مقدار واقعی بالاتر
          از سقف به بازدیدکننده ارسال نمی‌شود.
        </p>
      </section>
      <section className={styles.section}>
        <h3>هویت و نمایش</h3>
        <div className={styles.grid}>
          <TextField
            label="عنوان"
            value={settings.presentation.title}
            onChange={(title) => group('presentation', { title })}
          />
          <TextField
            label="معرفی کوتاه"
            value={settings.presentation.introduction}
            onChange={(introduction) => group('presentation', { introduction })}
          />
          <CatalogRelationPicker
            label="تصویر جایگزین"
            collection="media"
            single
            values={
              settings.presentation.fallbackImage
                ? [settings.presentation.fallbackImage]
                : []
            }
            onChange={(values) =>
              group('presentation', { fallbackImage: values[0] ?? null })
            }
          />
          <label className={styles.field}>
            مرتب‌سازی اولیه
            <select
              value={settings.presentation.sort}
              onChange={(event) =>
                group('presentation', {
                  sort: event.target
                    .value as CatalogSettings['presentation']['sort'],
                })
              }
            >
              {sortOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Check
          label="واترمارک برند روی تصاویر نمایش داده شود"
          value={settings.presentation.watermark}
          onChange={(watermark) => group('presentation', { watermark })}
        />
      </section>
      <section className={styles.section}>
        <h3>اشتراک‌گذاری</h3>
        <div className={styles.grid}>
          <TextField
            label="عنوان پیش‌فرض اشتراک"
            value={settings.sharing.title}
            onChange={(title) => group('sharing', { title })}
          />
          <TextField
            label="توضیح پیش‌فرض اشتراک"
            value={settings.sharing.description}
            onChange={(description) => group('sharing', { description })}
          />
          <CatalogRelationPicker
            label="تصویر پیش‌فرض اشتراک"
            collection="media"
            single
            values={settings.sharing.image ? [settings.sharing.image] : []}
            onChange={(values) =>
              group('sharing', { image: values[0] ?? null })
            }
          />
        </div>
      </section>
      <section className={styles.section}>
        <h3>راه‌های ارتباطی</h3>
        <p>ارتباطات در پایین صفحه و بدون بنر سفارش نمایش داده می‌شوند.</p>
        {settings.contact.channels.map((channel, index) => (
          <div className={styles.grid} key={index}>
            <label className={styles.field}>
              نوع
              <select
                value={channel.type}
                onChange={(event) =>
                  group('contact', {
                    channels: settings.contact.channels.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            type: event.target.value as typeof item.type,
                          }
                        : item,
                    ),
                  })
                }
              >
                {[
                  ['phone', 'تلفن'],
                  ['email', 'ایمیل'],
                  ['telegram', 'تلگرام'],
                  ['whatsapp', 'واتساپ'],
                  ['eitaa', 'ایتا'],
                  ['bale', 'بله'],
                  ['website', 'وب‌سایت'],
                ].map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="عنوان"
              value={channel.label}
              onChange={(label) =>
                group('contact', {
                  channels: settings.contact.channels.map((item, i) =>
                    i === index ? { ...item, label } : item,
                  ),
                })
              }
            />
            <TextField
              label="نشانی (https یا tel یا mailto)"
              value={channel.url}
              onChange={(url) =>
                group('contact', {
                  channels: settings.contact.channels.map((item, i) =>
                    i === index ? { ...item, url } : item,
                  ),
                })
              }
            />
            <button
              type="button"
              onClick={() =>
                group('contact', {
                  channels: settings.contact.channels.filter(
                    (_, i) => i !== index,
                  ),
                })
              }
            >
              حذف راه ارتباطی
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={settings.contact.channels.length >= 10}
          onClick={() =>
            group('contact', {
              channels: [
                ...settings.contact.channels,
                { type: 'website', label: '', url: '' },
              ],
            })
          }
        >
          افزودن راه ارتباطی
        </button>
      </section>
      <CatalogPreview settings={settings} />
    </fieldset>
  )
}
