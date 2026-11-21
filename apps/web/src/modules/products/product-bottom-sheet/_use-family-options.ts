import { useEffect, useMemo } from 'react'
import { useCatalogData, catalogCoordinator } from '@/modules/catalog/catalog-data'
import { mapCatalogProduct } from '@/modules/catalog/catalog-mapper'
import { familyMembers } from '@/modules/catalog/catalog-family'
import type { Product } from '@/modules/catalog/product-types'

export function useFamilyOptions(productId: string | undefined, isOpen: boolean): Product[] {
  const { state } = useCatalogData()
  const familyId = productId ? state.byId[productId]?.familyId : undefined

  const options = useMemo(() => {
    return familyMembers(state.byId, familyId).map(mapCatalogProduct)
  }, [state.byId, familyId])

  useEffect(() => {
    if (isOpen) {
      void catalogCoordinator.resume()
    }
  }, [isOpen, productId])

  return options
}
