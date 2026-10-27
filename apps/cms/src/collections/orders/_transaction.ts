import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

type OrderTransaction = Pick<PostgresAdapter['drizzle'], 'execute'>

export const getOrderTransaction = async (req: PayloadRequest): Promise<OrderTransaction> => {
  const transactionID = await req.transactionID
  if (req.payload.db.name !== 'postgres' || transactionID == null) {
    throw new Error('Order inventory requires an active PostgreSQL transaction.')
  }
  const session = req.payload.db.sessions?.[transactionID]
  if (!session?.db || typeof session.db !== 'object' ||
    !('execute' in session.db) || typeof session.db.execute !== 'function') {
    throw new Error('Order inventory requires an active PostgreSQL transaction.')
  }
  return session.db as OrderTransaction
}
