import { sql } from '@payloadcms/db-postgres'
import type { CollectionBeforeOperationHook } from 'payload'
import { getOrderTransaction } from './_transaction'

export const lockOrderBeforeOperation: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'update' || !('id' in args)) return

  const id = Number(args.id)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid order ID')

  const transaction = await getOrderTransaction(req)
  await transaction.execute(sql`SELECT "id" FROM "orders" WHERE "id" = ${id} FOR UPDATE`)
}
