import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { test } from 'node:test'
import { createPayloadSDK, PayloadSDKError } from './sdk.js'

const url = 'http://localhost:5174/api/products'

function client(fetch: typeof globalThis.fetch, options: { timeoutMs?: number; maxRetries?: number } = {}) {
  return createPayloadSDK({ baseURL: 'http://localhost:5174/api', fetch, ...options })
}

function pendingFetch(onStart?: (signal: AbortSignal) => void): typeof fetch {
  return async (_input, init) => {
    const signal = init?.signal
    assert.ok(signal)
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      onStart?.(signal)
    })
  }
}

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  for (const failure of ['status', 'network', 'timeout']) {
    test(`${method} Request is never retried after ${failure}`, async () => {
      let calls = 0
      const sdk = client(async (input, init) => {
        calls++
        if (failure === 'network') throw new TypeError('connection lost')
        if (failure === 'timeout') return pendingFetch()(input, init)
        return new Response(null, { status: 503 })
      }, { timeoutMs: 5 })
      const result = sdk.fetch(new Request(url, { method }))
      if (failure === 'status') assert.equal((await result).status, 503)
      else await assert.rejects(result, PayloadSDKError)
      assert.equal(calls, 1)
    })
  }
}

for (const method of ['GET', 'HEAD', 'OPTIONS']) {
  for (const failure of [502, 503, 504, 'network'] as const) {
    test(`${method} retries ${failure} within its budget`, async () => {
      let calls = 0
      const sdk = client(async () => {
        if (++calls <= 2) {
          if (failure === 'network') throw new TypeError('connection lost')
          return new Response(null, { status: failure })
        }
        return new Response(null, { status: 200 })
      })
      assert.equal((await sdk.fetch(new Request(url, { method }))).status, 200)
      assert.equal(calls, 3)
    })
  }
}

test('init method overrides Request method in both directions', async () => {
  let calls = 0
  const sdk = client(async () => new Response(null, { status: ++calls % 2 === 1 ? 503 : 200 }))
  assert.equal((await sdk.fetch(new Request(url, { method: 'POST' }), { method: 'GET' })).status, 200)
  assert.equal(calls, 2)
  assert.equal((await sdk.fetch(new Request(url), { method: 'POST' })).status, 503)
  assert.equal(calls, 3)
})

for (const source of ['request', 'init']) {
  for (const timing of ['before', 'during']) {
    test(`${source} cancellation ${timing} fetch preserves reason without retry`, async () => {
      const controller = new AbortController()
      const reason = new Error('caller cancelled')
      let calls = 0
      const sdk = client(pendingFetch(() => {
        calls++
        controller.abort(reason)
      }))
      if (timing === 'before') controller.abort(reason)
      const request = new Request(url, source === 'request' ? { signal: controller.signal } : undefined)
      await assert.rejects(sdk.fetch(request, source === 'init' ? { signal: controller.signal } : undefined), (error) => error === reason)
      assert.equal(calls, timing === 'before' ? 0 : 1)
    })
  }
}

test('init signal overrides the Request signal', async () => {
  const requestController = new AbortController()
  requestController.abort(new Error('ignored'))
  const initController = new AbortController()
  const reason = new Error('effective caller')
  const sdk = client(pendingFetch(() => initController.abort(reason)))
  await assert.rejects(sdk.fetch(new Request(url, { signal: requestController.signal }), { signal: initController.signal }), (error) => error === reason)
})

test('null init signal clears the Request signal', async () => {
  const controller = new AbortController()
  controller.abort()
  const sdk = client(async (_input, init) => {
    assert.equal(init?.signal?.aborted, false)
    return new Response(null)
  })
  assert.equal((await sdk.fetch(new Request(url, { signal: controller.signal }), { signal: null })).status, 200)
})

for (const failure of ['status', 'network', 'timeout']) {
  test(`caller cancels ${failure} backoff before another attempt`, async () => {
    const controller = new AbortController()
    const reason = new Error('cancel backoff')
    let calls = 0
    const sdk = client(async (input, init) => {
      calls++
      if (failure === 'timeout') {
        init?.signal?.addEventListener('abort', () => setTimeout(() => controller.abort(reason), 10), { once: true })
        return pendingFetch()(input, init)
      }
      setTimeout(() => controller.abort(reason), 10)
      if (failure === 'network') throw new TypeError('offline')
      return new Response(null, { status: 503 })
    }, { timeoutMs: 5 })
    await assert.rejects(sdk.fetch(url, { signal: controller.signal }), (error) => error === reason)
    assert.equal(calls, 1)
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  })
}

test('read timeout retries are bounded and reported as 504', async () => {
  let calls = 0
  const sdk = client(pendingFetch(() => { calls++ }), { timeoutMs: 5, maxRetries: 1 })
  await assert.rejects(sdk.fetch(new Request(url, { method: 'HEAD' })), (error) => {
    assert.ok(error instanceof PayloadSDKError)
    assert.equal(error.status, 504)
    assert.match(error.message, /timed out.*\[HEAD\]/)
    assert.ok(error.message.includes(url))
    return true
  })
  assert.equal(calls, 2)
})

test('network retries are bounded and reported as 503', async () => {
  let calls = 0
  const sdk = client(async () => { calls++; throw new TypeError('offline') }, { maxRetries: 1 })
  await assert.rejects(sdk.fetch(url), (error) => error instanceof PayloadSDKError && error.status === 503)
  assert.equal(calls, 2)
})

test('an unrelated AbortError is not a timeout or retried', async () => {
  let calls = 0
  const reason = new DOMException('transport aborted', 'AbortError')
  const sdk = client(async () => { calls++; throw reason })
  await assert.rejects(sdk.fetch(url), (error) => error === reason)
  assert.equal(calls, 1)
})

test('non-transient responses do not retry', async () => {
  for (const status of [400, 401, 403, 404, 409, 500]) {
    let calls = 0
    const sdk = client(async () => { calls++; return new Response(null, { status }) })
    assert.equal((await sdk.fetch(url)).status, status)
    assert.equal(calls, 1)
  }
})

test('retry response bodies are released', async () => {
  let cancelled = 0
  let calls = 0
  const sdk = client(async () => ++calls === 1
    ? new Response(new ReadableStream({ cancel() { cancelled++ } }), { status: 503 })
    : new Response(null))
  await sdk.fetch(url)
  assert.equal(cancelled, 1)
})

test('completed attempts clear timers and caller listeners', async () => {
  const controller = new AbortController()
  const signals: AbortSignal[] = []
  const sdk = client(async (_input, init) => {
    assert.ok(init?.signal)
    signals.push(init.signal)
    return new Response(null)
  }, { timeoutMs: 20 })
  for (let index = 0; index < 12; index++) await sdk.fetch(url, { signal: controller.signal })
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.ok(signals.every((signal) => !signal.aborted))
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
})

test('SDK operations preserve API key precedence and base headers', async () => {
  const sdk = createPayloadSDK({
    baseURL: 'http://localhost:5174/api',
    apiKey: 'test-only-key',
    token: 'test-only-token',
    baseInit: { headers: { 'X-Test': 'preserved' }, credentials: 'include' },
    fetch: async (_input, init) => {
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('Authorization'), 'admins API-Key test-only-key')
      assert.equal(headers.get('Accept'), 'application/json')
      assert.equal(headers.get('X-Test'), 'preserved')
      assert.equal(init?.credentials, 'include')
      return Response.json({ docs: [] })
    },
  })
  assert.deepEqual((await sdk.find({ collection: 'products' })).docs, [])
})
