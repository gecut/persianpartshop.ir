import type { Context } from '../rpc/context'
import { attachWarehouseStock } from './warehouse-stock.helpers'
import { catalogSync, catalogScope, catalogRecord } from './catalog-sync'
import { sdk } from '../lib/payload'
import { base, customerOnly, adminOnly, authed } from '../rpc/base'
import { ORPCError } from '@orpc/server'
import type { Product, Category, Brand, Tag, Dimension } from '@persianpart/cms/types'
import { calculateCartonMetrics } from './catalog.helpers'
import { buildQrTokenMap, qrProductId } from './qr-token.helpers'
import {
  fetchTaxonomy,
  getUserPermissions,
  applyProductPricing,
} from './router.helpers'

const list = authed.catalog.list.handler(async ({ input, context }) => {
  const isAdmin = context.user?.role === 'admin' || context.user?.role === 'superadmin'
  const userPerms = await getUserPermissions(context.user?.id, context)
  const where: Record<string, any> = {}

  // Invariant: Non-admins can strictly NEVER see inactive products
  if (!isAdmin) {
    where.isActive = { equals: true }
  } else if (input?.onlyActive !== false) {
    where.isActive = { equals: true }
  }

  const search = input?.search?.trim()
  if (search) {
    where.name = { contains: search }
  }

  // Filter by allowed categories for this customer (if configured by admin)
  if (!isAdmin && userPerms.allowedCategoryIds.length > 0) {
    if (input?.categoryId) {
      const requestedCatId = Number(input.categoryId)
      if (userPerms.allowedCategoryIds.includes(requestedCatId)) {
        where.category = { equals: requestedCatId }
      } else {
        where.category = { in: [-1] }
      }
    } else {
      where.category = { in: userPerms.allowedCategoryIds }
    }
  } else if (input?.categoryId) {
    const categoryId = Number(input.categoryId)
    if (!isNaN(categoryId) && categoryId > 0) {
      where.category = { equals: categoryId }
    }
  }

  if (input?.brandId) {
    const brandId = Number(input.brandId)
    if (!isNaN(brandId) && brandId > 0) {
      where.brand = { equals: brandId }
    }
  }

  if (input?.color) {
    where.color = { equals: input.color.trim() }
  }

  if (input?.grade) {
    where.grade = { equals: input.grade.trim() }
  }

  // Capped and validated pagination limits
  const limit = Math.min(Math.max(1, Number(input?.limit) || 50), 500)
  const page = Math.max(1, Number(input?.page) || 1)

  const res = await sdk.find({
    collection: 'products',
    where,
    limit,
    page,
    depth: 2,
    sort: ['name', 'id'],
  })

  const products = await attachWarehouseStock(res.docs as Product[])
  const items = products.map((prod) =>
    applyProductPricing(prod, userPerms.markupPercent, userPerms.hideExactStock)
  )

  return {
    items,
    total: res.totalDocs,
    page,
    limit,
    totalPages: Math.ceil(res.totalDocs / limit) || 1,
  }
})

const getById = authed.catalog.getById.handler(async ({ input, context, errors }) => {
  const id = Number(input.id)
  if (isNaN(id) || id <= 0) {
    throw errors.BAD_REQUEST({ data: { message: 'شناسه محصول نامعتبر است.' } })
  }

  let prod: Product | null = null
  try {
    prod = (await sdk.findByID({
      collection: 'products',
      id,
      depth: 2,
    })) as Product | null
  } catch {
    prod = null
  }

  if (!prod) {
    throw errors.NOT_FOUND({ data: { message: 'محصول مورد نظر یافت نشد.' } })
  }

  const isAdmin = context.user?.role === 'admin' || context.user?.role === 'superadmin'
  const userPerms = await getUserPermissions(context.user?.id, context)

  if (!isAdmin) {
    if (prod.isActive === false) {
      throw errors.NOT_FOUND({ data: { message: 'محصول مورد نظر غیرفعال است یا یافت نشد.' } })
    }
    if (userPerms.allowedCategoryIds.length > 0) {
      const catId =
        typeof prod.category === 'object' && prod.category !== null
          ? (prod.category as any).id
          : prod.category
      if (!catId || !userPerms.allowedCategoryIds.includes(Number(catId))) {
        throw errors.NOT_FOUND({ data: { message: 'شما دسترسی مشاهده این دسته‌بندی را ندارید.' } })
      }
    }
  }

  return catalogRecord((await attachWarehouseStock([prod]))[0]!, context, { permissions: userPerms, scopeKey: (await catalogScope(context)).scopeKey })
})

