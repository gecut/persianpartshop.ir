import type { CatalogSettings, PublicCatalogBrowseInput } from '@persianpart/contract/public-catalog'
import type {
  CatalogPredicate,
  CompiledCatalogPolicy,
} from './catalog-query-types'

export function compilePolicy(
  settings: CatalogSettings,
): CompiledCatalogPolicy {
  const clauses: CompiledCatalogPolicy['clauses'] = []
  const clause = (
    reasonCode: string,
    condition: CatalogPredicate,
  ): CatalogPredicate => {
    clauses.push({ reasonCode, condition })
    return { op: 'ref', code: reasonCode }
  }
  const criteria: CatalogPredicate[] = []
  const c = settings.criteria
  for (const [key, field] of [
    ['productTypes', 'productType'],
    ['brandIds', 'brand'],
    ['dimensionIds', 'dimension'],
    ['colors', 'color'],
    ['grades', 'grade'],
    ['stockStatuses', 'status'],
  ] as const) {
    if (c[key].length)
      criteria.push(
        clause(`FILTER_${field.toUpperCase()}`, {
          op: 'in',
          field,
          values: c[key],
        }),
      )
  }
  if (c.categoryIds.length)
    criteria.push(
      clause('FILTER_CATEGORY', { op: 'categories', ids: c.categoryIds }),
    )
  if (c.tagIds.length)
    criteria.push(
      clause('FILTER_TAGS', { op: 'tags', ids: c.tagIds, mode: c.tagMatch }),
    )
  if (c.minPrice != null || c.maxPrice != null)
    criteria.push(
      clause('FILTER_PRICE', { op: 'price', min: c.minPrice, max: c.maxPrice }),
    )
  if (c.onlyWithImage) criteria.push(clause('FILTER_IMAGE', { op: 'image' }))
  if (c.onlyWithValidPrice)
    criteria.push(clause('FILTER_VALID_PRICE', { op: 'validPrice' }))
  const enabled = clause('ENABLED', { op: 'constant', value: !settings.paused })
  const active = clause('ACTIVE', { op: 'active' })
  const excluded = clause('EXCLUDED', {
    op: 'in',
    field: 'id',
    values: settings.exclusions,
  })
  const added = clause('ADDED', {
    op: 'in',
    field: 'id',
    values: settings.additions,
  })
  const base = clause(
    'BASE',
    settings.base === 'filtered'
      ? { op: 'and', items: criteria }
      : { op: 'constant', value: settings.base === 'all_active' },
  )
  return {
    clauses,
    pricing: settings.pricing,
    condition: {
      op: 'and',
      items: [
        enabled,
        active,
        { op: 'not', item: excluded },
        { op: 'or', items: [added, base] },
      ],
    },
  }
}

export function applyVisitorFilters(
  policy: CompiledCatalogPolicy,
  input: PublicCatalogBrowseInput,
): CompiledCatalogPolicy {
  const clauses = [...policy.clauses]
  const items: CatalogPredicate[] = [policy.condition]
  const add = (reasonCode: string, condition: CatalogPredicate) => {
    clauses.push({ reasonCode, condition })
    items.push({ op: 'ref', code: reasonCode })
  }
  for (const [key, field] of [
    ['brandIds', 'brand'],
    ['dimensionIds', 'dimension'],
    ['colors', 'color'],
    ['grades', 'grade'],
  ] as const) {
    if (input[key].length)
      add(`VISITOR_${field.toUpperCase()}`, {
        op: 'in',
        field,
        values: input[key],
      })
  }
  if (input.categoryIds.length)
    add('VISITOR_CATEGORY', { op: 'categories', ids: input.categoryIds })
  if (input.tagIds.length)
    add('VISITOR_TAGS', { op: 'tags', ids: input.tagIds, mode: 'any' })
  if (input.search) add('VISITOR_SEARCH', { op: 'search', value: input.search })
  if (input.inStock)
    add('VISITOR_STOCK', { op: 'in', field: 'status', values: ['available'] })
  if (input.minPrice != null || input.maxPrice != null)
    add('VISITOR_PRICE', {
      op: 'price',
      min: input.minPrice,
      max: input.maxPrice,
    })
  return { clauses, pricing: policy.pricing, condition: { op: 'and', items } }
}

export function hasEmptyCriteria(settings: CatalogSettings): boolean {
  return Object.entries(settings.criteria).every(
    ([key, value]) =>
      key === 'tagMatch' ||
      value == null ||
      value === false ||
      (Array.isArray(value) && value.length === 0),
  )
}
