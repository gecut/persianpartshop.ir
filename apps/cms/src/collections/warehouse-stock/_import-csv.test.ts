import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseImportCsv } from './_import-csv'

test('parses Kimia rows and rounds Rials to Tomans', () => {
  const csv = '"متر مربع";"11770505";"538.11";"نام; کالا";"00123";\r\n"عدد";"10";".72";"نام";"B";\r\n'
  const result = parseImportCsv(csv, 'kimia')
  assert.deepEqual(result.rows, [
    { rowNumber: 1, sku: '00123', basePricePerSqm: 1177051, inventorySqm: 538.11 },
    { rowNumber: 2, sku: 'B', basePricePerSqm: 1, inventorySqm: 0.72 },
  ])
  assert.equal(result.errors.length, 0)
})

test('rejects both duplicate rows and whole invalid rows, retaining valid rows', () => {
  const result = parseImportCsv('"عدد";"100";"2";"x";"A";\n"عدد";"100";"3";"x";"A";\n"عدد";"100";"-1";"x";"B";\n"عدد";"100";"4";"x";"C";', 'kimia')
  assert.deepEqual(result.errors.map(x => x.rowNumber), [1, 2, 3])
  assert.deepEqual(result.rows.map(x => x.sku), ['C'])
})

test('stock and price CSV headers, quoted identifiers and limits', () => {
  assert.deepEqual(parseImportCsv('inventorySqm,sku\n1.25,"A,1"', 'stock').rows[0], { rowNumber: 2, sku: 'A,1', inventorySqm: 1.25 })
  assert.deepEqual(parseImportCsv('sku,basePricePerSqm\n001,250', 'price').rows[0], { rowNumber: 2, sku: '001', basePricePerSqm: 250 })
  assert.equal(parseImportCsv('sku,basePricePerSqm\nA,1.2', 'price').errors.length, 1)
  assert.throws(() => parseImportCsv('sku,inventorySqm\n', 'stock'))
  assert.throws(() => parseImportCsv('bad,header\nA,1', 'stock'))
  assert.throws(() => parseImportCsv(`sku,inventorySqm\n${Array.from({length: 1001}, (_, i) => `P${i},1`).join('\n')}`, 'stock'))
})
