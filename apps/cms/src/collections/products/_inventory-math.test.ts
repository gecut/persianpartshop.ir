import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateBasePricePerCarton,
  calculateStockCartons,
  calculateSupplyEstimate,
  roundToTwoDecimals,
} from './_inventory-math'

test('supply estimate rounds to whole sales packages without rounding to pallets', () => {
  assert.deepEqual(calculateSupplyEstimate({ requestedQuantity: 80, salesFactor: 1.44, basePrice: 1000, markupPercent: 10 }), {
    packageCount: 56, roundedQuantity: 80.64, estimatedUnitPrice: 1100, estimatedTotal: 88704,
  })
  assert.equal(calculateSupplyEstimate({ requestedQuantity: 3.2, salesFactor: 1, basePrice: 10, markupPercent: 0 }).roundedQuantity, 4)
  assert.equal(calculateSupplyEstimate({ requestedQuantity: 1_000_000, salesFactor: 1, basePrice: 100_000_000, markupPercent: 0 }).estimatedTotal, 100_000_000_000_000)
  for (const requestedQuantity of [0, 1e-10, -1, NaN, Infinity, 1.001, 1_000_001]) {
    assert.throws(() => calculateSupplyEstimate({ requestedQuantity, salesFactor: 1.44, basePrice: 1000, markupPercent: 0 }))
  }
})

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
