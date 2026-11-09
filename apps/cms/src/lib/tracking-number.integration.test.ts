import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { sql, type MigrateUpArgs, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { up } from '../migrations/20261109_160000_shared_tracking_numbers'
import { nextTrackingNumber } from './tracking-number'

const require = createRequire(import.meta.url)
const pg = require(require.resolve('pg', { paths: [require.resolve('@payloadcms/db-postgres')] })) as PostgresAdapter['pg']

test('shared tracking: historical order, concurrent allocation and rollback gaps', { skip: !process.env.TRACKING_TEST_CONTROL_URI }, async () => {
  const uri = new URL(process.env.TRACKING_TEST_CONTROL_URI!)
  assert.ok(['localhost', '127.0.0.1'].includes(uri.hostname))
  assert.equal(uri.pathname, '/postgres')
  const name = `tracking_test_${randomUUID().replaceAll('-', '')}`
  const control = new pg.Pool({ connectionString: uri.href })
  uri.pathname = `/${name}`
  const pool = new pg.Pool({ connectionString: uri.href })
  const db = drizzle(pool)
  try {
    await control.query(`CREATE DATABASE "${name}"`)
    await db.execute(sql`
      CREATE TABLE orders (id serial PRIMARY KEY, order_number text, created_at timestamptz);
      CREATE TABLE supply_requests (id serial PRIMARY KEY, request_number text, created_at timestamptz);
      INSERT INTO orders (order_number, created_at) VALUES ('ptp 42', '2026-01-01'), ('PP-old', '2026-01-03');
      INSERT INTO supply_requests (request_number, created_at) VALUES ('SPR-legacy-uuid', '2026-01-02');
    `)
    await db.transaction(tx => up({ db: tx } as unknown as MigrateUpArgs))
    assert.deepEqual((await pool.query('SELECT tracking_number::int AS n FROM orders ORDER BY id')).rows, [{ n: 1 }, { n: 3 }])
    assert.equal((await pool.query('SELECT tracking_number::int AS n, request_number FROM supply_requests')).rows[0].n, 2)
    assert.equal((await pool.query('SELECT request_number FROM supply_requests')).rows[0].request_number, 'SPR-legacy-uuid')
    const allocate = () => db.transaction(async tx => {
      const req = { transactionID: 'tx', payload: { db: { name: 'postgres', sessions: { tx: { db: tx } } } } } as unknown as PayloadRequest
      return nextTrackingNumber(req)
    })
    const concurrent = await Promise.all(Array.from({ length: 40 }, allocate))
    assert.deepEqual(concurrent.sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 4))
    await assert.rejects(db.transaction(async tx => {
      await tx.execute(sql`SELECT nextval('customer_tracking_number_seq')`)
      throw new Error('rollback')
    }), /rollback/)
    assert.equal(await allocate(), 45)
    assert.equal(Number((await pool.query("SELECT nextval('customer_tracking_number_seq') AS n")).rows[0].n), 46)
    await assert.rejects(pool.query("INSERT INTO orders (tracking_number) VALUES (1)"), /unique/)
  } finally {
    await pool.end()
    await control.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    await control.end()
  }
})
