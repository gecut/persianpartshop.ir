import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isOperationalStaff, canUpdateOperationalPrice, canUpdateOperationalInventory, isImportExportAuthorized } from './_product-access'

test('operational staff includes superadmin, manager, support and excludes editor, service, inactive', () => {
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'superadmin' }), true)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'manager' }), true)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'support' }), true)

  assert.equal(isOperationalStaff({ collection: 'admins', role: 'editor' }), false)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'service' }), false)
  assert.equal(isOperationalStaff({ collection: 'admins', role: 'superadmin', isActive: false }), false)
  assert.equal(isOperationalStaff(null), false)
  assert.equal(isOperationalStaff({}), false)
})

test('canUpdateOperationalPrice allows operational staff and blocks others', () => {
  assert.equal(canUpdateOperationalPrice({ req: { user: { collection: 'admins', role: 'support' } } } as any), true)
  assert.equal(canUpdateOperationalPrice({ req: { user: { collection: 'admins', role: 'editor' } } } as any), false)
})

test('canUpdateOperationalInventory allows only operational staff (no maintenance window)', () => {
  assert.equal(canUpdateOperationalInventory({ req: { user: { collection: 'admins', role: 'support' } } } as any), true)
  assert.equal(canUpdateOperationalInventory({ req: { user: { collection: 'admins', role: 'manager' } } } as any), true)
  assert.equal(canUpdateOperationalInventory({ req: { user: { collection: 'admins', role: 'superadmin' } } } as any), true)

  // Unauthorized roles are always blocked
  assert.equal(canUpdateOperationalInventory({ req: { user: { collection: 'admins', role: 'editor' } } } as any), false)
  assert.equal(canUpdateOperationalInventory({ req: { user: null } } as any), false)
})

test('isImportExportAuthorized allows only operational staff', () => {
  assert.equal(isImportExportAuthorized({ req: { user: { collection: 'admins', role: 'support' } } } as any), true)
  assert.equal(isImportExportAuthorized({ req: { user: { collection: 'admins', role: 'editor' } } } as any), false)
  assert.equal(isImportExportAuthorized({ req: { user: { collection: 'admins', role: 'service' } } } as any), false)
})
