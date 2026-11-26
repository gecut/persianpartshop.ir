import assert from 'node:assert/strict'
import test from 'node:test'
import { unzipSync } from 'fflate'
import { labelZipStream } from './label-zip-stream'

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

test('round-trips names and bytes in order', async () => {
  const settled: Array<{ args: unknown[] }> = []
  const data = new Map<string, Uint8Array>([
    ['T1', new Uint8Array([1, 2, 3])],
    ['T2', new Uint8Array([4])],
  ])
  const stream = labelZipStream(
    [
      { name: 'a.png', token: 'T1' },
      { name: 'b.png', token: 'T2' },
    ],
    async (token) => data.get(token)!,
    (...args) => settled.push({ args }),
  )
  const bytes = await collect(stream)
  const files = unzipSync(bytes)
  assert.deepEqual(Object.keys(files), ['a.png', 'b.png'])
  assert.deepEqual([...(files['a.png'] ?? [])], [1, 2, 3])
  assert.deepEqual([...(files['b.png'] ?? [])], [4])
  assert.equal(settled.length, 1)
  assert.deepEqual(settled[0]?.args, [])
})

test('renders lazily, one label per pull', async () => {
  let renderCalls = 0
  let settledCount = 0
  const entries = Array.from({ length: 5 }, (_, i) => ({ name: `${i}.png`, token: `T${i}` }))
  const stream = labelZipStream(
    entries,
    async () => {
      renderCalls += 1
      return new Uint8Array([renderCalls])
    },
    () => {
      settledCount += 1
    },
  )
  const reader = stream.getReader()
  await reader.read()
  assert.equal(renderCalls, 1)
  await reader.cancel()
  assert.equal(renderCalls, 1)
  assert.equal(settledCount, 1)
})

test('errors the stream and settles once when a render fails', async () => {
  const boom = new Error('boom')
  const settled: Array<{ args: unknown[] }> = []
  const stream = labelZipStream(
    [
      { name: 'a.png', token: 'T1' },
      { name: 'b.png', token: 'T2' },
    ],
    async (token) => {
      if (token === 'T2') throw boom
      return new Uint8Array([1, 2, 3])
    },
    (...args) => settled.push({ args }),
  )
  await assert.rejects(() => collect(stream), /boom/)
  assert.equal(settled.length, 1)
  assert.equal(settled[0]?.args[0], boom)
})

test('rejects an empty entry list', () => {
  assert.throws(() => labelZipStream([], async () => new Uint8Array(), () => {}), RangeError)
})
