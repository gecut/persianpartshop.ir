import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PayloadRequest } from 'payload'
import { applyReservationBeforeChange } from './_apply-reservation.before-change'
import { getOrderTransaction } from './_transaction'

const item = { product: 1, cartonCount: 2, deliverableArea: 3 }

const fixture = (responses: Array<Array<Record<string, unknown>>> = [[{ id: 1 }]]) => {
  const queries: unknown[] = []
  const lookups: unknown[] = []
  const db = {
    execute: async (query: unknown) => {
      queries.push(query)
      return { rows: responses.shift() ?? [] }
    },
  }
  const req = {
    transactionID: Promise.resolve('transaction'),
    payload: {
      db: { name: 'postgres', sessions: { transaction: { db } } },
      findByID: async (args: unknown) => {
        lookups.push(args)
        return { name: 'sample', stockCartons: 0, inventorySqm: 0 }
      },
    },
  } as unknown as PayloadRequest
  const apply = (options: Record<string, unknown>) => applyReservationBeforeChange({
    req, ...options,
  } as Parameters<typeof applyReservationBeforeChange>[0])
  return { req, db, queries, lookups, apply }
}

test('requires active PostgreSQL session without root fallback', async () => {
  for (const db of [
    { name: 'sqlite', sessions: { transaction: { db: { execute() {} } } } },
    { name: 'postgres', drizzle: { execute() { assert.fail('root fallback') } } },
    { name: 'postgres', sessions: { transaction: { db: {} } } },
  ]) {
    const req = { transactionID: 'transaction', payload: { db } } as unknown as PayloadRequest
    await assert.rejects(getOrderTransaction(req), /active PostgreSQL transaction/)
  }
  const { req, db } = fixture()
  assert.equal(await getOrderTransaction(req), db)
  req.transactionID = undefined
  await assert.rejects(getOrderTransaction(req), /active PostgreSQL transaction/)
})

test('validates all reservation inputs before the first write', async () => {
  for (const invalid of [0, -1, NaN, Infinity, '', null, true, {}, 'NaN']) {
    for (const field of ['product', 'cartonCount', 'deliverableArea']) {
      const { apply, queries } = fixture()
      await assert.rejects(apply({ operation: 'create', data: { items: [item, { ...item, [field]: invalid }] } }))
      assert.equal(queries.length, 0)
    }
  }
  for (const field of ['product', 'cartonCount']) {
    const { apply } = fixture()
    await assert.rejects(apply({ operation: 'create', data: { items: [{ ...item, [field]: 1.5 }] } }))
  }
})

test('reserves sorted populated and scalar product IDs', async () => {
  const { apply, queries } = fixture([[{ id: 1 }], [{ id: 2 }]])
  const data = { items: [{ ...item, product: { id: 2 } }, item] }
  assert.equal(await apply({ operation: 'create', data }), data)
  assert.equal(queries.length, 2)
})

test('failed reservation lookup receives the identical request', async () => {
  const { apply, req, lookups } = fixture([[]])
  await assert.rejects(apply({ operation: 'create', data: { items: [item] } }), /موجودی ناکافی/)
  assert.equal(lookups.length, 1)
  assert.equal((lookups[0] as { req: PayloadRequest }).req, req)
})

test('all updates reject stale locked order status before product writes', async () => {
  for (const status of ['cancelled_by_admin', 'approve', 'completed']) {
    for (const data of [{ status: 'cancelled_by_customer' }, { status: 'approve' }, { notes: 'note' }]) {
      const { apply, queries } = fixture([[{ status }]])
      await assert.rejects(apply({ operation: 'update', data, originalDoc: { id: 1, status: 'pending', items: [item] } }), /status changed/)
      assert.equal(queries.length, 1)
    }
  }
})

test('missing order and restore targets fail closed', async () => {
  for (const responses of [[[]], [[{ status: 'pending' }], []]]) {
    const { apply } = fixture(responses)
    await assert.rejects(apply({ operation: 'update', data: { status: 'cancel' }, originalDoc: { id: 1, status: 'pending', items: [item] } }))
  }
})

test('cancellation restores once and preserves normalization', async () => {
  const { apply, queries } = fixture([[{ status: 'pending' }], [{ id: 1 }]])
  const data = { status: 'cancel', cancelledBy: 'customer' }
  await apply({ operation: 'update', data, originalDoc: { id: 1, status: 'pending', items: [item] } })
  assert.equal(data.status, 'cancelled_by_customer')
  assert.equal(queries.length, 2)
  const repeated = fixture([[{ status: 'cancelled_by_customer' }]])
  await repeated.apply({ operation: 'update', data: { status: 'cancelled_by_customer' }, originalDoc: { id: 1, status: 'cancelled_by_customer', items: [item] } })
  assert.equal(repeated.queries.length, 1)
})

test('invalid restore quantities fail after order lock but before stock writes', async () => {
  for (const field of ['product', 'cartonCount', 'deliverableArea']) {
    const { apply, queries } = fixture([[{ status: 'pending' }]])
    await assert.rejects(apply({
      operation: 'update', data: { status: 'cancel' },
      originalDoc: { id: 1, status: 'pending', items: [item, { ...item, [field]: Infinity }] },
    }))
    assert.equal(queries.length, 1)
  }
})

test('preserves existing pending-only cancellation message', async () => {
  const { apply, queries } = fixture([[{ status: 'approve' }]])
  await assert.rejects(apply({ operation: 'update', data: { status: 'cancel' }, originalDoc: { id: 1, status: 'approve', items: [item] } }), /سفارش در وضعیت 'approve' قابل لغو نیست./)
  assert.equal(queries.length, 1)
})
