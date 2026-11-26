import assert from 'node:assert/strict'
import test from 'node:test'
import { TOKEN_ALPHABET, generateToken, normalizeToken } from './_token'

test('generateToken uses only the safe alphabet and 8 characters', () => {
  for (let i = 0; i < 5000; i++) {
    const token = generateToken()
    assert.match(token, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
  }
  assert.equal(TOKEN_ALPHABET.length, 31)
})

test('generateToken is deterministic with an injected random source', () => {
  assert.equal(generateToken(() => 0), 'AAAAAAAA')
})

test('normalizeToken trims and uppercases, rejects anything else', () => {
  assert.equal(normalizeToken(' abcd2345\n'), 'ABCD2345')
  assert.equal(normalizeToken(' ab cd '), null)
  assert.equal(normalizeToken('ABCD2340'), null)
  assert.equal(normalizeToken(123), null)
  assert.equal(normalizeToken(undefined), null)
})
