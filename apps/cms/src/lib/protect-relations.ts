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

export const protectReferencedDocument: CollectionBeforeDeleteHook = async ({ id, collection, req }) => {
  for (const source of req.payload.config.collections) {
    if (source.slug.startsWith('payload-')) continue
    const paths = references(source.fields, collection.slug)
    if (!paths.length) continue
    const result = await req.payload.find({
      collection: source.slug, where: { or: paths.map(path => ({ [path]: { equals: id } })) },
      limit: 1, depth: 0, req, overrideAccess: true,
    })
    if (!result.totalDocs) continue
    const doc = result.docs[0]
    const label = typeof source.labels.singular === 'string' ? source.labels.singular : source.slug
    const title = doc && ('trackingNumber' in doc ? doc.trackingNumber : 'name' in doc ? doc.name : doc.id)
    const history = ['orders', 'supply-requests', 'audit-logs'].includes(source.slug)
    const action = history
      ? 'این سابقه قابل حذف نیست؛ به‌جای حذف، رکورد را غیرفعال کنید.'
      : 'ابتدا این ارتباط را از رکورد وابسته بردارید یا رکورد وابسته را در صورت مجازبودن حذف کنید.'
    throw businessError('این رکورد در «' + label + '» با شناسهٔ ' + String(title ?? id) + ' استفاده شده است؛ ' + action, 'REFERENCE_IN_USE')
  }
}

export function protectBusinessRelations(collections: CollectionConfig[]): CollectionConfig[] {
  for (const collection of collections) {
    collection.hooks = { ...collection.hooks, beforeDelete: [protectReferencedDocument, ...(collection.hooks?.beforeDelete ?? [])] }
  }
  return collections
}
