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

export interface Product {
  id: string
  slug: string
  name: string
  sku: string
  dimensions: ProductDimensions
  dimension: string
  brand: string
  color: string
  grade: 'درجه ۱' | 'درجه ۲' | 'درجه ۳' | 'درجه ۴' | 'صادراتی'
  category:
    | 'پرسلان کف'
    | 'اسلب پرسلان'
    | 'دیوار لوکس'
    | 'نما و محوطه'
    | 'کاشی بین کابینتی و دکوراتیو'
    | 'سرامیک ضد اسید و صنعتی'
    | 'سرویس و حمام ضد آب'
  finalCustomerPricePerSqm: number
  pricePerM2: number
  previousPricePerM2?: number
  discountPercent?: number
  originalPricePerSqm?: number
  discountPlanTitle?: string
  sqmPerCarton: number
  areaPerCarton: number
  piecesPerCarton: number
  tilesPerCarton: number
  cartonWeightKg: number
  inventorySqm: number
  stockCartons: number
  inStock: boolean
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