async function qrPermissions(userId: string | number) {
  const permissions = await getUserPermissions(userId)
  if (!permissions.canUseProductQr) throw new ORPCError('FORBIDDEN', { message: 'دسترسی اسکن محصول فعال نیست.' })
  return permissions
}

const getByQrToken = customerOnly.catalog.getByQrToken.handler(async ({ input, context }) => {
  const permissions = await qrPermissions(context.user.id)
  const found = await sdk.find({
    collection: 'qr-codes',
    where: { and: [{ token: { equals: input.token } }, { isActive: { equals: true } }] },
    limit: 1,
    depth: 0,
  })
  const productId = qrProductId(found.docs[0]?.product)
  if (productId === null) throw new ORPCError('NOT_FOUND', { message: 'محصول مورد نظر یافت نشد.' })
  const result = await sdk.find({ collection: 'products', where: { id: { equals: productId }, isActive: { equals: true } }, limit: 1, depth: 2 })
  const product = result.docs[0] as Product | undefined
  const category = typeof product?.category === 'object' ? product.category?.id : product?.category
  if (!product || (permissions.allowedCategoryIds.length > 0 && (!category || !permissions.allowedCategoryIds.includes(Number(category))))) {
    throw new ORPCError('NOT_FOUND', { message: 'محصول مورد نظر یافت نشد.' })
  }
  return catalogRecord((await attachWarehouseStock([product]))[0]!, context, { permissions, scopeKey: (await catalogScope(context)).scopeKey })
})

const listQrTokens = customerOnly.catalog.listQrTokens.handler(async ({ context }) => {
  const permissions = await qrPermissions(context.user.id)
  const rows: Array<{ token: string; product?: number | { id: number } | null | undefined; isActive?: boolean | null }> = []
  for (let page = 1; ; page++) {
    const result = await sdk.find({
      collection: 'qr-codes',
      where: { and: [{ isActive: { equals: true } }, { product: { exists: true } }] },
      sort: 'id',
      limit: 1000, page, depth: 0,
    })
    rows.push(...result.docs)
    if (!result.hasNextPage) break
  }
  const productIds = [...new Set(rows.flatMap((row) => { const id = qrProductId(row.product); return id === null ? [] : [id] }))]
  const visible = new Set<number>()
  for (let i = 0; i < productIds.length; i += 500) {
    const chunk = productIds.slice(i, i + 500)
    const result = await sdk.find({
      collection: 'products',
      where: { and: [
        { id: { in: chunk } },
        { isActive: { equals: true } },
        ...(permissions.allowedCategoryIds.length ? [{ category: { in: permissions.allowedCategoryIds } }] : []),
      ] },
      select: {}, limit: chunk.length, depth: 0,
    })
    for (const doc of result.docs) visible.add(doc.id)
  }
  return { tokens: buildQrTokenMap(rows, visible) }
})

const categories = authed.catalog.categories.handler(async ({ input, context }) => {
  const isAdmin = context?.user?.role === 'admin' || context?.user?.role === 'superadmin'
  const userPerms = await getUserPermissions(context?.user?.id, context)
  const docs = (await fetchTaxonomy('categories', { onlyActive: input?.onlyActive, sort: 'ordering' })) as Category[]

  if (!isAdmin && userPerms.allowedCategoryIds.length > 0) {
    return docs.filter((cat) => userPerms.allowedCategoryIds.includes(Number(cat.id)))
  }
  return docs
})

const brands = authed.catalog.brands.handler(async ({ input }) => {
  const docs = await fetchTaxonomy('brands', { onlyActive: input?.onlyActive, sort: 'name' })
  return docs as Brand[]
})

const tags = authed.catalog.tags.handler(async ({ input }) => {
  const docs = await fetchTaxonomy('tags', { onlyActive: input?.onlyActive, sort: 'name' })
  return docs as Tag[]
})

type ProductWhere = NonNullable<Parameters<typeof sdk.find>[0]['where']>

/** Counts active products per dimension id, reading every page of the match. */
async function countProductsByDimension(where: ProductWhere) {
  const counts = new Map<string, number>()
  for (let page = 1; ; page += 1) {
    const result = await sdk.find({
      collection: 'products', where, select: { dimension: true }, depth: 0,
      limit: 500, page, sort: 'id',
    })
    for (const product of result.docs) {
      const id = typeof product.dimension === 'object' ? product.dimension?.id : product.dimension
      if (id != null) counts.set(String(id), (counts.get(String(id)) ?? 0) + 1)
    }
    if (!result.hasNextPage) return counts
  }
}

