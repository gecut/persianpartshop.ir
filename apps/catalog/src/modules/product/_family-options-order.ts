import { compareFamilyOrder } from '@persianpart/contract'
import type { PublicCatalogFamilyOption } from '@persianpart/contract/public-catalog'

export function sortFamilyOptions(
  options: PublicCatalogFamilyOption[],
): PublicCatalogFamilyOption[] {
  return [...options].sort(compareFamilyOrder)
}
