import type { CatalogSettings } from '@persianpart/contract/public-catalog'

export type CatalogFormSettings = Omit<CatalogSettings, 'pricing'> & {
  pricing: Omit<CatalogSettings['pricing'], 'percentage'> & {
    percentage: number | null
  }
}
export interface CatalogEditorProps {
  settings: CatalogFormSettings
  readOnly: boolean
  field: (key: string) => { path: string; readOnly: boolean; error?: string }
  hasError: (key: string) => boolean
  change: <K extends keyof CatalogFormSettings>(
    key: K,
    value: CatalogFormSettings[K],
  ) => void
  group: <
    K extends
      'criteria' | 'pricing' | 'stock' | 'presentation' | 'sharing' | 'contact',
  >(
    key: K,
    value: Partial<CatalogFormSettings[K]>,
  ) => void
}
export function countCatalogCriteria(
  criteria: CatalogSettings['criteria'],
  advancedOnly = false,
): number {
  const common = advancedOnly
    ? 0
    : [
        criteria.categoryIds,
        criteria.brandIds,
        criteria.dimensionIds,
        criteria.stockStatuses,
      ].filter((items) => items.length > 0).length
  return (
    common +
    [
      criteria.tagIds,
      criteria.colors,
      criteria.productTypes,
      criteria.grades,
    ].filter((items) => items.length > 0).length +
    Number(criteria.minPrice !== null || criteria.maxPrice !== null) +
    Number(criteria.onlyWithImage) +
    Number(criteria.onlyWithValidPrice)
  )
}
