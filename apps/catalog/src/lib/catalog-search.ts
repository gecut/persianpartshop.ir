import {
  PublicCatalogBrowseSchema,
  type PublicCatalogBrowseInput,
} from '@persianpart/contract/public-catalog'

export const catalogSearchKeys = [
  'q',
  'category',
  'brands',
  'dimensions',
  'colors',
  'grades',
  'tags',
  'inStock',
  'minPrice',
  'maxPrice',
  'sort',
] as const
export function parseCatalogSearch(search: string): PublicCatalogBrowseInput {
  const params = new URLSearchParams(search)
  const ids = (key: string) =>
    params.get(key)?.split(',').filter(Boolean).map(Number) ?? []
  const values = (key: string) =>
    params.get(key)?.split(',').filter(Boolean) ?? []
  return PublicCatalogBrowseSchema.parse({
    search: params.get('q') ?? '',
    categoryIds: ids('category'),
    brandIds: ids('brands'),
    dimensionIds: ids('dimensions'),
    colors: values('colors'),
    grades: values('grades'),
    tagIds: ids('tags'),
    inStock: params.get('inStock') === '1',
    minPrice: params.has('minPrice') ? Number(params.get('minPrice')) : null,
    maxPrice: params.has('maxPrice') ? Number(params.get('maxPrice')) : null,
    ...(params.has('sort') ? { sort: params.get('sort') } : {}),
  })
}
export function isDefaultCatalogSearch(
  input: PublicCatalogBrowseInput,
): boolean {
  return (
    !input.search &&
    !input.categoryIds.length &&
    !input.brandIds.length &&
    !input.dimensionIds.length &&
    !input.colors.length &&
    !input.grades.length &&
    !input.tagIds.length &&
    !input.inStock &&
    input.minPrice == null &&
    input.maxPrice == null &&
    !input.sort
  )
}
export function setCatalogSearch(key: string, value: string) {
  const url = new URL(window.location.href)
  if (value) url.searchParams.set(key, value)
  else url.searchParams.delete(key)
  window.history.replaceState(null, '', url.pathname + url.search)
  window.dispatchEvent(new Event('catalog:navigation'))
}
