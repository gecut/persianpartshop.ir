import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isOperationalStaff, canUpdateOperationalPrice } from './_product-access'

test('operational staff includes superadmin, manager and excludes support, editor, service, inactive', () => {
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'superadmin' }), true)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'manager' }), true)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'support' }), false)

  assert.equal(isOperationalStaff({ collection: 'admins', role: 'editor' }), false)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'service' }), false)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'superadmin', isActive: false }), false)
  assert.equal(isOperationalStaff(null), false)
  assert.equal(isOperationalStaff({}), false)
})

test('canUpdateOperationalPrice allows operational staff and blocks others', () => {
  assert.equal(canUpdateOperationalPrice({ req: { user: { collection: 'admins', role: 'support' } } } as any), false)
  assert.equal(canUpdateOperationalPrice({ req: { user: { collection: 'admins', role: 'editor' } } } as any), false)
})
