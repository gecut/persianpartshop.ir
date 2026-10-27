import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateBasePricePerCarton,
  calculateStockCartons,
  getStockWriteMode,
  roundToTwoDecimals,
} from './_inventory-math'
import { syncSlugAndDimensions } from './_sync-slug-and-dimensions.before-validate'

test('roundToTwoDecimals handles finite and edge values', () => {
  assert.equal(roundToTwoDecimals(1.44), 1.44)
  assert.equal(roundToTwoDecimals(1.444), 1.44)
  assert.equal(roundToTwoDecimals(1.446), 1.45)
  assert.equal(roundToTwoDecimals(0), 0)
  assert.equal(roundToTwoDecimals(NaN), 0)
  assert.equal(roundToTwoDecimals(Infinity), 0)
})

test('calculateStockCartons computes integer cartons via scaled arithmetic', () => {
  // Standard cases
  assert.equal(calculateStockCartons(504, 1.44), 350)
  assert.equal(calculateStockCartons(0, 1.44), 0)
  assert.equal(calculateStockCartons(1.43, 1.44), 0)
  assert.equal(calculateStockCartons(1.44, 1.44), 1)

  // Floating point edge cases like 4.35 / 1.45 which in binary floats can yield 2.9999999999999996
  assert.equal(calculateStockCartons(4.35, 1.45), 3)

  // Boundary checks
  assert.equal(calculateStockCartons(-10, 1.44), 0)
  assert.equal(calculateStockCartons(10, 0), 0)
  assert.equal(calculateStockCartons(10, -1), 0)
})

test('calculateBasePricePerCarton rounds to nearest integer Toman', () => {
  assert.equal(calculateBasePricePerCarton(500000, 1.44), 720000)
  assert.equal(calculateBasePricePerCarton(0, 1.44), 0)
  assert.equal(calculateBasePricePerCarton(500000, 0), 0)
})

test('getStockWriteMode respects CMS_STOCK_WRITE_MODE env', () => {
  const orig = process.env.CMS_STOCK_WRITE_MODE
  try {
    delete process.env.CMS_STOCK_WRITE_MODE
    assert.equal(getStockWriteMode(), 'normal')

    process.env.CMS_STOCK_WRITE_MODE = 'manual'
    assert.equal(getStockWriteMode(), 'manual')

    process.env.CMS_STOCK_WRITE_MODE = 'import'
    assert.equal(getStockWriteMode(), 'import')

    process.env.CMS_STOCK_WRITE_MODE = 'invalid'
    assert.equal(getStockWriteMode(), 'normal')
  } finally {
    if (orig !== undefined) {
      process.env.CMS_STOCK_WRITE_MODE = orig
    } else {
      delete process.env.CMS_STOCK_WRITE_MODE
    }
  }
})

test('syncSlugAndDimensions enforces slug preservation, bounds and derived stock', async () => {
  const req = {
    payload: {
      find: async () => ({ totalDocs: 0 }),
      findByID: async () => null,
    },
  } as any

  // 1. Create with missing slug generates from SKU
  const createData: any = { sku: 'PP-101', basePricePerSqm: 400000, sqmPerCarton: 1.44 }
  await syncSlugAndDimensions({
    data: createData,
    operation: 'create',
    req,
  } as any)
  assert.equal(createData.slug, 'pp-101')
  assert.equal(createData.stockCartons, 0)

  // 2. Update without slug keeps original slug
  const updateData: any = { sku: 'PP-101-NEW' }
  await syncSlugAndDimensions({
    data: updateData,
    originalDoc: { id: 1, slug: 'my-custom-slug', sqmPerCarton: 1.44, inventorySqm: 144 },
    operation: 'update',
    req,
  } as any)
  assert.equal(updateData.slug, 'my-custom-slug')
  assert.equal(updateData.stockCartons, 100)

  // 3. Packaging change with open orders throws error
  const reqWithOrders = {
    payload: {
      find: async () => ({ totalDocs: 1 }),
    },
  } as any

  await assert.rejects(
    syncSlugAndDimensions({
      data: { sqmPerCarton: 2.16 },
      originalDoc: { id: 1, sqmPerCarton: 1.44 },
      operation: 'update',
      req: reqWithOrders,
    } as any),
    /تغییر ضریب بسته‌بندی/
  )
})
