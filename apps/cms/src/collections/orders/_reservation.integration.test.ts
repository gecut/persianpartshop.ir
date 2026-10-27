import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { sql } from '@payloadcms/db-postgres'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import type { PayloadRequest } from 'payload'
import { applyReservationBeforeChange } from './_apply-reservation.before-change'

const connectionString = process.env.CMS_TEST_DATABASE_URI

function request(db: unknown): PayloadRequest {
  const transactionID = randomUUID()
  return {
    transactionID,
    payload: { db: { name: 'postgres', sessions: { [transactionID]: { db } } } },
  } as unknown as PayloadRequest
}

async function apply(req: PayloadRequest, options: Record<string, unknown>) {
  return applyReservationBeforeChange({ req, ...options } as Parameters<typeof applyReservationBeforeChange>[0])
}

test('PostgreSQL reservation atomicity and cancellation races', { skip: !connectionString }, async (suite) => {
  const uri = new URL(connectionString!)
  assert.equal(uri.hostname, '127.0.0.1')
  assert.equal(uri.pathname, '/cms_hardening_test')
  assert.ok(uri.port)
  const db = drizzle(connectionString!)
  try {
    await db.execute(sql`
      DROP TABLE IF EXISTS products, orders;
      CREATE TABLE products (
        id integer PRIMARY KEY,
        name text,
        stock_cartons numeric NOT NULL,
        inventory_sqm numeric NOT NULL,
        sqm_per_carton numeric DEFAULT 1 NOT NULL,
        updated_at timestamptz
      );
      CREATE TABLE orders (
        id integer PRIMARY KEY,
        status text NOT NULL
      );
    `)

    const reset = async () => {
      await db.execute(sql`TRUNCATE products, orders`)
      await db.execute(sql`INSERT INTO products VALUES (1, 'one', 10, 10, 1, now()), (2, 'two', 1, 1, 1, now())`)
      await db.execute(sql`INSERT INTO orders VALUES (1, 'pending')`)
    }
    const balance = async () => (await db.execute(sql`SELECT inventory_sqm::text AS area FROM products WHERE id = 1`)).rows[0]?.area
    const item = { product: 1, cartonCount: 6, deliverableArea: 6 }

    await suite.test('concurrent reservations cannot oversell', async () => {
      await reset()
      const reserve = () => db.transaction(async (tx) => {
        await apply(request(tx), { operation: 'create', data: { items: [item] } })
      })
      const results = await Promise.allSettled([reserve(), reserve()])
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
      assert.equal(Number(await balance()), 4)
    })

    await suite.test('second-item failure rolls back earlier deduction', async () => {
      await reset()
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), { operation: 'create', data: { items: [item, { ...item, product: 2 }] } })
      }))
      assert.equal(Number(await balance()), 10)
    })

    await suite.test('failure after reservation rolls back all deductions', async () => {
      await reset()
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), { operation: 'create', data: { items: [item] } })
        throw new Error('injected order persistence failure')
      }))
      assert.equal(Number(await balance()), 10)
    })

    await suite.test('stale concurrent cancellation restores once', async () => {
      await reset()
      const cancel = () => db.transaction(async (tx) => {
        await apply(request(tx), {
          operation: 'update',
          data: { status: 'cancelled_by_admin' },
          originalDoc: { id: 1, status: 'pending', items: [item] },
        })
        await tx.execute(sql`UPDATE orders SET status = 'cancelled_by_admin' WHERE id = 1`)
      })
      const results = await Promise.allSettled([cancel(), cancel()])
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
      assert.equal(Number(await balance()), 16)
    })

    await suite.test('stale approval cannot overwrite cancellation', async () => {
      await reset()
      await db.execute(sql`UPDATE orders SET status = 'cancelled_by_admin' WHERE id = 1`)
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), {
          operation: 'update', data: { status: 'approve' },
          originalDoc: { id: 1, status: 'pending', items: [item] },
        })
      }))
      assert.equal(Number(await balance()), 10)
    })

    await suite.test('missing restoration target aborts cancellation', async () => {
      await reset()
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), {
          operation: 'update', data: { status: 'cancelled_by_admin' },
          originalDoc: { id: 1, status: 'pending', items: [{ ...item, product: 999 }] },
        })
        await tx.execute(sql`UPDATE orders SET status = 'cancelled_by_admin' WHERE id = 1`)
      }))
      assert.equal((await db.execute(sql`SELECT status FROM orders WHERE id = 1`)).rows[0]?.status, 'pending')
    })
  } finally {
    await db.$client.end()
  }
})
