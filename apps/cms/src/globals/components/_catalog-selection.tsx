'use client'
import { Banner } from '@payloadcms/ui'
import { CatalogSection, CatalogSelect } from './_catalog-controls'
import { CatalogCriteria } from './_catalog-criteria'
import { CatalogSelectionSummary } from './_catalog-selection-summary'
import { CatalogRelationPicker } from './catalog-relation-picker'
import { countCatalogCriteria, type CatalogEditorProps } from './_catalog-form'
import styles from './catalog-settings-field.module.css'

export function CatalogSelection(props: CatalogEditorProps) {
  const { settings, field, hasError, change } = props
  const exceptions = (
    <div className={styles.grid}>
      <CatalogRelationPicker
        {...field('additions')}
        label={
          settings.base === 'none'
            ? 'محصولات انتخاب‌شدهٔ دستی'
            : 'محصولات اضافه بر انتخاب بالا'
        }
        collection="products"
        values={settings.additions}
        description="این محصولات لازم نیست شرایط بالا را داشته باشند؛ محصول غیرفعال نمایش داده نمی‌شود."
        onChange={(value) => change('additions', value)}
      />
      <CatalogRelationPicker
        {...field('exclusions')}
        label="محصولات حذف‌شده از کاتالوگ"
        collection="products"
        values={settings.exclusions}
        description="این محصولات حتی با انتخاب دستی هم نمایش داده نمی‌شوند."
        onChange={(value) => change('exclusions', value)}
      />
    </div>
  )
  return (
    <CatalogSection
      title="محصولات قابل نمایش"
      open
      hasError={['base', 'criteria', 'additions', 'exclusions'].some(hasError)}
    >
      <CatalogSelectionSummary settings={settings} />
      <CatalogSelect
        {...field('base')}
        label="روش انتخاب محصولات"
        value={settings.base}
        choices={
          [
            ['all_active', 'همهٔ محصولات فعال'],
            ['filtered', 'محصولات فعال با شرایط مشخص'],
            ['none', 'فقط انتخاب دستی'],
          ] as const
        }
        onChange={([base]) => change('base', base)}
      />
      <p>محصول غیرفعال در هیچ حالتی نمایش داده نمی‌شود.</p>
      {settings.base === 'filtered' || hasError('criteria') ? (
        <>
          {countCatalogCriteria(settings.criteria) === 0 && (
            <Banner type="warning">
              شرطی تعیین نکرده‌اید؛ همهٔ محصولات فعال انتخاب می‌شوند.
            </Banner>
          )}
          <CatalogCriteria {...props} />
        </>
      ) : (
        <p>شرایط قبلی حفظ شده‌اند، اما در این روش اعمال نمی‌شوند.</p>
      )}
      {settings.base === 'none' ? (
        exceptions
      ) : (
        <CatalogSection
          title={`استثناهای انتخاب · ${(settings.additions.length + settings.exclusions.length).toLocaleString('fa-IR')} محصول`}
          hasError={hasError('additions') || hasError('exclusions')}
        >
          {exceptions}
        </CatalogSection>
      )}
    </CatalogSection>
  )
}
