import assert from 'node:assert/strict'
import test from 'node:test'
import type { PayloadRequest } from 'payload'
import { canManageQr } from './_access'

const req = (user: unknown) => ({ user }) as unknown as PayloadRequest
const admin = (role: string, extra: object = {}) => ({ collection: 'admins', role, isActive: true, ...extra })

test('only active managers and superadmins manage qr codes', () => {
  assert.equal(canManageQr(req(admin('manager'))), true)
  assert.equal(canManageQr(req(admin('superadmin'))), true)
  for (const role of ['editor', 'support', 'service']) assert.equal(canManageQr(req(admin(role))), false, role)
  assert.equal(canManageQr(req(admin('manager', { isActive: false }))), false)
  assert.equal(canManageQr(req({ collection: 'users', role: 'manager' })), false)
  assert.equal(canManageQr(req(null)), false)
})
