import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateBasePricePerCarton,
  calculateStockCartons,
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

test('syncSlugAndDimensions preserves slug, enforces bounds, and only derives stock when its inputs change', async () => {
  const req = {
    payload: {
      find: async () => ({ totalDocs: 0 }),
      findByID: async () => null,
    },
  } as any

  // 1. Create with missing slug generates from SKU and derives cartons
  const createData: any = { sku: 'PP-101', basePricePerSqm: 400000, sqmPerCarton: 1.44, inventorySqm: 144 }
  await syncSlugAndDimensions({ data: createData, operation: 'create', req } as any)
  assert.equal(createData.slug, 'pp-101')
  assert.equal(createData.stockCartons, 100)

  // 2. Unrelated edit (no inventory/packaging in payload) must NOT rewrite stockCartons
  const unrelatedEdit: any = { sku: 'PP-101-NEW' }
  await syncSlugAndDimensions({
    data: unrelatedEdit,
    originalDoc: { id: 1, slug: 'my-custom-slug', sqmPerCarton: 1.44, inventorySqm: 144 },
    operation: 'update',
    req,
  } as any)
  assert.equal(unrelatedEdit.slug, 'my-custom-slug')
  assert.equal(unrelatedEdit.stockCartons, undefined)

  // 3. Client-provided stockCartons is never trusted; derived from authoritative inventory
  const stockEdit: any = { inventorySqm: 288, stockCartons: 9999 }
  await syncSlugAndDimensions({
    data: stockEdit,
    originalDoc: { id: 1, sqmPerCarton: 1.44, inventorySqm: 144 },
    operation: 'update',
    req,
  } as any)
  assert.equal(stockEdit.stockCartons, 200)

  // 4. Invalid inventory values are still rejected
  await assert.rejects(
    syncSlugAndDimensions({ data: { inventorySqm: -5 } as any, operation: 'create', req } as any),
    /موجودی متراژ/,
  )
  await assert.rejects(
    syncSlugAndDimensions({ data: { inventorySqm: 1.234 } as any, operation: 'create', req } as any),
    /دقت اعشار/,
  )

  // 5. Packaging change with open orders throws error
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
