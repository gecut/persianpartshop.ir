import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PayloadSDKError } from '@payloadcms/sdk'
import { createCatalogCMSClient, isCatalogNotFound } from './catalog-cms'

test('the real Payload SDK authenticates the direct CMS read and preserves cache options', async () => {
  let called = false
  const sdk = createCatalogCMSClient({
    baseURL: 'http://cms.internal:5174/api/',
    apiKey: 'fixture-key',
    fetch: async (input, init) => {
      called = true
      assert.equal(input, 'http://cms.internal:5174/api/catalog/bootstrap')
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'admins API-Key fixture-key',
      )
      assert.equal(init?.credentials, 'omit')
      assert.equal(init?.cache, 'force-cache')
      assert.equal(init?.body, '{}')
      assert.equal(init?.method, 'POST')
      assert.ok(init?.signal)
      return Response.json({ state: 'paused' })
    },
  })
  await sdk.request({
    path: '/catalog/bootstrap',
    method: 'POST',
    json: {},
    init: { cache: 'force-cache' },
  })
  assert(called)
  assert.throws(
    () => createCatalogCMSClient({ baseURL: 'http://cms/api', apiKey: '' }),
    /CMS_API_KEY/,
  )
})
test('a missing CMS endpoint is infrastructure failure, not product not-found', () => {
  const error = (errors: { message: string; code?: string }[]) =>
    new PayloadSDKError({
      status: 404,
      errors,
      message: 'not found',
      response: new Response(null, { status: 404 }),
    })
  assert.equal(
    isCatalogNotFound(error([{ message: 'Route not found' }])),
    false,
  )
  assert.equal(
    isCatalogNotFound(
      error([{ message: 'Product absent', code: 'CATALOG_NOT_FOUND' }]),
    ),
    true,
  )
})
