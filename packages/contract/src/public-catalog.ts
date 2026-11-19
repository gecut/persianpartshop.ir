import { z } from 'zod'

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const ids = z.array(id).max(5000).default([])
const visitorIds = z.array(id).max(100).default([])
const strings = z.array(z.string().trim().min(1).max(100)).max(100).default([])
export const CatalogStatusSchema = z.enum([
  'available',
  'inquiry',
  'out_of_stock',
])
export const PublicCatalogSortSchema = z.enum([
  'default',
  'newest',
  'oldest',
  'cheapest',
  'expensive',
])
export const CATALOG_PRICE_CHANGE_THRESHOLD = 10

export function normalizeCatalogSearch(value: string): string {
  return value
    .normalize('NFC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[\u200c\u200d\s]+/g, ' ')
    .trim()
    .toLowerCase()
}

export const CatalogCriteriaSchema = z
  .object({
    productTypes: z.array(z.enum(['tile', 'other'])).default([]),
    categoryIds: ids,
    brandIds: ids,
    dimensionIds: ids,
    colors: strings,
    grades: strings,
    tagIds: ids,
    tagMatch: z.enum(['any', 'all']).default('any'),
    stockStatuses: z.array(CatalogStatusSchema).default([]),
    minPrice: z.number().finite().nonnegative().nullable().default(null),
    maxPrice: z.number().finite().nonnegative().nullable().default(null),
    onlyWithImage: z.boolean().default(false),
    onlyWithValidPrice: z.boolean().default(false),
  })
  .refine(
    (v) => v.minPrice == null || v.maxPrice == null || v.minPrice <= v.maxPrice,
    { message: 'حداقل قیمت نباید از حداکثر بیشتر باشد.' },
  )

export const CatalogContactChannelSchema = z
  .object({
    type: z.enum([
      'phone',
      'email',
      'telegram',
      'whatsapp',
      'eitaa',
      'bale',
      'website',
    ]),
    label: z.string().trim().min(1).max(100),
    url: z
      .string()
      .max(2048)
      .refine((value) => {
        try {
          return ['https:', 'tel:', 'mailto:'].includes(new URL(value).protocol)
        } catch {
          return false
        }
      }, 'نشانی تماس معتبر نیست.'),
  })
  .strict()

export const CatalogSettingsSchema = z.object({
  paused: z.boolean().default(true),
  pausedMessage: z.string().max(500).default('کاتالوگ در حال آماده‌سازی است.'),
  base: z.enum(['all_active', 'filtered', 'none']).default('none'),
  additions: ids,
  exclusions: ids,
  criteria: CatalogCriteriaSchema.default({}),
  pricing: z
    .object({
      showPrice: z.boolean().default(true),
      percentage: z.number().finite().gt(-100).default(0),
      roundingStep: z
        .union([
          z.literal(1),
          z.literal(100),
          z.literal(1000),
          z.literal(10000),
        ])
        .default(1),
      note: z
        .string()
        .max(500)
        .default('قیمت‌های درج‌شده، قیمت عمومی کاتالوگ هستند.'),
    })
    .default({}),
  stock: z
    .object({
      mode: z.enum(['numeric', 'status', 'hidden']).default('status'),
      displayCap: z.number().finite().positive().nullable().default(null),
    })
    .default({}),
  presentation: z
    .object({
      title: z.string().trim().min(1).max(150).default('کاتالوگ پرشین‌پارت'),
      introduction: z.string().max(1000).default(''),
      fallbackImage: id.nullable().default(null),
      watermark: z.boolean().default(false),
      sort: PublicCatalogSortSchema.default('default'),
    })
    .default({}),
  sharing: z
    .object({
      title: z.string().max(150).default('کاتالوگ پرشین‌پارت'),
      description: z.string().max(500).default('معرفی محصولات پرشین‌پارت'),
      image: id.nullable().default(null),
    })
    .default({}),
  contact: z
    .object({
      channels: z.array(CatalogContactChannelSchema).max(10).default([]),
    })
    .default({}),
})
export type CatalogSettings = z.infer<typeof CatalogSettingsSchema>
export const defaultCatalogSettings = (): CatalogSettings =>
  CatalogSettingsSchema.parse({})

// Defaults belong to new/editable settings. A persisted document must contain
// every saved field: corrupted or partial storage must not become a valid policy.
function hasSavedFields(value: unknown, parsed: unknown): boolean {
  if (Array.isArray(parsed))
    return (
      Array.isArray(value) &&
      parsed.every((item, index) => hasSavedFields(value[index], item))
    )
  if (parsed && typeof parsed === 'object') {
    return (
      !!value &&
      typeof value === 'object' &&
      Object.entries(parsed).every(
        ([key, item]) =>
          Object.hasOwn(value, key) &&
          hasSavedFields(Reflect.get(value, key), item),
      )
    )
  }
  return true
}
export const StoredCatalogSettingsSchema = z
  .unknown()
  .transform((value, ctx) => {
    const parsed = CatalogSettingsSchema.safeParse(value)
    if (!parsed.success || !hasSavedFields(value, parsed.data)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Stored catalog settings are incomplete or invalid.',
      })
      return z.NEVER
    }
    return parsed.data
  })

