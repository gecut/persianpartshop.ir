import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { getOrderTransaction } from '../collections/orders/_transaction'

/** One database sequence for orders and supply requests, including concurrent creates. */
export async function nextTrackingNumber(req: PayloadRequest): Promise<number> {
  const db = await getOrderTransaction(req)
  const result = await db.execute(sql`SELECT nextval('customer_tracking_number_seq')::text AS number`)
  const number = Number(result.rows[0]?.number)
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('شمارهٔ پیگیری خارج از محدودهٔ مجاز است.')
  return number
}
