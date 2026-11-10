import type { CollectionAfterChangeHook } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getOrderTransaction } from '../orders/_transaction'

export const syncProductDimensions: CollectionAfterChangeHook = async ({ doc, req, previousDoc, operation }) => {
  if (operation !== 'update' || (doc.width === previousDoc.width && doc.height === previousDoc.height)) return doc
  const db = await getOrderTransaction(req)
  // Same dimension -> product lock order as product writes; no recursive product hooks.
  await db.execute(sql`UPDATE products SET width = ${doc.width}, height = ${doc.height}, updated_at = NOW() WHERE dimension_id = ${doc.id}`)
  return doc
}
