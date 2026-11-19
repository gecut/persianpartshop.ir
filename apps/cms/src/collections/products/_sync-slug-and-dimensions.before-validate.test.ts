import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ValidationError } from 'payload'
import { syncSlugAndDimensions } from './_sync-slug-and-dimensions.before-validate'

test('invalid carton factors are field errors; they are never rounded into zero', async () => {
  for (const sqmPerCarton of [0, null, 0.001, 1.234, -1, Infinity]) {
    await assert.rejects(syncSlugAndDimensions({ data: { sku: 'X', productType: 'tile', sqmPerCarton }, operation: 'create', req: {} } as unknown as Parameters<typeof syncSlugAndDimensions>[0]), error => error instanceof ValidationError && error.data.errors[0]?.path === 'sqmPerCarton')
  }
})
