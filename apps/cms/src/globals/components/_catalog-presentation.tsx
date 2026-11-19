'use client'
import {
  CatalogCheck,
  CatalogSection,
  CatalogSelect,
  CatalogText,
} from './_catalog-controls'
import { CatalogRelationPicker } from './catalog-relation-picker'
import type { CatalogEditorProps } from './_catalog-form'
import styles from './catalog-settings-field.module.css'

export function CatalogPresentation({
  settings,
  field,
  hasError,
  group,
}: CatalogEditorProps) {
  return (
    <>
      <CatalogSection title="ظاهر کاتالوگ" hasError={hasError('presentation')}>
        <CatalogText
          {...field('presentation.title')}
          label="عنوان کاتالوگ"
          value={settings.presentation.title}
          onChange={(title) => group('presentation', { title })}
        />
        <CatalogText
          {...field('presentation.introduction')}
          label="معرفی کوتاه"
          multiline
          value={settings.presentation.introduction}
          onChange={(introduction) => group('presentation', { introduction })}
        />
        <div className={styles.grid}>
          <CatalogRelationPicker
            {...field('presentation.fallbackImage')}
            label="تصویر جایگزین محصول بدون تصویر"
            collection="media"
            single
            values={
              settings.presentation.fallbackImage
                ? [settings.presentation.fallbackImage]
                : []
            }
            onChange={(ids) =>
              group('presentation', { fallbackImage: ids[0] ?? null })
            }
          />
          <CatalogSelect
            {...field('presentation.sort')}
            label="مرتب‌سازی اولیهٔ محصولات"
            value={settings.presentation.sort}
            choices={
              [
                ['default', 'نام محصول'],
                ['newest', 'جدیدترین'],
                ['oldest', 'قدیمی‌ترین'],
                ['cheapest', 'ارزان‌ترین'],
                ['expensive', 'گران‌ترین'],
              ] as const
            }
            onChange={([sort]) => group('presentation', { sort })}
          />
        </div>
        <CatalogCheck
          {...field('presentation.watermark')}
          label="واترمارک برند روی تصاویر نمایش داده شود"
          value={settings.presentation.watermark}
          onChange={(watermark) => group('presentation', { watermark })}
        />
      </CatalogSection>
      <CatalogSection
        title="پیش‌نمایش لینک در پیام‌رسان‌ها"
        hasError={hasError('sharing')}
      >
        <p>
          این اطلاعات، پیش‌فرض کارت لینک در پیام‌رسان‌ها هستند؛ عنوان و معرفی
          داخل کاتالوگ در بخش «ظاهر کاتالوگ» تنظیم می‌شوند. اطلاعات اختصاصی
          محصول در پیش‌نمایش لینک محصول اولویت دارند.
        </p>
        <CatalogText
          {...field('sharing.title')}
          label="عنوان پیش‌فرض لینک"
          value={settings.sharing.title}
          onChange={(title) => group('sharing', { title })}
        />
        <CatalogText
          {...field('sharing.description')}
          label="توضیح پیش‌فرض لینک"
          multiline
          value={settings.sharing.description}
          onChange={(description) => group('sharing', { description })}
        />
        <CatalogRelationPicker
          {...field('sharing.image')}
          label="تصویر پیش‌فرض لینک"
          collection="media"
          single
          values={settings.sharing.image ? [settings.sharing.image] : []}
          onChange={(ids) => group('sharing', { image: ids[0] ?? null })}
        />
      </CatalogSection>
    </>
  )
}
