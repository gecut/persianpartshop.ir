import assert from 'node:assert/strict'
import { test } from 'node:test'
import { personalizePlanAfterRead } from './_personalize-plan.after-read'

test('plan personalization leaves raw templates unchanged', () => {
  const raw = { id: 1, title: '{{name}} title', content: '{{name}} content' }
  const result = personalizePlanAfterRead({ doc: raw, context: { name: 'مشتری' } } as unknown as Parameters<typeof personalizePlanAfterRead>[0])
  assert.equal(result.title, raw.title)
  assert.equal(result.content, raw.content)
})
