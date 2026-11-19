import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultCatalogSettings, PublicCatalogBrowseSchema } from '@persianpart/contract/public-catalog'
import {
  applyVisitorFilters,
  compilePolicy,
  hasEmptyCriteria,
} from './catalog-policy'
import type {
  CatalogPredicate,
  CompiledCatalogPolicy,
} from './catalog-query-types'

// A generic expression interpreter: selection rules belong exclusively to the compiler.
function matches(
  policy: CompiledCatalogPolicy,
  id: number,
  active: boolean,
  validPrice = false,
) {
  function evaluate(node: CatalogPredicate): boolean {
    switch (node.op) {
      case 'constant':
        return node.value
      case 'active':
        return active
      case 'validPrice':
        return validPrice
      case 'in':
        return node.field === 'id' && node.values.includes(id)
      case 'ref': {
        const clause = policy.clauses.find(
          (item) => item.reasonCode === node.code,
        )
        assert.ok(clause)
        return evaluate(clause.condition)
      }
      case 'and':
        return node.items.every(evaluate)
      case 'or':
        return node.items.some(evaluate)
      case 'not':
        return !evaluate(node.item)
      default:
        throw new Error(
          `Unexpected predicate in boolean selection test: ${node.op}`,
        )
    }
  }
  return evaluate(policy.condition)
}

test('manual additions bypass criteria, never inactivity, exclusion or pause', () => {
  const settings = defaultCatalogSettings()
  settings.paused = false
  settings.base = 'filtered'
  settings.criteria.onlyWithValidPrice = true
  settings.additions = [1, 2]
  settings.exclusions = [2]
  for (const [id, active, validPrice, expected] of [
    [1, true, false, true],
    [1, false, true, false],
    [2, true, true, false],
    [3, true, false, false],
    [3, true, true, true],
  ] as const)
    assert.equal(
      matches(compilePolicy(settings), id, active, validPrice),
      expected,
    )
  settings.paused = true
  assert.equal(matches(compilePolicy(settings), 1, true, true), false)
})
test('empty filtered criteria includes all active products while none stays closed', () => {
  const settings = defaultCatalogSettings()
  settings.paused = false
  assert.equal(matches(compilePolicy(settings), 1, true), false)
  settings.base = 'filtered'
  assert.equal(hasEmptyCriteria(settings), true)
  assert.equal(matches(compilePolicy(settings), 1, true), true)
  assert.equal(matches(compilePolicy(settings), 1, false), false)
})
test('visitor conditions narrow the published set without mutating the base policy', () => {
  const settings = defaultCatalogSettings()
  settings.paused = false
  settings.base = 'all_active'
  const base = compilePolicy(settings)
  const input = PublicCatalogBrowseSchema.parse({
    brandIds: [1],
    search: 'SKU',
  })
  const filtered = applyVisitorFilters(base, input)
  assert.equal(
    base.clauses.some((item) => item.reasonCode.startsWith('VISITOR_')),
    false,
  )
  assert.deepEqual(
    filtered.clauses
      .filter((item) => item.reasonCode.startsWith('VISITOR_'))
      .map((item) => item.condition),
    [
      { op: 'in', field: 'brand', values: [1] },
      { op: 'search', value: 'sku' },
    ],
  )
})
