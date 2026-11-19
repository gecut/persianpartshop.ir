import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Payload } from 'payload'
import { processSmsQueueTick, type ClaimedSmsJob } from './queue-worker'

const job = (id: number, attempts = 0): ClaimedSmsJob => ({ id, receptor: '09120000000', template: 'otp', tokens: '{"token":"1234"}', attempts })

function fakePayload() {
  const updates: Array<{ id: number; data: Record<string, unknown> }> = []
  const payload = {
    update: async ({ id, data }: { id: number; data: Record<string, unknown> }) => { updates.push({ id, data }) },
    logger: { error: () => {} },
  } as unknown as Payload
  return { payload, updates }
}

test('sends only claimed jobs with at most three in flight', async () => {
  const { payload, updates } = fakePayload()
  let inFlight = 0
  let peak = 0
  const sent: number[] = []
  const count = await processSmsQueueTick(payload, {
    claim: async (_payload, limit) => { assert.equal(limit, 10); return [1, 2, 3, 4, 5, 6, 7].map(id => job(id)) },
    send: (async (params: { tokens: unknown; receptor: string }) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      assert.deepEqual(params.tokens, { token: '1234' })
      await new Promise(resolve => setTimeout(resolve, 5))
      sent.push(sent.length)
      inFlight--
      return { success: true }
    }) as never,
  })
  assert.equal(count, 7)
  assert.equal(peak, 3)
  assert.equal(sent.length, 7)
  assert.deepEqual(updates.map(update => update.id).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7])
  assert.ok(updates.every(update => update.data.status === 'sent' && update.data.attempts === 1))
})

test('schedules one retry, then marks the job failed', async () => {
  const { payload, updates } = fakePayload()
  const failing = (async () => { throw new Error('provider down') }) as never
  await processSmsQueueTick(payload, { claim: async () => [job(1, 0), job(2, 1)], send: failing })
  const byId = new Map(updates.map(update => [update.id, update.data]))
  assert.equal(byId.get(1)?.status, 'retry_scheduled')
  assert.equal(byId.get(1)?.attempts, 1)
  assert.equal(typeof byId.get(1)?.nextRetryAt, 'string')
  assert.equal(byId.get(2)?.status, 'failed')
  assert.equal(byId.get(2)?.lastError, 'provider down')
})

test('a failed status write is logged once, is not retried as a send failure and does not stop other jobs', async () => {
  const errors: unknown[] = []
  const updates: number[] = []
  const payload = {
    update: async ({ id }: { id: number }) => { if (id === 1) throw new Error('db down'); updates.push(id) },
    logger: { error: (entry: unknown) => { errors.push(entry) } },
  } as unknown as Payload
  const count = await processSmsQueueTick(payload, { claim: async () => [job(1), job(2)], send: (async () => ({ success: true })) as never })
  assert.equal(count, 2)
  assert.deepEqual(updates, [2])
  assert.equal(errors.length, 1)
})
