import { oc } from '@orpc/contract'
import { openapi } from '@orpc/openapi'
import { z } from 'zod'
import {
  EntityIdSchema,
  PaginationInputSchema,
  SlugSchema,
  StandardErrorDataSchema,
  createPaginatedResponseSchema,
} from './common'

// ============================================================================
// 1. Automotive Spare Parts Schemas
// ============================================================================

export const PartSchema = z.object({
  id: z.string(),
  partNumber: z.string(),
  nameFa: z.string(),
  nameEn: z.string(),
  category: z.string(),
  vehicleBrand: z.string(),
  vehicleModels: z.array(z.string()),
  priceTomans: z.number(),
  stock: z.number(),
  isOriginal: z.boolean(),
})

export type Part = z.infer<typeof PartSchema>

// ============================================================================
// 2. Category Schemas
// ============================================================================

export const CategorySchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1, 'نام دسته‌بندی الزامی است'),
  slug: SlugSchema,
  ordering: z.number().int().default(0),
  parentId: EntityIdSchema.optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type Category = z.infer<typeof CategorySchema>

export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1, 'نام دسته‌بندی الزامی است'),
  slug: SlugSchema,
  ordering: z.number().int().default(0),
  parentId: EntityIdSchema.optional().nullable(),
  isActive: z.boolean().default(true),
})

export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>

export const UpdateCategoryInputSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  ordering: z.number().int().optional(),
  parentId: EntityIdSchema.optional().nullable(),
  isActive: z.boolean().optional(),
})

export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>

// ============================================================================
// 3. Brand Schemas
// ============================================================================

export const BrandSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1, 'نام برند الزامی است'),
  slug: SlugSchema,
  logo: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type Brand = z.infer<typeof BrandSchema>

export const CreateBrandInputSchema = z.object({
  name: z.string().min(1, 'نام برند الزامی است'),
  slug: SlugSchema,
  logo: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export type CreateBrandInput = z.infer<typeof CreateBrandInputSchema>

export const UpdateBrandInputSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  logo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export type UpdateBrandInput = z.infer<typeof UpdateBrandInputSchema>

// ============================================================================
// 4. Tag Schemas
// ============================================================================

export const TagSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1, 'نام تگ الزامی است'),
  slug: SlugSchema,
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type Tag = z.infer<typeof TagSchema>

export const CreateTagInputSchema = z.object({
  name: z.string().min(1, 'نام تگ الزامی است'),
  slug: SlugSchema,
  isActive: z.boolean().default(true),
})

export type CreateTagInput = z.infer<typeof CreateTagInputSchema>

export const UpdateTagInputSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  isActive: z.boolean().optional(),
})

export type UpdateTagInput = z.infer<typeof UpdateTagInputSchema>

// ============================================================================
// 4.5 Dimension Schemas
// ============================================================================

export const DimensionSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1, 'عنوان بعد الزامی است'),
  width: z.number().positive('عرض باید عددی مثبت باشد'),
  height: z.number().positive('طول باید عددی مثبت باشد'),
  slug: SlugSchema,
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type Dimension = z.infer<typeof DimensionSchema>

export const CreateDimensionInputSchema = z.object({
  name: z.string().min(1, 'عنوان بعد الزامی است'),
  width: z.number().positive('عرض باید عددی مثبت باشد'),
  height: z.number().positive('طول باید عددی مثبت باشد'),
  slug: SlugSchema,
  isActive: z.boolean().default(true),
})

export type CreateDimensionInput = z.infer<typeof CreateDimensionInputSchema>

export const UpdateDimensionInputSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  slug: SlugSchema.optional(),
  isActive: z.boolean().optional(),
})

export type UpdateDimensionInput = z.infer<typeof UpdateDimensionInputSchema>

// ============================================================================
// 5. Product Specifications & Quality Schemas
// ============================================================================

export const ProductDimensionsSchema = z.object({
  width: z.number().positive('عرض باید عددی مثبت باشد'),
  height: z.number().positive('طول باید عددی مثبت باشد'),
})

export type ProductDimensions = z.infer<typeof ProductDimensionsSchema>

export const ProductCompletenessSchema = z.object({
  score: z.number().int().min(0).max(100),
  isComplete: z.boolean(),
  missingCritical: z.array(z.string()),
  missingRecommended: z.array(z.string()),
})

export type ProductCompleteness = z.infer<typeof ProductCompletenessSchema>

