import { PRODUCT_GRADE_OPTIONS } from '@persianpart/contract'
import type { PublicCatalogFamilyOption } from '@persianpart/contract/public-catalog'

const GRADE_INDEX_MAP = new Map<string, number>(
  PRODUCT_GRADE_OPTIONS.map((opt, index) => [opt.value, index]),
)

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

function compareFamilyOptions(
  a: PublicCatalogFamilyOption,
  b: PublicCatalogFamilyOption,
): number {
  const nameDiff = a.name.localeCompare(b.name, 'fa')
  if (nameDiff !== 0) return nameDiff

  const widthDiff = compareNullableNumberAsc(a.width, b.width)
  if (widthDiff !== 0) return widthDiff

  const heightDiff = compareNullableNumberAsc(a.height, b.height)
  if (heightDiff !== 0) return heightDiff

  const gradeRankA = getGradeRank(a.grade)
  const gradeRankB = getGradeRank(b.grade)
  if (gradeRankA !== gradeRankB) return gradeRankA - gradeRankB

  const numA = Number(a.id)
  const numB = Number(b.id)
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
    return numA - numB
  }

  return a.id.localeCompare(b.id)
}

export function sortFamilyOptions(
  options: PublicCatalogFamilyOption[],
): PublicCatalogFamilyOption[] {
  if (!options || options.length <= 1) {
    return options ? [...options] : []
  }
  return [...options].sort(compareFamilyOptions)
}
