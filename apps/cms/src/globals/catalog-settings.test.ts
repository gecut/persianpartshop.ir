import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultCatalogSettings } from '@persianpart/contract/public-catalog'
import { validateCatalogSave, CatalogSettingsGlobal } from './catalog-settings.global'
import type { Access } from 'payload'

test('catalog percentage confirmation is single use and compares the server document', () => {
  const original = defaultCatalogSettings(), policy = defaultCatalogSettings()
  policy.pricing.percentage = 10
  assert.equal(validateCatalogSave({ policy }, original, 7).lastEditedBy, 7)
  policy.pricing.percentage = 10.01
  assert.throws(() => validateCatalogSave({ policy }, original, 7), /تأیید/)
  const saved = validateCatalogSave({ policy, confirmPriceChange: true, lastEditedBy: 999 }, original, 7)
  assert.equal(saved.confirmPriceChange, false)
  assert.equal(saved.lastEditedBy, 7)
  const next = { ...policy, pricing: { ...policy.pricing, percentage: 30 } }
  assert.throws(() => validateCatalogSave({ policy: next, confirmPriceChange: saved.confirmPriceChange }, policy, 7), /تأیید/)
  assert.throws(() => validateCatalogSave({ policy: { pricing: { percentage: -100 } } }, original, 7))
})
test('new Global permissions and versions do not permit public or support access', async () => {
  const check = async (access: Access | undefined, role: string | null) => access?.({ req: { user: role ? { collection: 'admins', id: 1, isActive: true, role } : null } } as Parameters<Access>[0])
  for (const role of [null, 'support', 'editor']) {
    assert.equal(await check(CatalogSettingsGlobal.access?.read, role), false)
    assert.equal(await check(CatalogSettingsGlobal.access?.update, role), false)
  }
  for (const role of ['manager', 'superadmin']) assert.equal(await check(CatalogSettingsGlobal.access?.update, role), true)
  assert.equal(await check(CatalogSettingsGlobal.access?.read, 'service'), true)
  assert.equal(await check(CatalogSettingsGlobal.access?.update, 'service'), false)
})