export const ProductSchema = z.object({
  id: EntityIdSchema,
  sku: z.string().trim().min(1, 'کد کالا (SKU) الزامی است'),
  name: z.string().trim().min(1, 'نام کالا الزامی است'),
  slug: SlugSchema,

  categoryId: EntityIdSchema.optional().nullable(),
  brandId: EntityIdSchema.optional().nullable(),

  color: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),

  width: z.number().positive('عرض کاشی (cm) الزامی است'),
  height: z.number().positive('طول کاشی (cm) الزامی است'),

  piecesPerCarton: z.number().int().positive('تعداد در کارتن الزامی است'),
  sqmPerCarton: z.number().positive('متراژ هر کارتن الزامی است'),

  cover: z.string().optional().nullable(),
  gallery: z.array(z.string()).default([]),
  richDescription: z.string().optional().nullable(),

  basePricePerSqm: z.number().nonnegative('قیمت پایه بر حسب متر مربع الزامی است'),
  inventorySqm: z.number().nonnegative('موجودی بر حسب متر مربع الزامی است'),

  isActive: z.boolean().default(true),
  completeness: ProductCompletenessSchema.optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Product = z.infer<typeof ProductSchema>

export const CreateProductInputSchema = z.object({
  sku: z.string().trim().min(1, 'کد SKU الزامی است'),
  name: z.string().trim().min(1, 'نام کالا الزامی است'),
  slug: SlugSchema,
  categoryId: EntityIdSchema.optional().nullable(),
  brandId: EntityIdSchema.optional().nullable(),
  color: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  width: z.number().positive('عرض الزامی است'),
  height: z.number().positive('طول الزامی است'),
  piecesPerCarton: z.number().int().positive('تعداد در کارتن الزامی است'),
  sqmPerCarton: z.number().positive('متراژ هر کارتن الزامی است'),
  cover: z.string().optional().nullable(),
  gallery: z.array(z.string()).default([]),
  richDescription: z.string().optional().nullable(),
  basePricePerSqm: z.number().nonnegative().default(0),
  inventorySqm: z.number().nonnegative().default(0),
  isActive: z.boolean().default(true),
})

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>

export const UpdateProductInputSchema = z.object({
  id: EntityIdSchema,
  name: z.string().min(1).optional(),
  slug: SlugSchema.optional(),
  categoryId: EntityIdSchema.optional().nullable(),
  brandId: EntityIdSchema.optional().nullable(),
  color: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  piecesPerCarton: z.number().int().positive().optional(),
  sqmPerCarton: z.number().positive().optional(),
  cover: z.string().optional().nullable(),
  gallery: z.array(z.string()).optional(),
  richDescription: z.string().optional().nullable(),
  basePricePerSqm: z.number().nonnegative().optional(),
  inventorySqm: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>

export const ProductFilterInputSchema = PaginationInputSchema.extend({
  search: z.string().optional(),
  categoryId: EntityIdSchema.optional(),
  brandId: EntityIdSchema.optional(),
  color: z.string().optional(),
  grade: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})

export type ProductFilterInput = z.infer<typeof ProductFilterInputSchema>

export const PricePreviewInputSchema = z.object({
  productId: EntityIdSchema,
  customerTypeId: EntityIdSchema.optional(),
  overrideMarkupPercent: z.number().optional(),
})

export type PricePreviewInput = z.infer<typeof PricePreviewInputSchema>

export const PricePreviewOutputSchema = z.object({
  productId: EntityIdSchema,
  sku: z.string(),
  productName: z.string(),
  basePricePerSqm: z.number(),
  markupPercent: z.number(),
  customerTypeName: z.string().optional(),
  finalCustomerPricePerSqm: z.number(),
})

export type PricePreviewOutput = z.infer<typeof PricePreviewOutputSchema>

// ============================================================================
// 6. Customer-Facing Catalog Schemas
// ============================================================================

export const AvailabilityBadgeSchema = z.enum(['available', 'limited', 'out_of_stock'])
export type AvailabilityBadge = z.infer<typeof AvailabilityBadgeSchema>

export const CatalogProductSchema = z.object({
  id: EntityIdSchema,
  sku: z.string(),
  name: z.string(),
  slug: z.string(),

  categoryId: EntityIdSchema.optional().nullable(),
  categoryName: z.string().optional(),

  brandId: EntityIdSchema.optional().nullable(),
  brandName: z.string().optional(),

  color: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  tags: z.array(z.string()),

  width: z.number().positive(),
  height: z.number().positive(),

  piecesPerCarton: z.number().int().positive(),
  sqmPerCarton: z.number().positive(),

  cover: z.string().optional().nullable(),
  gallery: z.array(z.string()),
  richDescription: z.string().optional().nullable(),

  finalCustomerPricePerSqm: z.number().nonnegative(),
  availability: AvailabilityBadgeSchema,
})

export type CatalogProduct = z.infer<typeof CatalogProductSchema>

export const CatalogFilterInputSchema = z
  .object({
    page: z.coerce.number().int().min(1, 'شماره صفحه باید حداقل ۱ باشد').default(1).optional(),
    limit: z.coerce.number().int().min(1, 'تعداد در هر صفحه باید حداقل ۱ باشد').max(100, 'حداکثر ۱۰۰ قلم در هر صفحه مجاز است').default(50).optional(),
    search: z.string().trim().max(100, 'عبارت جستجو نمی‌تواند بیش از ۱۰۰ کاراکتر باشد').optional(),
    categoryId: z.union([EntityIdSchema, z.number().int().positive()]).optional(),
    brandId: z.union([EntityIdSchema, z.number().int().positive()]).optional(),
    color: z.string().trim().max(50).optional(),
    grade: z.string().trim().max(50).optional(),
    tag: z.string().trim().max(50).optional(),
    width: z.coerce.number().positive().optional(),
    height: z.coerce.number().positive().optional(),
    availability: AvailabilityBadgeSchema.optional(),
    onlyActive: z.boolean().optional(),
  })
  .optional()

export type CatalogFilterInput = z.infer<typeof CatalogFilterInputSchema>

export const CartonCalculationInputSchema = z.object({
  productId: EntityIdSchema,
  requestedSqm: z.number().positive('متراژ درخواستی باید بزرگتر از صفر باشد'),
})

export type CartonCalculationInput = z.infer<typeof CartonCalculationInputSchema>

export const CartonCalculationOutputSchema = z.object({
  productId: EntityIdSchema,
  sqmPerCarton: z.number().positive(),
  requestedSqm: z.number().positive(),
  cartonCount: z.number().int().positive(),
  actualSqm: z.number().positive(),
  pricePerSqm: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
})

export type CartonCalculationOutput = z.infer<typeof CartonCalculationOutputSchema>

// ============================================================================
// 7. Unified Catalog Contract
// ============================================================================

export const partsContract = {
  list: oc
    .meta(openapi({ method: 'GET', path: '/parts', summary: 'لیست قطعات خودرو', tags: ['Parts'] }))
    .input(
      z
        .object({
          brand: z.string().optional(),
          category: z.string().optional(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        })
        .default({})
    )
    .output(
      z.object({
        items: z.array(PartSchema),
        total: z.number(),
        limit: z.number(),
        offset: z.number(),
      })
    ),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/parts/{id}', summary: 'دریافت قطعه با شناسه', tags: ['Parts'] }))
    .input(z.object({ id: z.string() }))
    .errors({
      NOT_FOUND: {
        message: 'قطعه مورد نظر در انبار یا کاتالوگ پرشین پارت یافت نشد',
      },
    })
    .output(PartSchema),
}

export const categoryContract = {
  list: oc
    .meta(openapi({ method: 'GET', path: '/categories', summary: 'دریافت لیست دسته‌بندی‌ها' }))
    .input(z.object({ onlyActive: z.coerce.boolean().optional() }).optional())
    .output(z.array(CategorySchema)),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/categories/{id}', summary: 'دریافت تکی دسته‌بندی' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(CategorySchema)
    .errors({ NOT_FOUND: { data: StandardErrorDataSchema } }),

  create: oc
    .meta(openapi({ method: 'POST', path: '/categories', summary: 'ایجاد دسته‌بندی جدید' }))
    .input(CreateCategoryInputSchema)
    .output(CategorySchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
    }),

  update: oc
    .meta(openapi({ method: 'PUT', path: '/categories/{id}', summary: 'ویرایش دسته‌بندی' }))
    .input(UpdateCategoryInputSchema)
    .output(CategorySchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
    }),

  toggleActive: oc
    .meta(openapi({ method: 'POST', path: '/categories/{id}/toggle-active', summary: 'فعال/غیرفعال‌سازی دسته‌بندی' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(CategorySchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
    }),
}

export const brandContract = {
  list: oc
    .meta(openapi({ method: 'GET', path: '/brands', summary: 'دریافت لیست برندها' }))
    .input(z.object({ onlyActive: z.coerce.boolean().optional() }).optional())
    .output(z.array(BrandSchema)),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/brands/{id}', summary: 'دریافت تکی برند' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(BrandSchema)
    .errors({ NOT_FOUND: { data: StandardErrorDataSchema } }),

  create: oc
    .meta(openapi({ method: 'POST', path: '/brands', summary: 'ایجاد برند جدید' }))
    .input(CreateBrandInputSchema)
    .output(BrandSchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
    }),

  update: oc
    .meta(openapi({ method: 'PUT', path: '/brands/{id}', summary: 'ویرایش برند' }))
    .input(UpdateBrandInputSchema)
    .output(BrandSchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
    }),

  toggleActive: oc
    .meta(openapi({ method: 'POST', path: '/brands/{id}/toggle-active', summary: 'فعال/غیرفعال‌سازی برند' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(BrandSchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
    }),
}

export const tagContract = {
  list: oc
    .meta(openapi({ method: 'GET', path: '/tags', summary: 'دریافت لیست تگ‌ها' }))
    .input(z.object({ onlyActive: z.coerce.boolean().optional() }).optional())
    .output(z.array(TagSchema)),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/tags/{id}', summary: 'دریافت تکی تگ' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(TagSchema)
    .errors({ NOT_FOUND: { data: StandardErrorDataSchema } }),

  create: oc
    .meta(openapi({ method: 'POST', path: '/tags', summary: 'ایجاد تگ جدید' }))
    .input(CreateTagInputSchema)
    .output(TagSchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
    }),

  update: oc
    .meta(openapi({ method: 'PUT', path: '/tags/{id}', summary: 'ویرایش تگ' }))
    .input(UpdateTagInputSchema)
    .output(TagSchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
    }),

  toggleActive: oc
    .meta(openapi({ method: 'POST', path: '/tags/{id}/toggle-active', summary: 'فعال/غیرفعال‌سازی تگ' }))
    .input(z.object({ id: EntityIdSchema }))
    .output(TagSchema)
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
    }),
}

