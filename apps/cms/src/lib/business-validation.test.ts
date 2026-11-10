import assert from 'node:assert/strict'
import { test } from 'node:test'
import { APIError, ValidationError } from 'payload'
import { syncSlugAndDimensions } from '../collections/products/_sync-slug-and-dimensions.before-validate'
import { validateUserChanges } from '../collections/users/_validate-user.before-change'
import { personalizePlanAfterRead } from '../collections/plans/_personalize-plan.after-read'
import { fieldError, businessError, describeDeleteConflict } from './validation'

test('invalid carton factors are field errors; they are never rounded into zero', async () => {
  for (const sqmPerCarton of [0, null, 0.001, 1.234, -1, Infinity]) {
    await assert.rejects(syncSlugAndDimensions({ data: { sku: 'X', productType: 'tile', sqmPerCarton }, operation: 'create', req: {} } as unknown as Parameters<typeof syncSlugAndDimensions>[0]), error => error instanceof ValidationError && error.data.errors[0]?.path === 'sqmPerCarton')
  }
})

test('approved documents survive unrelated PATCHes and all approved fields are protected from service writes', () => {
  const document = { id: 'approved', file: 1, status: 'approved', title: 'Original', documentType: 'other', uploadedAt: '2026-01-01T00:00:00Z' }
  const req = { user: { collection: 'admins', role: 'service', isActive: true } }
  const apply = (data: Record<string, unknown>) => validateUserChanges({
    data, originalDoc: { documents: [document], hideExactStock: true }, req,
  } as unknown as Parameters<typeof validateUserChanges>[0])
  const result = apply({ fullName: 'Changed', disableOrdering: false })
  assert.equal(result.disableOrdering, true)
  assert.equal(result.documents, undefined)
  for (const key of ['title', 'documentType', 'status', 'uploadedAt']) {
    assert.throws(() => apply({ documents: [{ ...document, [key]: 'changed' }] }), ValidationError)
  }
  assert.throws(() => apply({ documents: [] }), ValidationError)
})

test('plan personalization leaves raw templates unchanged', () => {
  const raw = { id: 1, title: '{{name}} title', content: '{{name}} content' }
  const result = personalizePlanAfterRead({ doc: raw, context: { name: 'مشتری' } } as unknown as Parameters<typeof personalizePlanAfterRead>[0])
  assert.equal(result.title, raw.title)
  assert.equal(result.content, raw.content)
})

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
