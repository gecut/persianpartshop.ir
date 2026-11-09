import type {
  Product as ContractProduct,
  CatalogProduct,
  Category,
  Brand,
  AvailabilityBadge,
} from '@persianpart/contract'

export interface ProductDimensions {
  width: number
  height: number
}

export type ProductType = 'tile' | 'other'

export interface Product {
  id: string
  slug: string
  name: string
  sku: string
  hasScanCode?: boolean
  productType?: ProductType
  dimensions: ProductDimensions
  dimension: string
  brand: string
  color: string
  grade?: string
  category: string
  categoryId?: string | number | null
  unit?: 'bag' | 'bucket' | 'pack' | 'piece' | 'kg' | 'liter' | 'can' | 'branch' | 'box' | 'roll' | 'm2' | string
  secondary_unit?: 'meter' | 'kg' | 'cm' | 'g' | 'm' | string
  secondaryUnit?: 'meter' | 'kg' | 'cm' | 'g' | 'm' | string
  weight?: number
  itemsPerPack?: number
  approxCoverage?: string
  finalCustomerPricePerSqm: number
  pricePerM2: number
  previousPricePerM2?: number
  discountPercent?: number
  originalPricePerSqm?: number
  basePricePerSqm?: number
  discountPlanTitle?: string
  sqmPerCarton: number
  cartonsPerPallet?: number | null
  hasSupplySource?: boolean
  areaPerCarton: number
  piecesPerCarton: number
  tilesPerCarton: number
  cartonWeightKg: number
  inventorySqm: number
  stockCartons: number
  inStock: boolean
  hideExactStock?: boolean
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
  description?: string
  richDescription?: string
  applications: string[]
  tags: string[]
  images: string[]
  gallery: string[]
  createdAt?: string
}

export type {
  ContractProduct,
  CatalogProduct,
  Category,
  Brand,
  AvailabilityBadge,
}