export const catalogContract = {
  list: oc
    .meta(openapi({ method: 'GET', path: '/catalog', summary: 'کاتالوگ محصولات با قیمت اختصاصی مشتری جاری' }))
    .input(CatalogFilterInputSchema)
    .output(createPaginatedResponseSchema(CatalogProductSchema).or(z.object({ items: z.array(z.any()), total: z.number() })).or(z.any()))
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
    }),

  getById: oc
    .meta(openapi({ method: 'GET', path: '/catalog/{id}', summary: 'مشاهده جزییات کاتالوگ محصول توسط مشتری' }))
    .input(z.object({ id: z.union([EntityIdSchema, z.number().int().positive()]) }))
    .output(CatalogProductSchema.or(z.any()))
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      BAD_REQUEST: { data: StandardErrorDataSchema },
    }),

  calculateCartons: oc
    .meta(openapi({ method: 'POST', path: '/catalog/calculate-cartons', summary: 'محاسبه متراژ تحویلی و تعداد کارتن برای متراژ درخواستی' }))
    .input(
      z.object({
        productId: z.union([EntityIdSchema, z.number().int().positive()]).optional(),
        requestedSqm: z.number().optional(),
        requestedArea: z.number().optional(),
        sqmPerCarton: z.number().optional(),
        pricePerSqm: z.number().optional(),
      })
    )
    .output(
      z.object({
        cartonCount: z.number(),
        deliverableArea: z.number().optional(),
        totalPrice: z.number().optional(),
      }).or(CartonCalculationOutputSchema).or(z.any())
    )
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      BAD_REQUEST: { data: StandardErrorDataSchema },
    }),

  categories: oc
    .meta(openapi({ method: 'GET', path: '/catalog/categories', summary: 'دریافت لیست دسته‌بندی‌ها' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.array(CategorySchema).or(z.any())),

  brands: oc
    .meta(openapi({ method: 'GET', path: '/catalog/brands', summary: 'دریافت لیست برندها' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.array(BrandSchema).or(z.any())),

  tags: oc
    .meta(openapi({ method: 'GET', path: '/catalog/tags', summary: 'دریافت لیست تگ‌ها' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.array(TagSchema).or(z.any())),

  dimensions: oc
    .meta(openapi({ method: 'GET', path: '/catalog/dimensions', summary: 'دریافت لیست ابعاد' }))
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .output(z.array(DimensionSchema).or(z.any())),

  deleteProduct: oc
    .meta(openapi({ method: 'DELETE', path: '/catalog/products/{id}', summary: 'حذف محصول' }))
    .input(z.object({ id: z.union([EntityIdSchema, z.number().int().positive()]) }))
    .output(z.any())
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      BAD_REQUEST: { data: StandardErrorDataSchema },
    }),

  deleteCategory: oc
    .meta(openapi({ method: 'DELETE', path: '/catalog/categories/{id}', summary: 'حذف دسته‌بندی' }))
    .input(z.object({ id: z.union([EntityIdSchema, z.number().int().positive()]) }))
    .output(z.any())
    .errors({
      UNAUTHORIZED: { data: StandardErrorDataSchema },
      FORBIDDEN: { data: StandardErrorDataSchema },
      NOT_FOUND: { data: StandardErrorDataSchema },
      CONFLICT: { data: StandardErrorDataSchema },
      BAD_REQUEST: { data: StandardErrorDataSchema },
    }),
}
