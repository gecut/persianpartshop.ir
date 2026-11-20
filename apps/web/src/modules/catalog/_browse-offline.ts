import { PRODUCT_GRADE_OPTIONS, type CatalogBrowseInput, type CatalogRecord } from '@persianpart/contract'

const names = new Intl.Collator('fa')

export function browseOffline(records: CatalogRecord[], filters: Omit<CatalogBrowseInput, 'page'>) {
  const search = filters.search.trim().toLowerCase()
  const dimension = filters.dimension?.replace(/x/gi, '×').trim()
  const gradeValues = new Set(PRODUCT_GRADE_OPTIONS.filter(grade => filters.grades.includes(grade.label)).map(grade => String(grade.value)))
  const matches = records.filter(record => {
    const brand = typeof record.brand === 'object' ? record.brand?.name ?? 'پرشین پارت' : 'پرشین پارت'
    const category = typeof record.category === 'object' ? record.category?.name ?? 'عمومی' : 'عمومی'
    const color = record.color || 'استاندارد'
    const tags = record.tags?.flatMap(tag => typeof tag === 'object' && tag.name ? [tag.name] : []) ?? []
    const size = record.productType === 'other'
      ? record.weight && record.weight > 0 ? `${record.weight} کیلوگرم` : ''
      : (typeof record.dimension === 'object' ? record.dimension?.name : undefined) ?? `${record.width ?? 60}×${record.height ?? 120}`
    if (dimension && size !== dimension || filters.category && category !== filters.category) return false
    if (filters.brands.length && !filters.brands.includes(brand) || filters.colors.length && !filters.colors.includes(color)) return false
    if (filters.grades.length && !gradeValues.has(record.grade ?? '') || filters.tags.length && !tags.some(tag => filters.tags.includes(tag))) return false
    if (filters.supplyMode ? !record.hasSupplySource : filters.inStock && !record.matchesInStockFilter) return false
    return !search || [record.name, record.sku, brand, record.color ?? 'استاندارد', size, ...tags]
      .some(value => value?.toLowerCase().includes(search))
  })
  return matches.sort((a, b) => {
    const newest = () => Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.id) - Number(a.id)
    switch (filters.sort) {
      case 'default': return names.compare(a.name, b.name) || Number(a.id) - Number(b.id)
      case 'newest': return newest()
      case 'oldest': return -newest()
      case 'cheapest': return a.finalCustomerPricePerSqm - b.finalCustomerPricePerSqm || newest()
      case 'expensive': return b.finalCustomerPricePerSqm - a.finalCustomerPricePerSqm || newest()
    }
  })
}
