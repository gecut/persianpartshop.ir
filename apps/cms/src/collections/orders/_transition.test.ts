import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateTransitionBeforeChange } from './_validate-transition.before-change'

const original = {
  id: 1, status: 'pending', user: 7, warehouse: 1, orderNumber: '123',
  idempotencyKey: 'retry', trackingNumber: 123,
  items: [{ id: 'line', product: 2, requestedArea: 1, cartonCount: 1, deliverableArea: 1, unitPrice: 100, totalPrice: 100 }],
  timeline: [], notes: '', deliveryAddress: 'address',
}
const apply = (data: Record<string, unknown>, doc: Record<string, unknown> = original) => validateTransitionBeforeChange({
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

test('a form echo may reformat timestamps and generate row IDs without changing history', async () => {
  const doc = { ...original, timeline: [{ id: 'stored-row', status: 'pending', timestamp: '2026-11-10T08:30:00.000Z' }] }
  const echo = [{ id: 'form-row', status: 'pending', timestamp: '2026-11-10T12:00:00+03:30' }]
  const saved = await apply({ notes: 'note', timeline: echo }, doc)
  assert.deepEqual(saved.timeline, doc.timeline, 'the original row identity and timestamp must be retained')
  const approved = await apply({ status: 'approve', timeline: echo }, doc)
  assert.deepEqual(approved.timeline[0], doc.timeline[0])
  assert.equal(approved.timeline.length, 2)
  assert.equal(approved.timeline[1].status, 'approve')
})

test('equivalent ISO precision and missing form row IDs do not block status changes', async () => {
  const doc = { ...original, timeline: [{ id: 'stored-row', status: 'pending', timestamp: '2026-11-10T08:30:00.000Z' }] }
  await apply({ status: 'approve', timeline: [{ status: 'pending', timestamp: '2026-11-10T08:30:00Z' }] }, doc)
  const legacy = { ...original, timeline: [{ id: 'legacy-row', status: null, timestamp: null }] }
  const result = await apply({ status: 'approve', timeline: [{ status: '', timestamp: '' }] }, legacy)
  assert.deepEqual(result.timeline[0], legacy.timeline[0])
})

test('history status, time, order and event count cannot be changed through a form echo', async () => {
  const timeline = [
    { id: 'first', status: 'pending', timestamp: '2026-11-10T08:30:00.000Z' },
    { id: 'second', status: 'approve', timestamp: '2026-11-10T09:30:00.000Z' },
  ]
  const doc = { ...original, status: 'approve', timeline }
  for (const incoming of [
    [{ ...timeline[0], status: 'completed' }, timeline[1]],
    [{ ...timeline[0], timestamp: '2026-11-10T08:31:00.000Z' }, timeline[1]],
    [timeline[1], timeline[0]], [], [...timeline, { status: 'completed' }],
  ]) await assert.rejects(apply({ status: 'completed', timeline: incoming }, doc))
})
