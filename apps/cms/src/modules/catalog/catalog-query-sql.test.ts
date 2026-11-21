import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CompiledCatalogPolicy } from './catalog-query-types'
import { catalogQuerySQL } from './catalog-query-sql'

test('catalogQuerySQL parameters familyId and wraps policy condition', () => {
  const policy: CompiledCatalogPolicy = {
    clauses: [],
    pricing: {
      showPrice: true,
      percentage: 10,
      roundingStep: 1000,
      note: '',
    },
    condition: {
      op: 'or',
      items: [
        { op: 'active' },
        { op: 'constant', value: false },
      ],
    },
  }

  const result = catalogQuerySQL({
    policy,
    mode: 'browse',
    familyId: 9,
    limit: 100,
  })

  // 1. params contains 9
  assert.ok(result.params.includes(9), 'params should contain familyId 9')

  // 2. matching WHERE wraps condition: text contains "WHERE ("
  assert.ok(
    result.text.includes('WHERE ('),
    'matching clause must wrap condition in parentheses',
  )

  // 3. text includes parameter for family_id, e.g. "p.family_id = $n::bigint"
  assert.ok(
    /p\.family_id\s*=\s*\$\d+::bigint/.test(result.text),
    'family_id condition must be parameterized with ::bigint',
  )

  // 4. text never contains literal 9 outside of parameter placeholder
  const paramIndex = result.params.indexOf(9) + 1
  const sanitizedText = result.text.replaceAll(`$${paramIndex}`, '')
  assert.ok(
    !sanitizedText.includes('9'),
    'SQL text must not contain literal 9 outside parameter placeholder',
  )

  // 5. Without familyId, p.family_id is not in SQL text
  const resultWithoutFamily = catalogQuerySQL({
    policy,
    mode: 'browse',
    limit: 100,
  })
  assert.ok(!resultWithoutFamily.params.includes(9))
  assert.ok(!resultWithoutFamily.text.includes('p.family_id'))
  assert.ok(resultWithoutFamily.text.includes('WHERE ('))
})
