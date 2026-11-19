import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ValidationError } from 'payload'
import { validateUserChanges } from './_validate-user.before-change'

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
