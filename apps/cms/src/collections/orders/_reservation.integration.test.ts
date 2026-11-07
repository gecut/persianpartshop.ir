import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { sql } from '@payloadcms/db-postgres'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import type { PayloadRequest } from 'payload'
import { replaceWarehouseStock, restoreWarehouseStock } from '../warehouse-stock/_stock-operations'
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
      DROP TABLE IF EXISTS warehouse_stock, warehouses, products, orders;
      CREATE TABLE warehouses (id integer PRIMARY KEY, is_active boolean NOT NULL);
      CREATE TABLE warehouse_stock (id serial UNIQUE, warehouse_id integer, product_id integer, inventory_sqm numeric NOT NULL CHECK (inventory_sqm >= 0), revision integer DEFAULT 0, updated_at timestamptz, PRIMARY KEY (warehouse_id, product_id));
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
      await db.execute(sql`TRUNCATE warehouse_stock, warehouses, products, orders`)
      await db.execute(sql`INSERT INTO warehouses VALUES (1, true), (2, true)`);
      await db.execute(sql`INSERT INTO warehouse_stock (warehouse_id, product_id, inventory_sqm) VALUES (1, 1, 10), (1, 2, 1), (2, 1, 100)`);
      await db.execute(sql`INSERT INTO products VALUES (1, 'one', 10, 10, 1, now()), (2, 'two', 1, 1, 1, now())`)
      await db.execute(sql`INSERT INTO orders VALUES (1, 'pending')`)
    }
    const balance = async () => (await db.execute(sql`SELECT inventory_sqm::text AS area FROM warehouse_stock WHERE warehouse_id = 1 AND product_id = 1`)).rows[0]?.area
    const item = { product: 1, cartonCount: 6, deliverableArea: 6 }

    await suite.test('concurrent reservations cannot oversell', async () => {
      await reset()
      const reserve = () => db.transaction(async (tx) => {
        await apply(request(tx), { operation: 'create', data: { warehouse: 1, items: [item] } })
      })
      const results = await Promise.allSettled([reserve(), reserve()])
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1, results.map(result => result.status === 'rejected' ? String(result.reason?.cause ?? result.reason) : 'ok').join(' | '))
      assert.equal(Number(await balance()), 4)
    })

    await suite.test('warehouse isolation and stale absolute imports', async () => {
      await reset()
      await db.transaction(async tx => { await apply(request(tx), { operation: 'create', data: { warehouse: 1, items: [item] } }) })
      assert.equal(Number((await db.execute(sql`SELECT inventory_sqm FROM warehouse_stock WHERE warehouse_id = 2 AND product_id = 1`)).rows[0]?.inventory_sqm), 100)
      await assert.rejects(db.transaction(async tx => replaceWarehouseStock(request(tx), 1, 1, 100, 0)))
      assert.equal(Number(await balance()), 4)
      await db.execute(sql`UPDATE warehouses SET is_active = false WHERE id = 1`)
      await assert.rejects(db.transaction(async tx => apply(request(tx), { operation: 'create', data: { warehouse: 1, items: [item] } })))
      await db.transaction(async tx => restoreWarehouseStock(request(tx), 1, [{ productId: 1, deliverableArea: 6 }]))
      assert.equal(Number(await balance()), 10)
    })

    await suite.test('second-item failure rolls back earlier deduction', async () => {
      await reset()
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), { operation: 'create', data: { warehouse: 1, items: [item, { ...item, product: 2 }] } })
      }))
      assert.equal(Number(await balance()), 10)
    })

    await suite.test('failure after reservation rolls back all deductions', async () => {
      await reset()
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), { operation: 'create', data: { warehouse: 1, items: [item] } })
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
          originalDoc: { warehouse: 1, id: 1, status: 'pending', items: [item] },
        })
        await tx.execute(sql`UPDATE orders SET status = 'cancelled_by_admin' WHERE id = 1`)
      })
      const results = await Promise.allSettled([cancel(), cancel()])
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1, results.map(result => result.status === 'rejected' ? String(result.reason?.cause ?? result.reason) : 'ok').join(' | '))
      assert.equal(Number(await balance()), 16)
    })

    await suite.test('stale approval cannot overwrite cancellation', async () => {
      await reset()
      await db.execute(sql`UPDATE orders SET status = 'cancelled_by_admin' WHERE id = 1`)
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), {
          operation: 'update', data: { status: 'approve' },
          originalDoc: { warehouse: 1, id: 1, status: 'pending', items: [item] },
        })
      }))
      assert.equal(Number(await balance()), 10)
    })

    await suite.test('missing restoration target aborts cancellation', async () => {
      await reset()
      await assert.rejects(db.transaction(async (tx) => {
        await apply(request(tx), {
          operation: 'update', data: { status: 'cancelled_by_admin' },
          originalDoc: { warehouse: 1, id: 1, status: 'pending', items: [{ ...item, product: 999 }] },
        })
        await tx.execute(sql`UPDATE orders SET status = 'cancelled_by_admin' WHERE id = 1`)
      }))
      assert.equal((await db.execute(sql`SELECT status FROM orders WHERE id = 1`)).rows[0]?.status, 'pending')
    })
  } finally {
    await db.$client.end()
  }
})
