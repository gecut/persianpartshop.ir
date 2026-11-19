import type { PostgresAdapter } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

type TransactionDb = Pick<PostgresAdapter['drizzle'], 'execute'>

export const getTransactionDb = async (req: PayloadRequest): Promise<TransactionDb> => {
  const transactionID = await req.transactionID
  if (req.payload.db.name !== 'postgres' || transactionID == null) {
    throw new Error('Order inventory requires an active PostgreSQL transaction.')
  }
  const session = req.payload.db.sessions?.[transactionID]
  if (!session?.db || typeof session.db !== 'object' ||
    !('execute' in session.db) || typeof session.db.execute !== 'function') {
    throw new Error('Order inventory requires an active PostgreSQL transaction.')
  }
  return session.db as TransactionDb
}
