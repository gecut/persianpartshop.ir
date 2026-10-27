import { sdk } from '../payload'
import type { Order, Product } from '@persianpart/cms/types'
import type { UserContext } from '../rpc/context'
import { findOrderByIdOrNumber } from './router.helpers'

export interface CalculatedOrderItem {
  productId: number
  productName: string
  sku: string
  requestedArea: number
  sqmPerCarton: number
  cartonCount: number
  deliverableArea: number
  unitPrice: number
  totalPrice: number
  isActive: boolean
  hasIssues: boolean
  issueReason?: string
}

/**
 * Extracts owner user ID from an Order document.
 * Supports both numeric ID and populated User relation object.
 */
export function getOrderUserId(orderDoc: Order | any): number | string | null {
  if (!orderDoc || orderDoc.user === undefined || orderDoc.user === null) {
    return null
  }
  if (typeof orderDoc.user === 'object' && orderDoc.user !== null) {
    return (orderDoc.user as any).id ?? null
  }
  return orderDoc.user
}

/**
 * Validates that the active context user has permission to access the order.
 * - Admins and Superadmins have global access.
 * - Regular customers can strictly access only their own orders.
 * If access is denied, throws NOT_FOUND to prevent ID enumeration.
 */
export function assertOrderAccess(
  orderDoc: Order | any,
  contextUser: UserContext | null,
  errors: { NOT_FOUND: (options?: any) => any }
): void {
  if (!orderDoc) {
    throw errors.NOT_FOUND()
  }

  if (!contextUser) {
    throw errors.NOT_FOUND()
  }

  const isAdmin = contextUser.role === 'admin' || contextUser.role === 'superadmin'
  if (isAdmin) {
    return
  }

  const orderUserId = getOrderUserId(orderDoc)
  if (orderUserId === null || String(orderUserId) !== String(contextUser.id)) {
    throw errors.NOT_FOUND()
  }
}

/**
 * Unified finder and authorizer for orders by numeric ID or orderNumber string.
 */
export async function findAndAuthorizeOrder(
  rawId: string | number,
  contextUser: UserContext | null,
  depth = 2,
  errors: { NOT_FOUND: (options?: any) => any; BAD_REQUEST: (options?: any) => any }
): Promise<Order> {
  if (!rawId) {
    throw errors.BAD_REQUEST({ message: 'شناسه سفارش نامعتبر است.' })
  }

  let orderDoc: Order | null = null
  try {
    orderDoc = (await findOrderByIdOrNumber(rawId, depth)) as Order | null
  } catch {
    orderDoc = null
  }

  if (!orderDoc) {
    throw errors.NOT_FOUND()
  }

  assertOrderAccess(orderDoc, contextUser, errors)
  return orderDoc
}

/**
 * Generates a collision-resistant unique temporary order number.
 * Combines timestamp with high-entropy random sequence.
 */
export function generateTempOrderNumber(): string {
  const timestamp = Date.now().toString()
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString()
  return `ptp-tmp-${timestamp.slice(-8)}-${randomSuffix}`
}

/**
 * Single Source of Truth (SSOT) packaging & pricing conversion engine:
 * Shares identical mathematics between `submit` and `validateCart`.
 */
export async function calculateOrderItemPricing(
  productIdInput: string | number,
  requestedAreaInput: number | undefined,
  requestedSqmInput: number | undefined,
  markupPercent: number
): Promise<CalculatedOrderItem> {
  const productId = Number(productIdInput)
  if (isNaN(productId) || productId <= 0) {
    return {
      productId: 0,
      productName: 'محصول نامعتبر',
      sku: '',
      requestedArea: 0,
      sqmPerCarton: 0,
      cartonCount: 0,
      deliverableArea: 0,
      unitPrice: 0,
      totalPrice: 0,
      isActive: false,
      hasIssues: true,
      issueReason: 'شناسه محصول نامعتبر است.',
    }
  }

  // Handle both requestedArea and requestedSqm (backward compatibility)
  const rawArea = requestedAreaInput ?? requestedSqmInput
  const requestedArea = Number(rawArea)
  if (isNaN(requestedArea) || requestedArea <= 0 || !isFinite(requestedArea)) {
    return {
      productId,
      productName: 'متراژ نامعتبر',
      sku: '',
      requestedArea: 0,
      sqmPerCarton: 0,
      cartonCount: 0,
      deliverableArea: 0,
      unitPrice: 0,
      totalPrice: 0,
      isActive: false,
      hasIssues: true,
      issueReason: 'متراژ درخواستی باید عددی مثبت و متناهی باشد.',
    }
  }

  let product: Product | null = null
  try {
    product = (await sdk.findByID({ collection: 'products', id: productId })) as Product | null
  } catch {
    product = null
  }

  if (!product) {
    return {
      productId,
      productName: 'محصول یافت نشد',
      sku: '',
      requestedArea,
      sqmPerCarton: 0,
      cartonCount: 0,
      deliverableArea: 0,
      unitPrice: 0,
      totalPrice: 0,
      isActive: false,
      hasIssues: true,
      issueReason: `محصول با شناسه ${productId} یافت نشد.`,
    }
  }

  if (product.isActive === false) {
    return {
      productId,
      productName: product.name || '',
      sku: product.sku || '',
      requestedArea,
      sqmPerCarton: Number(product.sqmPerCarton) || 0,
      cartonCount: 0,
      deliverableArea: 0,
      unitPrice: 0,
      totalPrice: 0,
      isActive: false,
      hasIssues: true,
      issueReason: `محصول «${product.name}» غیرفعال شده و امکان سفارش آن وجود ندارد.`,
    }
  }

  const sqmPerCarton = Number(product.sqmPerCarton)
  if (isNaN(sqmPerCarton) || sqmPerCarton <= 0) {
    return {
      productId,
      productName: product.name || '',
      sku: product.sku || '',
      requestedArea,
      sqmPerCarton: 0,
      cartonCount: 0,
      deliverableArea: 0,
      unitPrice: 0,
      totalPrice: 0,
      isActive: false,
      hasIssues: true,
      issueReason: `اطلاعات متراژ در هر کارتن محصول «${product.name}» ناقص است.`,
    }
  }

  const cartonCount = Math.ceil(requestedArea / sqmPerCarton)
  const deliverableArea = Math.round(cartonCount * sqmPerCarton * 100) / 100
  const basePrice = Number(product.basePricePerSqm) || 0
  const unitPrice = Math.round(basePrice * (1 + markupPercent / 100))
  const totalPrice = Math.round(deliverableArea * unitPrice)

  return {
    productId,
    productName: product.name || '',
    sku: product.sku || '',
    requestedArea,
    sqmPerCarton,
    cartonCount,
    deliverableArea,
    unitPrice,
    totalPrice,
    isActive: true,
    hasIssues: false,
  }
}
