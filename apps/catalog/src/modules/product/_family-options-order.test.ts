import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PublicCatalogFamilyOption } from '@persianpart/contract/public-catalog'
import { sortFamilyOptions } from './_family-options-order'

function createOption(
  partial: Partial<PublicCatalogFamilyOption> & { id: string; name: string },
): PublicCatalogFamilyOption {
  const { id, name, ...rest } = partial
  return {
    id,
    name,
    sku: `SKU-${id}`,
    productType: 'tile',
    brand: null,
    dimension: null,
    color: null,
    grade: null,
    tags: [],
    width: null,
    height: null,
    unit: 'm2',
    weight: null,
    itemsPerPack: null,
    price: { mode: 'unpriced' },
    stock: { mode: 'status', status: 'available' },
    ...rest,
  }
}

test('sorts by Persian name via localeCompare fa', () => {
  const options = [
    createOption({ id: '1', name: 'ب' }),
    createOption({ id: '2', name: 'الف' }),
    createOption({ id: '3', name: 'پ' }),
  ]
  const sorted = sortFamilyOptions(options)
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['2', '1', '3'],
  )
})

test('sorts by width ascending, null widths last', () => {
  const options = [
    createOption({ id: '1', name: 'یکسان', width: null }),
    createOption({ id: '2', name: 'یکسان', width: 120 }),
    createOption({ id: '3', name: 'یکسان', width: 60 }),
  ]
  const sorted = sortFamilyOptions(options)
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['3', '2', '1'],
  )
})

test('sorts same width by height ascending, null heights last', () => {
  const options = [
    createOption({ id: '1', name: 'یکسان', width: 120, height: 280 }),
    createOption({ id: '2', name: 'یکسان', width: 120, height: null }),
    createOption({ id: '3', name: 'یکسان', width: 120, height: 120 }),
  ]
  const sorted = sortFamilyOptions(options)
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['3', '1', '2'],
  )
})

test('sorts same name and size: grade_1 before grade_d, unknown grade last', () => {
  const options = [
    createOption({
      id: '1',
      name: 'طرح تست',
      width: 60,
      height: 120,
      grade: 'grade_d',
    }),
    createOption({
      id: '2',
      name: 'طرح تست',
      width: 60,
      height: 120,
      grade: 'unknown_grade',
    }),
    createOption({
      id: '3',
      name: 'طرح تست',
      width: 60,
      height: 120,
      grade: 'grade_1',
    }),
    createOption({
      id: '4',
      name: 'طرح تست',
      width: 60,
      height: 120,
      grade: null,
    }),
  ]
  const sorted = sortFamilyOptions(options)
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['3', '1', '2', '4'],
  )
})

test('breaks ties with numeric id where 10 sorts after 9', () => {
  const options = [
    createOption({
      id: '10',
      name: 'طرح یکسان',
      width: 60,
      height: 120,
      grade: 'grade_1',
    }),
    createOption({
      id: '9',
      name: 'طرح یکسان',
      width: 60,
      height: 120,
      grade: 'grade_1',
    }),
    createOption({
      id: '2',
      name: 'طرح یکسان',
      width: 60,
      height: 120,
      grade: 'grade_1',
    }),
    createOption({
      id: '100',
      name: 'طرح یکسان',
      width: 60,
      height: 120,
      grade: 'grade_1',
    }),
  ]
  const sorted = sortFamilyOptions(options)
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['2', '9', '10', '100'],
  )
})

test('composite sort: name, width, height, grade, numeric id', () => {
  const options = [
    createOption({
      id: '1',
      name: 'ب',
      width: 120,
      height: 280,
      grade: 'grade_d',
    }),
    createOption({
      id: '2',
      name: 'ب',
      width: 120,
      height: 120,
      grade: 'grade_1',
    }),
    createOption({
      id: '3',
      name: 'الف',
      width: 120,
      height: 280,
      grade: 'grade_1',
    }),
  ]
  const sorted = sortFamilyOptions(options)
  assert.deepEqual(
    sorted.map((o) => o.id),
    ['3', '2', '1'],
  )
})

test('does not mutate input array', () => {
  const options = [
    createOption({ id: '2', name: 'ب' }),
    createOption({ id: '1', name: 'الف' }),
  ]
  const original = [...options]
  const sorted = sortFamilyOptions(options)
  assert.notEqual(sorted, options)
  assert.deepEqual(options, original)
})
