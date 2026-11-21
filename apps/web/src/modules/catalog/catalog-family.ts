import { compareFamilyOrder, type CatalogRecord, type FamilyOrderKey } from '@persianpart/contract'

function size(record: CatalogRecord, key: 'width' | 'height'): number | null {
  const fromDimension = record.dimension && typeof record.dimension === 'object' ? record.dimension[key] : null
  if (typeof fromDimension === 'number') return fromDimension
  return typeof record[key] === 'number' ? record[key] : null
}

const orderKey = (record: CatalogRecord): FamilyOrderKey => ({
  id: record.id,
  name: record.name,
  width: size(record, 'width'),
  height: size(record, 'height'),
  grade: record.grade,
})

export function familyMembers(
  byId: Record<string, CatalogRecord>,
  familyId: number | null | undefined,
): CatalogRecord[] {
  if (familyId == null) return []
  return Object.values(byId)
    .filter((record) => record.familyId === familyId)
    .sort((a, b) => compareFamilyOrder(orderKey(a), orderKey(b)))
}
