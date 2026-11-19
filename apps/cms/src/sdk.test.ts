import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers'
import { test } from 'node:test'
import { createPayloadSDK, PayloadSDKError } from './sdk'

const url = 'http://cms.invalid/api/products'
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve))

test('unsafe writes are never retried after service or transport failures', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const networkFailure of [false, true]) {
      let calls = 0
      const sdk = createPayloadSDK({
        baseURL: 'http://cms.invalid/api',
        fetch: async () => {
          calls++
          if (networkFailure) throw new TypeError('offline')
          return new Response(null, { status: 503 })
        },
      })
      const result = sdk.fetch(new Request(url, { method }))
      if (networkFailure) await assert.rejects(result, PayloadSDKError)
      else assert.equal((await result).status, 503)
      assert.equal(calls, 1)
    }
  }
})

test('safe reads retry a transient failure and release the old response body', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0,
    released = 0
  const sdk = createPayloadSDK({
    maxRetries: 1,
    fetch: async () =>
      ++calls === 1
        ? new Response(
            new ReadableStream({
              cancel() {
                released++
              },
            }),
            { status: 503 },
          )
        : new Response(null),
  })
  const result = sdk.fetch(url)
  await nextTurn()
  context.mock.timers.tick(1000)
  assert.equal((await result).status, 200)
  assert.equal(calls, 2)
  assert.equal(released, 1)
})

test('timeouts are typed service failures without real clock waits', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const sdk = createPayloadSDK({
    timeoutMs: 10,
    maxRetries: 0,
    fetch: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(init.signal?.reason),
          { once: true },
        )
      }),
  })
  const result = sdk.fetch(url)
  const failure = assert.rejects(
    result,
    (error) => error instanceof PayloadSDKError && error.status === 504,
  )
  context.mock.timers.tick(11)
  await failure
})

test('caller cancellation preserves its reason and never retries', async () => {
  for (const before of [true, false]) {
    const controller = new AbortController()
    const reason = new Error('caller cancelled')
    let calls = 0
    const sdk = createPayloadSDK({
      fetch: async (_input, init) => {
        calls++
        controller.abort(reason)
        init?.signal?.throwIfAborted()
        return new Response(null)
      },
    })
    if (before) controller.abort(reason)
    await assert.rejects(
      sdk.fetch(url, { signal: controller.signal }),
      (error) => error === reason,
    )
    assert.equal(calls, before ? 0 : 1)
  }
})

test('init method overrides the Request method for retry safety', async () => {
  let calls = 0
  const sdk = createPayloadSDK({
    fetch: async () => {
      calls++
      return new Response(null, { status: 503 })
    },
  })
  assert.equal(
    (await sdk.fetch(new Request(url), { method: 'POST' })).status,
    503,
  )
  assert.equal(calls, 1)
})

test('SDK operations keep API-key precedence, caller headers and credentials', async () => {
  const sdk = createPayloadSDK({
    baseURL: 'http://cms.invalid/api',
    apiKey: 'unit-key',
    token: 'unit-token',
    baseInit: { headers: { 'X-Caller': 'preserved' }, credentials: 'include' },
    fetch: async (_input, init) => {
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('Authorization'), 'admins API-Key unit-key')
      assert.equal(headers.get('Accept'), 'application/json')
      assert.equal(headers.get('X-Caller'), 'preserved')
      assert.equal(init?.credentials, 'include')
      return Response.json({ docs: [] })
    },
  })
  assert.deepEqual((await sdk.find({ collection: 'products' })).docs, [])
})
