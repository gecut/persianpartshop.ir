import { ORPCError } from '@orpc/server'
import { sdk } from '../payload'
import { normalizeDigits } from '../lib/otp'
import { extractBearerToken, revokeToken } from '../lib/jwt'
import type { Context } from '../rpc/context'

/**
 * Converts English digit strings to Persian digits
 */
export function toPersianDigits(object: string): string {
  const pick = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return object.replace(/\d/g, (d) => pick[Number(d)])
}

/**
 * Finds user by checking both normalized English and Persian digits
 */
export async function findUserByPhone(phone: string) {
  const normalized = normalizeDigits(phone)
  const persian = toPersianDigits(normalized)

  const existing = await sdk.find({
    collection: 'users',
    where: {
      or: [
        { phone: { equals: normalized } },
        { phone: { equals: persian } },
      ],
    },
    limit: 1,
  })

  if (existing.docs[0]) {
    return existing.docs[0]
  }

  // If not found in users, check if an admin with this phone exists in admins collection.
  // Managers and superadmins registered in the admin panel can act as normal customers on the store.
  try {
    const existingAdmin = await sdk.find({
      collection: 'admins',
      where: {
        or: [
          { phone: { equals: normalized } },
          { phone: { equals: persian } },
        ],
      },
      limit: 1,
    })

    if (existingAdmin.docs[0] && existingAdmin.docs[0].isActive !== false) {
      const admin = existingAdmin.docs[0]
      const defaultTypeRes = await sdk.find({
        collection: 'customer-types',
        limit: 1,
      })
      const customerTypeId = defaultTypeRes.docs[0]?.id || 1

      const createdUser = await sdk.create({
        collection: 'users',
        data: {
          fullName: admin.name,
          phone: normalized,
          customerType: customerTypeId,
          status: 'active',
          notes: `حساب کاربری فروشگاه ایجاد شده برای مدیر سامانه (${admin.name})`,
        },
      })
      return createdUser
    }
  } catch (adminLookupErr) {
    console.error('Error auto-linking admin to customer account:', adminLookupErr)
  }

  return null
}

/**
 * Fetches user document from Payload CMS by ID
 */
export async function getUserProfile(userId: string | number) {
  return sdk.findByID({ collection: 'users', id: userId })
}

/**
 * Formats a raw user document into standard CustomerProfile contract shape
 */
export function formatCustomerProfile(userDoc: any) {
  if (!userDoc) return null
  const hideExactStock = Boolean(userDoc.hideExactStock)
  const disableOrdering = Boolean(userDoc.disableOrdering) || hideExactStock
  const allowedCategoryIds: number[] = []
  if (Array.isArray(userDoc.allowedCategories)) {
    for (const cat of userDoc.allowedCategories) {
      const cId = typeof cat === 'object' && cat !== null ? cat.id : cat
      const num = Number(cId)
      if (!isNaN(num) && num > 0) {
        allowedCategoryIds.push(num)
      }
    }
  }
  return {
    id: String(userDoc.id),
    contactName: userDoc.fullName || userDoc.name || '',
    storeName: userDoc.companyName || '',
    mobile: userDoc.phone,
    province: userDoc.province || '',
    city: userDoc.city || '',
    address: userDoc.address || '',
    nationalCode: userDoc.nationalCode || '',
    economicCode: userDoc.economicCode || '',
    creditLimit: userDoc.creditLimit || 0,
    hideExactStock,
    disableOrdering,
    canUseProductQr: Boolean(userDoc.canUseProductQr),
    allowedCategories: userDoc.allowedCategories || [],
    allowedCategoryIds,
    status: userDoc.status || 'pending',
    banReason: userDoc.banReason || '',
  }
}

/**
 * Unified taxonomy query helper for categories, brands, tags, dimensions, customer-types
 */
export async function fetchTaxonomy(
  collection: 'categories' | 'brands' | 'tags' | 'dimensions' | 'customer-types',
  options?: { onlyActive?: boolean; sort?: string; limit?: number; allowInactive?: boolean }
) {
  const where = options?.allowInactive ? undefined : { isActive: { equals: true } }
  const res = await sdk.find({
    collection,
    where,
    limit: options?.limit || 100,
    sort: options?.sort || 'name',
  })
  return res.docs
}

export interface UserPermissions {
  canUseProductQr: boolean
  markupPercent: number
  allowedCategoryIds: number[]
  hideExactStock: boolean
  disableOrdering: boolean
}

