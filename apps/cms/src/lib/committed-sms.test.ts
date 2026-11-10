import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Payload, PayloadRequest } from 'payload'
import { installCommittedSms, sendAfterCommit } from './committed-sms'

test('SMS belongs to the owning transaction; rollback, failed commit and failed send are contained', async () => {
  const sent: string[] = []
  let failCommit = false
  const payload = {
    db: {
      commitTransaction: async () => { if (failCommit) throw new Error('commit failed') },
      rollbackTransaction: async () => {},
    }, logger: { error: () => {} },
  } as unknown as Payload
  const req = (id: string) => ({ payload, transactionID: Promise.resolve(id) }) as unknown as PayloadRequest
  installCommittedSms(payload)
  installCommittedSms(payload)
  await sendAfterCommit(req('one'), 'event', async () => { sent.push('one') })
  assert.deepEqual(Array.from(sent), [])
  await payload.db.commitTransaction('other')
  assert.deepEqual(Array.from(sent), [])
  await payload.db.commitTransaction('one')
  await payload.db.commitTransaction('one')
  assert.deepEqual(Array.from(sent), ['one'])
  await sendAfterCommit(req('rollback'), 'event', async () => { sent.push('rollback') })
  await payload.db.rollbackTransaction('rollback')
  await payload.db.commitTransaction('rollback')
  assert.deepEqual(Array.from(sent), ['one'])
  await sendAfterCommit(req('failure'), 'event', async () => { sent.push('failure') })
  failCommit = true
  await assert.rejects(payload.db.commitTransaction('failure'))
  failCommit = false
  await payload.db.commitTransaction('failure')
  assert.deepEqual(Array.from(sent), ['one'])
  await sendAfterCommit(req('provider'), 'bad', async () => { throw new Error('provider failed') })
  await sendAfterCommit(req('provider'), 'good', async () => { sent.push('good') })
  await payload.db.commitTransaction('provider')
  assert.deepEqual(Array.from(sent), ['one', 'good'])
})
