import type { CollectionBeforeDeleteHook, CollectionConfig, Field } from 'payload'
import { businessError } from './validation'

function references(fields: Field[], target: string, prefix = ''): string[] {
  const paths: string[] = []
  for (const field of fields) {
    const path = 'name' in field && field.name ? prefix + field.name : prefix.replace(/\.$/, '')
    if ((field.type === 'relationship' || field.type === 'upload') && field.relationTo === target) paths.push(path)
    if ('fields' in field) paths.push(...references(field.fields, target, path ? path + '.' : ''))
    if ('tabs' in field) for (const tab of field.tabs) {
      const tabPrefix = 'name' in tab && tab.name ? prefix + tab.name + '.' : prefix
      paths.push(...references(tab.fields, target, tabPrefix))
    }
  }
  return paths
}

const referenceActions: Record<string, string> = {
  'users.customerType': 'ابتدا ردهٔ دیگری برای مشتری انتخاب کنید.',
  'categories.parent': 'ابتدا دستهٔ والد زیردسته را تغییر دهید.',
  'admins.customer': 'ابتدا حساب مشتری مرتبط را در فرم مدیر تغییر دهید یا بردارید.',
  'plans.users': 'ابتدا مخاطبان را در فرم طرح اصلاح کنید.',
  'plans.products': 'ابتدا محصولات مرتبط را در فرم طرح اصلاح کنید.',
  'users.documents.file': 'در تب مدارک مشتری، فایل مدرک را جایگزین کنید یا ردیف مدرک را بررسی کنید.',
  'products.cover': 'ابتدا تصویر شاخص را در فرم محصول بردارید یا جایگزین کنید.',
  'products.gallery.image': 'ابتدا تصویر را در گالری محصول جایگزین کنید یا ردیف آن را بردارید.',
  'brands.logo': 'ابتدا لوگو را در فرم برند بردارید یا جایگزین کنید.',
  'products.category': 'ابتدا دسته‌بندی را در فرم محصول تغییر دهید.',
  'products.brand': 'ابتدا برند را در فرم محصول تغییر دهید.',
  'products.dimension': 'ابتدا ابعاد را در فرم محصول تغییر دهید.',
  'products.tags': 'ابتدا برچسب را از فرم محصول بردارید.',
}

export const protectReferencedDocument: CollectionBeforeDeleteHook = async ({ id, collection, req }) => {
  for (const source of req.payload.config.collections) {
    if (source.slug.startsWith('payload-')) continue
    if (req.payload.db.name === 'postgres' && (
      (collection.slug === 'products' && source.slug === 'warehouse-stock') ||
      (collection.slug === 'users' && source.slug === 'otps')
    )) continue
    const paths = references(source.fields, collection.slug)
    if (!paths.length) continue
    for (const path of paths) {
      const { docs: [doc] } = await req.payload.find({
        collection: source.slug, where: { [path]: { equals: id } }, limit: 1, depth: 0, req, overrideAccess: true,
      })
      if (!doc) continue
      const label = typeof source.labels.singular === 'string' ? source.labels.singular : source.slug
      let identifier = ''
      if (req.user) {
        try {
          const visible = await req.payload.findByID({ collection: source.slug, id: doc.id, depth: 0, req, overrideAccess: false })
          identifier = ' با شناسهٔ ' + String('trackingNumber' in visible ? visible.trackingNumber : visible.id)
        } catch (error) {
          if (!(error instanceof Error && 'status' in error && (error.status === 403 || error.status === 404))) throw error
        }
      }
      const key = source.slug + '.' + path
      let action = referenceActions[key] ?? 'ابتدا ارتباط را در فرم رکورد وابسته اصلاح کنید.'
      if (key === 'users.allowedCategories') {
        action = 'ابتدا دسته‌بندی‌های مجاز مشتری را بررسی و اصلاح کنید. خالی‌کردن فهرست، دسترسی به کل کاتالوگ را باز می‌کند.'
      }
      if (['orders', 'supply-requests', 'audit-logs'].includes(source.slug)) {
        action = collection.slug === 'users'
          ? 'برای توقف دسترسی، به‌جای حذف حساب مشتری را مسدود کنید.'
          : 'برای خروج از چرخهٔ کار، به‌جای حذف رکورد را غیرفعال کنید.'
      }
      throw businessError('این رکورد در «' + label + '»' + identifier + ' استفاده شده است. ' + action, 'REFERENCE_IN_USE')
    }
  }
}

export function protectBusinessRelations(collections: CollectionConfig[]): CollectionConfig[] {
  for (const collection of collections) {
    collection.hooks = { ...collection.hooks, beforeDelete: [protectReferencedDocument, ...(collection.hooks?.beforeDelete ?? [])] }
  }
  return collections
}