function productsWithDimensions(dimensions: Dimension[], categoryIds: number[]) {
  return {
    isActive: { equals: true },
    dimension: { in: dimensions.map((dimension) => dimension.id) },
    ...(categoryIds.length ? { category: { in: categoryIds } } : {}),
  } satisfies ProductWhere
}

const byCount = (counts: Map<string, number>) => (a: Dimension, b: Dimension) =>
  (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0)

/** Every dimension, ordered by how many products in the caller's categories use it. */
async function catalogDimensions(input: { onlyActive?: boolean } | undefined, context: Context) {
  // Spread copies give the oRPC output schema the plain objects it expects.
  const docs = ((await fetchTaxonomy('dimensions', { onlyActive: input?.onlyActive, sort: 'width' })) as Dimension[]).map((dimension) => ({ ...dimension }))
  if (docs.length === 0) return docs

  const isAdmin = context.user?.role === 'admin' || context.user?.role === 'superadmin'
  const categoryIds = isAdmin ? [] : (await getUserPermissions(context.user?.id, context)).allowedCategoryIds
  const counts = await countProductsByDimension(productsWithDimensions(docs, categoryIds))
  return docs.sort(byCount(counts))
}

/**
 * Active dimensions that at least one tile in the scope's categories uses.
 * Browse matches `other` products by weight, so they never back a dimension option.
 */
export async function facetDimensions(categoryIds: number[]) {
  const docs = (await fetchTaxonomy('dimensions', { onlyActive: true, sort: 'width' })) as Dimension[]
  if (docs.length === 0) return docs

  const counts = await countProductsByDimension({
    ...productsWithDimensions(docs, categoryIds),
    or: [{ productType: { not_equals: 'other' } }, { productType: { exists: false } }],
  })
  return docs.filter((dimension) => counts.has(String(dimension.id))).sort(byCount(counts))
}
const dimensions = authed.catalog.dimensions.handler(({ input, context }) => catalogDimensions(input, context))

const deleteProduct = adminOnly.catalog.deleteProduct.handler(async ({ input, errors }) => {
  const id = Number(input.id)
  if (isNaN(id) || id <= 0) {
    throw errors.BAD_REQUEST({ data: { message: 'شناسه محصول نامعتبر است.' } })
  }

  let existing: Product | null = null
  try {
    existing = (await sdk.findByID({ collection: 'products', id })) as Product | null
  } catch {
    existing = null
  }

  if (!existing) {
    throw errors.NOT_FOUND({ data: { message: 'محصول مورد نظر یافت نشد.' } })
  }

  return sdk.delete({ collection: 'products', id })
})

const deleteCategory = adminOnly.catalog.deleteCategory.handler(async ({ input, errors }) => {
  const id = Number(input.id)
  if (isNaN(id) || id <= 0) {
    throw errors.BAD_REQUEST({ data: { message: 'شناسه دسته‌بندی نامعتبر است.' } })
  }

  let existingCategory: Category | null = null
  try {
    existingCategory = (await sdk.findByID({ collection: 'categories', id })) as Category | null
  } catch {
    existingCategory = null
  }

  if (!existingCategory) {
    throw errors.NOT_FOUND({ data: { message: 'دسته‌بندی مورد نظر یافت نشد.' } })
  }

  // Check product dependency: prevent orphaning products
  const productCount = await sdk.count({
    collection: 'products',
    where: {
      category: { equals: id },
    },
  })

  if (productCount.totalDocs > 0) {
    throw errors.CONFLICT({
      data: {
        message: `امکان حذف این دسته‌بندی وجود ندارد؛ تعداد ${productCount.totalDocs} محصول به این دسته‌بندی متصل هستند. لطفاً ابتدا دسته‌بندی محصولات را تغییر دهید یا آن‌ها را حذف نمایید.`,
      },
    })
  }

  return sdk.delete({ collection: 'categories', id })
})

const calculateCartons = authed.catalog.calculateCartons.handler(async ({ input, context }) => {
  const permissions = await getUserPermissions(context?.user?.id, context)
  return calculateCartonMetrics(input, permissions.markupPercent, permissions.allowedCategoryIds)
})

export const catalog = base.catalog.router({
  ...catalogSync,
  facets: authed.catalog.facets.handler(async ({ context }) => {
    const scope = await catalogScope(context)
    const docs = await facetDimensions(scope.permissions.allowedCategoryIds)
    return { scopeKey: scope.scopeKey, dimensions: docs.map(doc => ({ ...doc })) }
  }),
  list,
  getById,
  getByQrToken,
  listQrTokens,
  categories,
  brands,
  tags,
  dimensions,
  deleteProduct,
  deleteCategory,
  calculateCartons,
})