export const PublicCatalogBrowseSchema = z
  .object({
    page: z.number().int().min(1).max(1000000).default(1),
    limit: z.number().int().min(1).max(100).default(24),
    search: z
      .string()
      .transform(normalizeCatalogSearch)
      .pipe(z.string().max(100))
      .default(''),
    categoryIds: visitorIds,
    brandIds: visitorIds,
    dimensionIds: visitorIds,
    colors: strings,
    grades: strings,
    tagIds: visitorIds,
    inStock: z.boolean().default(false),
    minPrice: z.number().finite().nonnegative().nullable().default(null),
    maxPrice: z.number().finite().nonnegative().nullable().default(null),
    sort: PublicCatalogSortSchema.optional(),
  })
  .strict()
  .refine(
    (v) => v.minPrice == null || v.maxPrice == null || v.minPrice <= v.maxPrice,
    { message: 'بازهٔ قیمت معتبر نیست.' },
  )
export type PublicCatalogBrowseInput = z.infer<typeof PublicCatalogBrowseSchema>

export const PublicCatalogPhotoSchema = z
  .object({
    url: z.string(),
    width: z.number().positive(),
    height: z.number().positive(),
    alt: z.string(),
  })
  .strict()
export const PublicCatalogPriceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('hidden') }).strict(),
  z.object({ mode: z.literal('unpriced') }).strict(),
  z
    .object({
      mode: z.literal('amount'),
      amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
])
export const PublicCatalogStockSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('hidden') }).strict(),
  z.object({ mode: z.literal('status'), status: CatalogStatusSchema }).strict(),
  z
    .object({
      mode: z.literal('numeric'),
      status: CatalogStatusSchema,
      quantity: z.number().finite().nonnegative(),
      capped: z.boolean(),
    })
    .strict(),
])
const facet = z.object({ id, name: z.string() }).strict()
export const PublicCatalogFacetsSchema = z
  .object({
    categories: z.array(facet),
    brands: z.array(facet),
    dimensions: z.array(facet),
    tags: z.array(facet),
    colors: z.array(z.string()),
    grades: z.array(z.string()),
  })
  .strict()
export type PublicCatalogFacets = z.infer<typeof PublicCatalogFacetsSchema>
export const PublicCatalogConfigSchema = z
  .object({
    title: z.string(),
    introduction: z.string(),
    pausedMessage: z.string(),
    priceNote: z.string(),
    showPrice: z.boolean(),
    stockMode: z.enum(['numeric', 'status', 'hidden']),
    watermark: z.boolean(),
    sort: PublicCatalogSortSchema,
    shareTitle: z.string(),
    shareDescription: z.string(),
    shareImage: PublicCatalogPhotoSchema.nullable(),
    fallbackImage: PublicCatalogPhotoSchema.nullable(),
    contact: z.array(CatalogContactChannelSchema),
  })
  .strict()
export const PublicCatalogProductSchema = z
  .object({
    id: z.string().regex(/^[1-9]\d*$/),
    name: z.string(),
    sku: z.string(),
    productType: z.enum(['tile', 'other']).nullable(),
    category: facet.nullable(),
    brand: facet.nullable(),
    dimension: facet.nullable(),
    color: z.string().nullable(),
    grade: z.string().nullable(),
    tags: z.array(facet),
    width: z.number().positive().nullable(),
    height: z.number().positive().nullable(),
    unit: z.string().nullable(),
    sqmPerCarton: z.number().positive().nullable(),
    piecesPerCarton: z.number().positive().nullable(),
    weight: z.number().nonnegative().nullable(),
    secondaryUnit: z.string().nullable(),
    itemsPerPack: z.number().positive().nullable(),
    approxCoverage: z.string().nullable(),
    description: z.string(),
    cover: PublicCatalogPhotoSchema.nullable().default(null),
    photos: z.array(PublicCatalogPhotoSchema),
    price: PublicCatalogPriceSchema,
    stock: PublicCatalogStockSchema,
    updatedAt: z.string(),
  })
  .strict()
export type PublicCatalogProduct = z.infer<typeof PublicCatalogProductSchema>
export const PublicCatalogPageSchema = z
  .object({
    state: z.enum(['active', 'paused']),
    revision: z.string(),
    config: PublicCatalogConfigSchema,
    items: z.array(PublicCatalogProductSchema),
    facets: PublicCatalogFacetsSchema,
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    hasMore: z.boolean(),
  })
  .strict()
export type PublicCatalogPage = z.infer<typeof PublicCatalogPageSchema>

export const CatalogExplainSchema = z
  .object({
    id,
    published: z.boolean(),
    clauses: z.array(
      z.object({ reasonCode: z.string(), passed: z.boolean() }).strict(),
    ),
  })
  .strict()
export const CatalogPreviewInputSchema = z
  .object({ settings: CatalogSettingsSchema, productId: id.optional() })
  .strict()
export const CatalogLocationSchema = z
  .object({ url: z.string().url() })
  .strict()
export const CatalogPreviewSchema = z
  .object({
    matchedCount: z.number().int().nonnegative(),
    publishedCount: z.number().int().nonnegative(),
    emptyFilteredIsAll: z.boolean(),
    sample: z.array(PublicCatalogProductSchema),
    explain: CatalogExplainSchema.nullable(),
  })
  .strict()
export const catalogOperations = {
  bootstrap: {
    input: z.object({}).strict().default({}),
    output: PublicCatalogPageSchema,
  },
  browse: { input: PublicCatalogBrowseSchema, output: PublicCatalogPageSchema },
  product: {
    input: z.object({ id }).strict(),
    output: z
      .object({
        config: PublicCatalogConfigSchema,
        product: PublicCatalogProductSchema,
      })
      .strict(),
  },
}
export type CatalogOperation = keyof typeof catalogOperations
export type CatalogInput<K extends CatalogOperation> = z.input<
  (typeof catalogOperations)[K]['input']
>
export type CatalogOutput<K extends CatalogOperation> = z.output<
  (typeof catalogOperations)[K]['output']
>
