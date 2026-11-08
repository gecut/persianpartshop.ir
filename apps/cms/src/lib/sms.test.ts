import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sendSmsNotification } from './sms'

test('SMS requires configured credentials and reports provider errors without secrets', async () => {
  const originalFetch = globalThis.fetch
  const originalError = console.error
  const originalKey = process.env.KAVENEGAR_API_KEY
  const originalDisabled = process.env.DISABLE_SMS
  const errors: unknown[][] = []
  let calls = 0
  try {
    delete process.env.KAVENEGAR_API_KEY
    delete process.env.DISABLE_SMS
    globalThis.fetch = async () => { calls++; throw new Error('secret from provider') }
    console.error = (...args: unknown[]) => { errors.push(args) }
    await sendSmsNotification({ receptor: '09120000000', message: 'test' })
    assert.equal(calls, 0)
    assert.equal(errors.length, 1)
    process.env.KAVENEGAR_API_KEY = 'test-secret'
    process.env.DISABLE_SMS = 'true'
    await sendSmsNotification({ receptor: '09120000000', message: 'test' })
    assert.equal(calls, 0)
    delete process.env.DISABLE_SMS
    await sendSmsNotification({ receptor: '09120000000', message: 'test' })
    assert.equal(calls, 1)
    assert.doesNotMatch(JSON.stringify(errors), /secret|09120000000/)
    assert.equal(errors.length, 2)
    globalThis.fetch = async () => new Response(JSON.stringify({ return: { status: 400, message: 'test-secret' } }), { status: 200 })
    await sendSmsNotification({ receptor: '09120000000', message: 'test' })
    assert.equal(errors.length, 3)
    assert.doesNotMatch(JSON.stringify(errors), /secret|09120000000/)
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalError
    if (originalKey === undefined) delete process.env.KAVENEGAR_API_KEY
    else process.env.KAVENEGAR_API_KEY = originalKey
    if (originalDisabled === undefined) delete process.env.DISABLE_SMS
    else process.env.DISABLE_SMS = originalDisabled
  }
})

test('SMS times out both a stalled request and a stalled response body', { timeout: 15_000 }, async () => {
  const originalFetch = globalThis.fetch
  const originalError = console.error
  const originalKey = process.env.KAVENEGAR_API_KEY
  const originalDisabled = process.env.DISABLE_SMS
  const signals: AbortSignal[] = []
  try {
    process.env.KAVENEGAR_API_KEY = 'fixture-only'
    delete process.env.DISABLE_SMS
    console.error = () => {}
    globalThis.fetch = async (_url, init) => { signals.push(init!.signal as AbortSignal); return new Promise<Response>(() => {}) }
    await sendSmsNotification({ receptor: '09120000000', message: 'fixture' })
    assert.equal(signals[0]?.aborted, true)
    globalThis.fetch = async (_url, init) => {
      signals.push(init!.signal as AbortSignal)
      return { ok: true, json: () => new Promise(() => {}) } as Response
    }
    await sendSmsNotification({ receptor: '09120000000', message: 'fixture' })
    assert.equal(signals[1]?.aborted, true)
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalError
    if (originalKey === undefined) delete process.env.KAVENEGAR_API_KEY
    else process.env.KAVENEGAR_API_KEY = originalKey
    if (originalDisabled === undefined) delete process.env.DISABLE_SMS
    else process.env.DISABLE_SMS = originalDisabled
  }
})
