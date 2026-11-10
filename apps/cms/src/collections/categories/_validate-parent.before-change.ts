import type { CollectionBeforeChangeHook } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { fieldError, relationId } from '../../lib/validation'
import { getOrderTransaction } from '../orders/_transaction'

export const validateCategoryParent: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (data.parent === undefined || data.parent === null) return data
  const id = Number(originalDoc?.id ?? 0)
  const parent = Number(relationId(data.parent))
  if (!Number.isSafeInteger(parent) || parent <= 0 || parent === id) fieldError('parent', 'دسته‌بندی نمی‌تواند والد خودش باشد؛ والد معتبر انتخاب کنید.')
  const db = await getOrderTransaction(req)
  // All parent changes share one transaction lock, preventing concurrent A -> B / B -> A.
  await db.execute(sql`SELECT pg_advisory_xact_lock(98071)`)
  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, ARRAY[id] AS visited FROM categories WHERE id = ${parent}
      UNION ALL SELECT c.id, c.parent_id, a.visited || c.id FROM categories c JOIN ancestors a ON c.id = a.parent_id WHERE NOT c.id = ANY(a.visited)
    ) SELECT id FROM ancestors WHERE id = ${id}
  `)
  if (result.rows.length) fieldError('parent', 'انتخاب این والد باعث چرخه در دسته‌بندی‌ها می‌شود.')
  return data
}
