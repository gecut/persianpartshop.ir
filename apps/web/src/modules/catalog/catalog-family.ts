import { PRODUCT_GRADE_OPTIONS, type CatalogRecord } from '@persianpart/contract'

const GRADE_INDEX_MAP = new Map<string, number>(
  PRODUCT_GRADE_OPTIONS.map((opt, index) => [opt.value, index]),
)

function getDimensionValue(
  dimension: CatalogRecord['dimension'],
  key: 'width' | 'height',
): number | null {
  if (dimension && typeof dimension === 'object' && typeof dimension[key] === 'number') {
    return dimension[key]
  }
  return null
}

function getWidth(record: CatalogRecord): number | null {
  const dimWidth = getDimensionValue(record.dimension, 'width')
  if (dimWidth != null) return dimWidth
  return typeof record.width === 'number' ? record.width : null
}

function getHeight(record: CatalogRecord): number | null {
  const dimHeight = getDimensionValue(record.dimension, 'height')
  if (dimHeight != null) return dimHeight
  return typeof record.height === 'number' ? record.height : null
}

function compareNullableNumberAsc(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function getGradeRank(grade: string | null | undefined): number {
  if (!grade) return Infinity
  const rank = GRADE_INDEX_MAP.get(grade)
  return rank !== undefined ? rank : Infinity
}

function compareFamilyMembers(a: CatalogRecord, b: CatalogRecord): number {
  const nameDiff = a.name.localeCompare(b.name, 'fa')
  if (nameDiff !== 0) return nameDiff

  const widthDiff = compareNullableNumberAsc(getWidth(a), getWidth(b))
  if (widthDiff !== 0) return widthDiff

  const heightDiff = compareNullableNumberAsc(getHeight(a), getHeight(b))
  if (heightDiff !== 0) return heightDiff

  const gradeRankA = getGradeRank(a.grade)
  const gradeRankB = getGradeRank(b.grade)
  if (gradeRankA !== gradeRankB) return gradeRankA - gradeRankB

  return Number(a.id) - Number(b.id)
}

export function familyMembers(
  byId: Record<string, CatalogRecord>,
  familyId: number | null | undefined,
): CatalogRecord[] {
  if (familyId == null) return []

  const matching: CatalogRecord[] = []
  for (const record of Object.values(byId)) {
    if (record.familyId === familyId) {
      matching.push(record)
    }
  }

  return matching.sort(compareFamilyMembers)
}
