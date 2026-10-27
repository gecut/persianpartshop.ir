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

  return existing.docs[0] || null
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

/**
 * Retrieves the customer-specific price markup percentage based on user's customerType
 */
export async function getUserMarkupPercent(userId?: string | number): Promise<number> {
  if (!userId) return 0
  try {
    const userDoc: any = await sdk.findByID({
      collection: 'users',
      id: userId,
      depth: 1,
    })
    const ct = userDoc?.customerType
    if (ct && typeof ct === 'object') {
      return Number(ct.markupPercent) || 0
    }
    if (ct) {
      const ctDoc: any = await sdk.findByID({ collection: 'customer-types', id: ct })
      return Number(ctDoc?.markupPercent) || 0
    }
  } catch {
    // fallback to zero markup
  }
  return 0
}

/**
 * Applies customer markup percentage to product base price
 */
export function applyProductPricing(product: any, markupPercent: number) {
  const basePrice = Number(product.basePricePerSqm) || 0
  const finalPrice = Math.round(basePrice * (1 + markupPercent / 100))
  // Omit basePricePerSqm from customer-facing DTO to preserve B2B confidentiality
  const { basePricePerSqm, ...safeProduct } = product
  return {
    ...safeProduct,
    finalCustomerPricePerSqm: finalPrice,
  }
}

/**
 * Sanitizes order documents for customer consumption, ensuring internal wholesale pricing
 * and staff notes are never disclosed.
 */
export function sanitizeOrderForCustomer(order: any) {
  if (!order || typeof order !== 'object') return order
  const sanitized = { ...order }
  if (Array.isArray(sanitized.items)) {
    sanitized.items = sanitized.items.map((item: any) => {
      if (!item || typeof item !== 'object') return item
      const safeItem = { ...item }
      if (safeItem.product && typeof safeItem.product === 'object') {
        const { basePricePerSqm, ...safeProduct } = safeItem.product
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

/**
 * Finalizes an order by updating its orderNumber to standard `ptp {id}` format
 */
export async function finalizeOrderNumber(orderDoc: any) {
  if (!orderDoc?.id) return orderDoc
  const finalOrderNumber = `ptp ${orderDoc.id}`
  if (orderDoc.orderNumber === finalOrderNumber) {
    return orderDoc
  }
  try {
    const updated = await sdk.update({
      collection: 'orders',
      id: orderDoc.id,
      data: {
        orderNumber: finalOrderNumber,
      },
    })
    return updated || { ...orderDoc, orderNumber: finalOrderNumber }
  } catch {
    return { ...orderDoc, orderNumber: finalOrderNumber }
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
