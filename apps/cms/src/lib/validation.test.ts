import assert from 'node:assert/strict'
import { test } from 'node:test'
import { APIError, ValidationError } from 'payload'
import { fieldError, businessError, describeDeleteConflict } from './validation'

test('expected errors are public and field errors preserve field location', () => {
  assert.throws(() => fieldError('items.0.requestedArea', 'مقدار نامعتبر است.'), error => error instanceof ValidationError && error.data.errors[0]?.path === 'items.0.requestedArea')
  const error = businessError('وابستگی وجود دارد.', 'REFERENCE_IN_USE')
  assert.ok(error instanceof APIError)
  assert.equal(error.isPublic, true)
  assert.equal(error.status, 409)
})

test('a deletion FK race becomes a public dependency conflict', async () => {
  const response = await describeDeleteConflict({ error: new Error('query failed', { cause: { code: '23503' } }), req: { method: 'DELETE' } } as unknown as Parameters<typeof describeDeleteConflict>[0])
  assert.equal(response?.status, 409)
  const untouched = await describeDeleteConflict({ error: new Error('internal'), req: { method: 'PATCH' } } as unknown as Parameters<typeof describeDeleteConflict>[0])
  assert.equal(untouched, undefined)
})
