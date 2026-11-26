import assert from 'node:assert/strict'
import test from 'node:test'
import { pickFreshTokens } from './_pick-tokens'

test('returns exactly count unique tokens', async () => {
  const tokens = await pickFreshTokens(50, async () => new Set())
  assert.equal(tokens.length, 50)
  assert.equal(new Set(tokens).size, 50)
})

test('replaces tokens that already exist', async () => {
  let first = true
  const tokens = await pickFreshTokens(3, async (candidates) => {
    if (!first) return new Set()
    first = false
    return new Set(candidates.slice(0, 1)) // pretend one candidate is taken
  })
  assert.equal(tokens.length, 3)
  assert.equal(new Set(tokens).size, 3)
})

test('gives up after too many collisions', async () => {
  await assert.rejects(() => pickFreshTokens(2, async (candidates) => new Set(candidates)), /تولید/)
})
