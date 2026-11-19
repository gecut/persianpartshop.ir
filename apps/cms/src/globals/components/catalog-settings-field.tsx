'use client'
import { useCallback, useRef } from 'react'
import { Banner, Button, useDocumentInfo, useField } from '@payloadcms/ui'
import type { JSONFieldClientComponent } from 'payload'
import {
  CATALOG_PRICE_CHANGE_THRESHOLD,
  CatalogSettingsSchema,
  defaultCatalogSettings,
} from '@persianpart/contract/public-catalog'
import { CatalogCheck, CatalogSection, CatalogText } from './_catalog-controls'
import { CatalogSelection } from './_catalog-selection'
import { CatalogPricingStock } from './_catalog-pricing-stock'
import { CatalogPresentation } from './_catalog-presentation'
import { CatalogContact } from './_catalog-contact'
import { CatalogLocation } from './_catalog-location'
import { CatalogPreview } from './catalog-preview'
import type { CatalogEditorProps, CatalogFormSettings } from './_catalog-form'
import styles from './catalog-settings-field.module.css'

// This virtual field is edited beside the price input, under the original path.
export function CatalogPriceConfirmation() {
  return null
}

export const CatalogSettingsField: JSONFieldClientComponent = ({
  path,
  readOnly,
}) => {
  const validate = useCallback(
    (value: unknown) =>
      CatalogSettingsSchema.safeParse(value).success ||
      'فیلدهای مشخص‌شدهٔ تنظیمات کاتالوگ را اصلاح کنید.',
    [],
  )
  const policy = useField<CatalogFormSettings>({ path, validate })
  const { data } = useDocumentInfo()
  const root = useRef<HTMLDivElement>(null)
  const settings = policy.value ?? defaultCatalogSettings()
  const parsed = CatalogSettingsSchema.safeParse(settings)
  const saved = CatalogSettingsSchema.safeParse(
    data?.policy ?? policy.initialValue,
  )
  const savedPercentage = saved.success ? saved.data.pricing.percentage : 0
  const needsConfirmation =
    settings.pricing.percentage !== null &&
    Number.isFinite(settings.pricing.percentage) &&
    Math.abs(settings.pricing.percentage - savedPercentage) >
      CATALOG_PRICE_CHANGE_THRESHOLD
  const validateConfirmation = useCallback(
    (value: unknown) =>
      !needsConfirmation ||
      value === true ||
      'تغییر بیش از ۱۰ واحد درصد را صریحاً تأیید کنید.',
    [needsConfirmation],
  )
  const confirmation = useField<boolean>({
    path: 'confirmPriceChange',
    validate: validateConfirmation,
  })
  const disabled = !!readOnly || policy.disabled || policy.formProcessing
  const errors: Record<string, string> = {}
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      const message =
        issue.code === 'invalid_type'
          ? 'مقدار معتبر وارد کنید؛ فیلد عددی الزامی را خالی نگذارید.'
          : issue.code === 'too_small' && key === 'pricing.percentage'
            ? 'درصد باید بیشتر از منفی ۱۰۰ باشد.'
            : issue.code === 'too_small'
              ? 'مقدار واردشده کمتر از حد مجاز است یا فیلد الزامی خالی است.'
              : issue.code === 'too_big'
                ? 'مقدار واردشده بیشتر از حد مجاز است.'
                : issue.message
      if (key === 'criteria') {
        errors['criteria.minPrice'] = message
        errors['criteria.maxPrice'] = message
      } else errors[key] = message
    }
  const change: CatalogEditorProps['change'] = (key, value) =>
    policy.setValue({ ...settings, [key]: value })
  const group: CatalogEditorProps['group'] = (key, patch) => {
    if (key === 'pricing' && 'percentage' in patch) confirmation.setValue(false)
    policy.setValue({ ...settings, [key]: { ...settings[key], ...patch } })
  }
  const hasError = (key: string) =>
    Object.keys(errors).some(
      (item) => item === key || item.startsWith(`${key}.`),
    )
  const props: CatalogEditorProps = {
    settings,
    readOnly: disabled,
    change,
    group,
    hasError,
    field: (key) => ({
      path: `${path}.${key}`,
      readOnly: disabled,
      error: errors[key],
    }),
  }
  const confirmationError = confirmation.showError
    ? confirmation.errorMessage
    : undefined
  return (
    <div className={styles.root} dir="rtl" ref={root}>
      <section className={styles.status}>
        <CatalogCheck
          {...props.field('paused')}
          label="کاتالوگ فعال باشد"
          value={!settings.paused}
          onChange={(enabled) => change('paused', !enabled)}
        />
        <p role="status">
          <strong>
            {settings.paused ? 'متوقف در تنظیمات فرم' : 'فعال در تنظیمات فرم'}
          </strong>
        </p>
        {(settings.paused || hasError('pausedMessage')) && (
          <CatalogText
            {...props.field('pausedMessage')}
            label="پیام توقف برای بازدیدکننده"
            multiline
            value={settings.pausedMessage}
            onChange={(message) => change('pausedMessage', message)}
          />
        )}
        <p>
          ذخیره، تنظیمات را اعمال می‌کند. نمایش عمومی ممکن است با تأخیر به‌روز
          شود.
        </p>
        <CatalogLocation />
        <CatalogSection title="دربارهٔ زمان نمایش تغییرات">
          <p>
            صفحات پس از گذشت آستانهٔ ۳۰۰ ثانیه، با درخواست بعدی برای بازسازی
            بررسی می‌شوند؛ این بازه سقف قطعی سن اطلاعات نیست. در خطای بازسازی،
            آخرین نسخهٔ موفق باقی می‌ماند. این رفتار شامل توقف، حذف محصول و
            تغییر قیمت هم می‌شود.
          </p>
        </CatalogSection>
      </section>
      {(!parsed.success || policy.showError || confirmationError) && (
        <Banner type="error">
          <p>
            {!parsed.success
              ? 'پیش از ذخیره، فیلدهای مشخص‌شده را اصلاح کنید.'
              : policy.errorMessage || confirmationError}
          </p>
          <Button
            type="button"
            buttonStyle="secondary"
            size="small"
            onClick={() => {
              const key = Object.keys(errors)[0]
              const container = Array.from(
                root.current?.querySelectorAll<HTMLElement>(
                  '[data-catalog-field]',
                ) ?? [],
              ).find(
                (element) =>
                  element.dataset.catalogField ===
                  (key ? `${path}.${key}` : 'confirmPriceChange'),
              )
              container?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              container
                ?.querySelector<HTMLElement>(
                  'input, textarea, button, [tabindex="0"]',
                )
                ?.focus()
            }}
          >
            رفتن به اولین خطا
          </Button>
        </Banner>
      )}
      <CatalogSelection {...props} />
      <CatalogPricingStock
        {...props}
        savedPercentage={savedPercentage}
        needsConfirmation={needsConfirmation}
        confirmed={!!confirmation.value}
        confirm={confirmation.setValue}
        confirmationError={confirmationError}
      />
      <CatalogPresentation {...props} />
      <CatalogContact {...props} />
      <CatalogPreview
        settings={settings}
        valid={parsed.success}
        readOnly={disabled}
      />
    </div>
  )
}
