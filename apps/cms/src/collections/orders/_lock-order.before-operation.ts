import { validateTransitionBeforeChange } from './_validate-transition.before-change'
import { businessError } from '../../lib/validation'
import { sql } from '@payloadcms/db-postgres'
import type { CollectionBeforeOperationHook } from 'payload'
import { getOrderTransaction } from './_transaction'

export const lockOrderBeforeOperation: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'update') return
  if (!('id' in args)) throw businessError('ویرایش گروهی سفارش مجاز نیست.', 'BULK_UPDATE_FORBIDDEN')

  const id = Number(args.id)
  if (!Number.isSafeInteger(id) || id <= 0) throw businessError('شناسه سفارش نامعتبر است.', 'INVALID_INPUT', 400)

  const transaction = await getOrderTransaction(req)
  await transaction.execute(sql`SELECT "id" FROM "orders" WHERE "id" = ${id} FOR UPDATE`)
  // Inspect the original input before field access removes protected fields.
  const originalDoc = await req.payload.findByID({ collection: 'orders', id, req, depth: 0, overrideAccess: true })
  await validateTransitionBeforeChange({ data: { ...args.data }, originalDoc, operation: 'update', req, context: req.context, collection: req.payload.collections.orders.config })
}
