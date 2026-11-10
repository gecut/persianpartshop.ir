import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateTransitionBeforeChange } from './_validate-transition.before-change'

const original = {
  id: 1, status: 'pending', user: 7, warehouse: 1, orderNumber: '123',
  idempotencyKey: 'retry', trackingNumber: 123,
  items: [{ id: 'line', product: 2, requestedArea: 1, cartonCount: 1, deliverableArea: 1, unitPrice: 100, totalPrice: 100 }],
  timeline: [], notes: '', deliveryAddress: 'address',
}
const apply = (data: Record<string, unknown>, doc = original) => validateTransitionBeforeChange({
  operation: 'update', data, originalDoc: doc,
} as Parameters<typeof validateTransitionBeforeChange>[0])

test('full form accepts identical items with reordered keys and populated relations', async () => {
  const data = { status: 'approve', user: { id: 7 }, items: [{
    product: { id: 2, name: 'populated' }, totalPrice: 100, unitPrice: 100,
    deliverableArea: 1, cartonCount: 1, requestedArea: 1, id: 'line',
  }] }
  await apply(data)
})

test('terminal orders allow notes and unchanged form values, but no reopening or address change', async () => {
  for (const status of ['completed', 'cancelled_by_admin', 'cancelled_by_customer']) {
    const doc = { ...original, status }
    await apply({ ...doc, notes: 'note' }, doc)
    await assert.rejects(apply({ status: 'pending' }, doc))
    await assert.rejects(apply({ deliveryAddress: 'different' }, doc))
  }
})

test('protected values cannot be cleared or changed', async () => {
  for (const data of [{ user: null }, { orderNumber: '' }, { idempotencyKey: '' }, { items: null },
    { items: [{ ...original.items[0], requestedArea: 2 }] }, { timeline: [{ status: 'completed' }] }]) {
    await assert.rejects(apply(data))
  }
})

test('legacy cancellation is normalized before one timeline event is recorded', async () => {
  const result = await apply({ status: 'cancel', cancelledBy: 'customer' })
  assert.equal(result.status, 'cancelled_by_customer')
  assert.equal(result.cancelledBy, 'customer')
  assert.deepEqual(result.timeline.map((entry: { status: string }) => entry.status), ['cancelled_by_customer'])
  const note = await apply({ notes: 'note' })
  assert.equal(note.timeline, undefined)
})
