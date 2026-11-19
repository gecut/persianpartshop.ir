'use client'
import { PRODUCT_GRADE_OPTIONS } from '@persianpart/contract'
import {
  CatalogCheck,
  CatalogColors,
  CatalogNumber,
  CatalogSection,
  CatalogSelect,
} from './_catalog-controls'
import { CatalogRelationPicker } from './catalog-relation-picker'
import { countCatalogCriteria, type CatalogEditorProps } from './_catalog-form'
import styles from './catalog-settings-field.module.css'

export function CatalogCriteria({
  settings,
  field,
  hasError,
  group,
}: CatalogEditorProps) {
  const criteria = settings.criteria
  return (
    <>
      <p>
        محصول باید همهٔ شرایط را داشته باشد. چند انتخاب در هر شرط، به معنی
        کافی‌بودن یکی از آن‌هاست؛ شرط خالی محدودیتی ندارد.
      </p>
      <div className={styles.grid}>
        <CatalogRelationPicker
          {...field('criteria.categoryIds')}
          label="دسته‌بندی‌ها"
          collection="categories"
          values={criteria.categoryIds}
          description="انتخاب دسته، زیرشاخه‌های آن را هم شامل می‌شود."
          onChange={(categoryIds) => group('criteria', { categoryIds })}
        />
        <CatalogRelationPicker
          {...field('criteria.brandIds')}
          label="برندها"
          collection="brands"
          values={criteria.brandIds}
          onChange={(brandIds) => group('criteria', { brandIds })}
        />
        <CatalogRelationPicker
          {...field('criteria.dimensionIds')}
          label="ابعاد"
          collection="dimensions"
          values={criteria.dimensionIds}
          onChange={(dimensionIds) => group('criteria', { dimensionIds })}
        />
        <CatalogSelect
          {...field('criteria.stockStatuses')}
          label="وضعیت موجودی"
          multiple
          value={criteria.stockStatuses}
          choices={
            [
              ['available', 'موجود'],
              ['inquiry', 'نیازمند استعلام'],
              ['out_of_stock', 'ناموجود'],
            ] as const
          }
          onChange={(stockStatuses) => group('criteria', { stockStatuses })}
        />
      </div>
      <CatalogSection
        title={`شرایط بیشتر · ${countCatalogCriteria(criteria, true).toLocaleString('fa-IR')} شرط تنظیم‌شده`}
        hasError={[
          'tagIds',
          'tagMatch',
          'colors',
          'productTypes',
          'grades',
          'minPrice',
          'maxPrice',
          'onlyWithImage',
          'onlyWithValidPrice',
        ].some((key) => hasError(`criteria.${key}`))}
      >
        <div className={styles.grid}>
          <CatalogRelationPicker
            {...field('criteria.tagIds')}
            label="برچسب‌ها"
            collection="tags"
            values={criteria.tagIds}
            onChange={(tagIds) => group('criteria', { tagIds })}
          />
          {criteria.tagIds.length > 0 && (
            <CatalogSelect
              {...field('criteria.tagMatch')}
              label="تطبیق برچسب‌ها"
              value={criteria.tagMatch}
              choices={
                [
                  ['any', 'حداقل یکی از برچسب‌ها'],
                  ['all', 'همهٔ برچسب‌ها'],
                ] as const
              }
              onChange={([tagMatch]) => group('criteria', { tagMatch })}
            />
          )}
          <CatalogColors
            {...field('criteria.colors')}
            label="رنگ‌ها"
            value={criteria.colors}
            description="هر رنگ را جداگانه وارد کنید؛ خالی یعنی همهٔ رنگ‌ها."
            onChange={(colors) => group('criteria', { colors })}
          />
          <CatalogSelect
            {...field('criteria.productTypes')}
            label="نوع محصول"
            multiple
            value={criteria.productTypes}
            choices={
              [
                ['tile', 'کاشی و سرامیک'],
                ['other', 'سایر اقلام'],
              ] as const
            }
            onChange={(productTypes) => group('criteria', { productTypes })}
          />
          <CatalogSelect
            {...field('criteria.grades')}
            label="درجه"
            multiple
            value={criteria.grades}
            choices={PRODUCT_GRADE_OPTIONS.map(
              (item) => [item.value, item.label] as const,
            )}
            onChange={(grades) => group('criteria', { grades })}
          />
          <CatalogNumber
            {...field('criteria.minPrice')}
            label="حداقل قیمت نهایی (تومان)"
            value={criteria.minPrice}
            onChange={(minPrice) => group('criteria', { minPrice })}
          />
          <CatalogNumber
            {...field('criteria.maxPrice')}
            label="حداکثر قیمت نهایی (تومان)"
            value={criteria.maxPrice}
            onChange={(maxPrice) => group('criteria', { maxPrice })}
          />
        </div>
        <p>
          بازه بر قیمت نهایی پس از تعدیل و گردکردن اعمال می‌شود؛ خالی یعنی بدون
          محدودیت.
        </p>
        <CatalogCheck
          {...field('criteria.onlyWithImage')}
          label="فقط محصولات دارای تصویر معتبر"
          value={criteria.onlyWithImage}
          onChange={(onlyWithImage) => group('criteria', { onlyWithImage })}
        />
        <CatalogCheck
          {...field('criteria.onlyWithValidPrice')}
          label="فقط محصولات دارای قیمت معتبر"
          value={criteria.onlyWithValidPrice}
          onChange={(onlyWithValidPrice) =>
            group('criteria', { onlyWithValidPrice })
          }
        />
      </CatalogSection>
    </>
  )
}
