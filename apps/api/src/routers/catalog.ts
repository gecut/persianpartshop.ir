import { sdk } from '../payload'
import { base, adminOnly } from '../rpc/base'
import type { Product, Category, Brand, Tag, Dimension } from '@persianpart/cms/types'
import { calculateCartonMetrics } from './catalog.helpers'
import {
  fetchTaxonomy,
  getUserPermissions,
  getUserMarkupPercent,
  applyProductPricing,
} from './router.helpers'

const list = base.catalog.list.handler(async ({ input, context }) => {
  const isAdmin = context.user?.role === 'admin' || context.user?.role === 'superadmin'
  const userPerms = await getUserPermissions(context.user?.id)
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
  const limit = Math.min(Math.max(1, Number(input?.limit) || 50), 100)
  const page = Math.max(1, Number(input?.page) || 1)

  const res = await sdk.find({
    collection: 'products',
    where,
    limit,
    page,
    depth: 2,
    sort: '-createdAt',
  })

  const products = res.docs as Product[]
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

const getById = base.catalog.getById.handler(async ({ input, context, errors }) => {
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
  const userPerms = await getUserPermissions(context.user?.id)

  if (!isAdmin) {
    if (prod.isActive === false) {
      throw errors.NOT_FOUND({ data: { message: 'محصول مورد نظر غیرفعال است یا یافت نشد.' } })
    }
    if (userPerms.allowedCategoryIds.length > 0) {
      const catId =
        typeof prod.category === 'object' && prod.category !== null
          ? (prod.category as any).id
          : prod.category
      if (catId && !userPerms.allowedCategoryIds.includes(Number(catId))) {
        throw errors.NOT_FOUND({ data: { message: 'شما دسترسی مشاهده این دسته‌بندی را ندارید.' } })
      }
    }
  }

  return applyProductPricing(prod, userPerms.markupPercent, userPerms.hideExactStock)
})

const categories = base.catalog.categories.handler(async ({ input, context }) => {
  const isAdmin = context?.user?.role === 'admin' || context?.user?.role === 'superadmin'
  const userPerms = await getUserPermissions(context?.user?.id)
  const docs = (await fetchTaxonomy('categories', { onlyActive: input?.onlyActive, sort: 'ordering' })) as Category[]

  if (!isAdmin && userPerms.allowedCategoryIds.length > 0) {
    return docs.filter((cat) => userPerms.allowedCategoryIds.includes(Number(cat.id)))
  }
  return docs
})

const brands = base.catalog.brands.handler(async ({ input }) => {
  const docs = await fetchTaxonomy('brands', { onlyActive: input?.onlyActive, sort: 'name' })
  return docs as Brand[]
})

const tags = base.catalog.tags.handler(async ({ input }) => {
  const docs = await fetchTaxonomy('tags', { onlyActive: input?.onlyActive, sort: 'name' })
  return docs as Tag[]
})

const dimensions = base.catalog.dimensions.handler(async ({ input }) => {
  const docs = await fetchTaxonomy('dimensions', { onlyActive: input?.onlyActive, sort: 'width' })
  return docs as Dimension[]
})

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

const calculateCartons = base.catalog.calculateCartons.handler(async ({ input, context }) => {
  const markupPercent = await getUserMarkupPercent(context?.user?.id)
  return calculateCartonMetrics(input, markupPercent)
})

export const catalog = base.catalog.router({
  list,
  getById,
  categories,
  brands,
  tags,
  dimensions,
  deleteProduct,
  deleteCategory,
  calculateCartons,
})
