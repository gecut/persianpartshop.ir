import assert from 'node:assert/strict'
import test from 'node:test'
import { TATWEEL, justifyKashida } from './kashida'

const measure = (text: string) => text.length * 10

test('adds tatweels only between connectable letters and stretches toward the target', () => {
  const text = 'قیمت و کالا'
  const result = justifyKashida(text, 200, measure)
  assert.ok(result.includes(TATWEEL))
  assert.equal(result.replaceAll(TATWEEL, ''), text)
  assert.ok(measure(result) <= 240)
})

test('never places a tatweel after a right-joining letter or next to a space', () => {
  const result = justifyKashida('قیمت و کالا', 400, measure)
  for (const bad of ['ا', 'و', 'د', 'ر', 'ز', 'ژ', ' ']) assert.ok(!result.includes(bad + TATWEEL), bad)
  assert.ok(!result.includes(TATWEEL + ' '))
})

test('returns the input unchanged when it already fills the target', () => {
  assert.equal(justifyKashida('قیمت', 0, measure), 'قیمت')
})