export async function getUserPermissions(userId?: string | number, context?: Context): Promise<UserPermissions> {
  const defaults: UserPermissions = {
    canUseProductQr: false,
    markupPercent: 0,
    allowedCategoryIds: [],
    hideExactStock: false,
    disableOrdering: false,
  }

  if (!userId) return defaults

  try {
    const userDoc = context?.accountDocument && String(context.accountDocument.id) === String(userId) ? context.accountDocument : await sdk.findByID({
      collection: 'users',
      id: userId,
      depth: 1,
    })

    if (!userDoc) throw new Error('Customer not found')

    let markupPercent = 0
    const ct = userDoc.customerType
    if (ct && typeof ct === 'object') {
      markupPercent = Number(ct.markupPercent) || 0
    } else if (ct) {
      try {
        const ctDoc: any = await sdk.findByID({ collection: 'customer-types', id: ct })
        markupPercent = Number(ctDoc?.markupPercent) || 0
      } catch { throw new Error('Customer pricing unavailable') }
    }

    const allowedCategoryIds: number[] = []
    if (Array.isArray(userDoc.allowedCategories)) {
      for (const cat of userDoc.allowedCategories) {
        const cId = typeof cat === 'object' && cat !== null ? cat.id : cat
        const num = Number(cId)
        if (!isNaN(num) && num > 0) {
          allowedCategoryIds.push(num)
        }
      }
    }

    const hideExactStock = Boolean(userDoc.hideExactStock)
    const disableOrdering = Boolean(userDoc.disableOrdering) || hideExactStock

    return {
      canUseProductQr: userDoc.canUseProductQr === true,
      markupPercent,
      allowedCategoryIds,
      hideExactStock,
      disableOrdering,
    }
  } catch {
    throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'بررسی دسترسی حساب ممکن نشد؛ دوباره تلاش کنید.' })
  }
}

/**
 * Retrieves the customer-specific price markup percentage based on user's customerType
 */
export async function getUserMarkupPercent(userId?: string | number): Promise<number> {
  const perms = await getUserPermissions(userId)
  return perms.markupPercent
}

/**
 * Applies customer markup percentage to product base price
 */
export function applyProductPricing(product: any, markupPercent: number, hideExactStock = false) {
  const basePrice = Number(product.basePricePerSqm) || 0
  const finalPrice = Math.round(basePrice * (1 + markupPercent / 100))
  // Omit basePricePerSqm from customer-facing DTO to preserve B2B confidentiality
  const { basePricePerSqm, scanCode, ...safeProduct } = product

  if (hideExactStock) {
    // Customer cannot view exact stock quantities; only status of in-stock or out-of-stock
    const hasStock = Number(safeProduct.stockCartons || 0) > 0 || Number(safeProduct.inventorySqm || 0) > 0
    safeProduct.stockCartons = hasStock ? 1 : 0
    safeProduct.inventorySqm = hasStock ? 1 : 0
    safeProduct.hideExactStock = true
  }

  return {
    ...safeProduct,
    hasScanCode: Boolean(scanCode),
    finalCustomerPricePerSqm: finalPrice,
  }
}

/**
 * Sanitizes order documents for customer consumption, ensuring internal wholesale pricing
 * and staff notes are never disclosed.
 */
export function sanitizeOrderForCustomer(order: any) {
  if (!order || typeof order !== 'object') return order
  const sanitized = { ...order, orderNumber: String(order.trackingNumber ?? order.orderNumber) }
  if (Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items.map((item: any) => {
      if (!item || typeof item !== 'object') return item
      const safeItem = { ...item }
      if (safeItem.product && typeof safeItem.product === 'object') {
        const { basePricePerSqm, scanCode, ...safeProduct } = safeItem.product
        safeItem.product = safeProduct
      }
      return safeItem
    })
  }
  if (sanitized.user && typeof sanitized.user === 'object') {
    const { notes, password, resetPasswordToken, salt, hash, ...safeUser } = sanitized.user
    if (safeUser.customerType && typeof safeUser.customerType === 'object') {
      const { markupPercent, ...safeCt } = safeUser.customerType
      safeUser.customerType = safeCt
    }
    sanitized.user = safeUser
  }
  return sanitized
}

/** Remove private scan codes from populated products returned inside customer plans. */
export function sanitizePlanProducts<T extends { products?: unknown }>(plan: T): T {
  if (!Array.isArray(plan.products)) return plan
  return {
    ...plan,
    products: plan.products.map((product: unknown) => {
      if (!product || typeof product !== 'object') return product
      const { scanCode: _scanCode, ...safeProduct } = product as Record<string, unknown>
      return safeProduct
    }),
  }
}

/**
 * Queries an order either by numeric database ID or orderNumber string
 */
export async function findOrderByIdOrNumber(rawId: string | number, depth = 2) {
  if (!rawId) return null

  if (!isNaN(Number(rawId))) {
    try {
      const doc = await sdk.findByID({
        collection: 'orders',
        id: Number(rawId),
        depth,
      })
      if (doc) return doc
    } catch {
      // fallback to orderNumber query
    }
  }

  const res = await sdk.find({
    collection: 'orders',
    where: {
      or: [
        { orderNumber: { equals: String(rawId) } },
        { id: { equals: isNaN(Number(rawId)) ? rawId : Number(rawId) } },
      ],
    },
    limit: 1,
    depth,
  })

  return res.docs[0] || null
}

/**
 * Enriches plan title with user name, replacing {name} placeholders
 */
export function enrichPlanWithUserName(planDoc: any, userName: string) {
  const dynamicTitle =
    planDoc.title && !planDoc.title.includes('{name}')
      ? planDoc.title
      : `${userName} عزیز، این طرح برای شماست`

  return {
    ...planDoc,
    dynamicTitle: planDoc.dynamicTitle || dynamicTitle,
    title: planDoc.title ? planDoc.title.replace(/\{name\}/g, userName) : dynamicTitle,
  }
}

/**
 * Universal logout handler that revokes the active JWT token
 */
export function handleLogout(context: Context) {
  const token = extractBearerToken(context.req.headers)
  if (token) {
    revokeToken(token, context.jwtPayload?.exp)
  }
  return { success: true }
}
