import { expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const rpcResponse = z.object({ json: z.object({ code: z.string().optional(), id: z.number().optional(), status: z.string().optional() }).passthrough() })

const liveTest = process.env.SUPPLY_HTTP_TEST === 'true' ? test : test.skip
liveTest('live HTTP: supply eligibility, errors, replay, ownership and cancellation', async () => {
  expect(new URL(process.env.CMS_API_URL!).origin).toBe('http://127.0.0.1:55174')
  expect(process.env.SUPPLY_TEST_API_ORIGIN).toBe('http://127.0.0.1:55175')
  const { sdk } = await import('../payload')
  const { generateToken } = await import('../lib/jwt')
  const user = (await sdk.find({ collection: 'users', where: { phone: { equals: '09120000001' } }, limit: 1 })).docs[0]!
  const product = (await sdk.find({ collection: 'products', where: { sku: { equals: 'FIXTURE' } }, limit: 1 })).docs[0]!
  const warehouse = (await sdk.find({ collection: 'warehouses', where: { code: { equals: 'I1' } }, limit: 1 })).docs[0]!
  const token = await generateToken({ id: user.id, role: 'customer' })
  const request = async (procedure: string, input: object) => {
    const response = await fetch(`http://127.0.0.1:55175/api/rpc/supplyRequest/${procedure}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ json: input }) })
    return { status: response.status, body: rpcResponse.parse(await response.json()) }
  }
  const balances = () => sdk.find({ collection: 'warehouse-stock', where: { product: { equals: product.id } }, depth: 0 })
  const before = (await balances()).docs.map(item => item.inventorySqm)
  const common = { productId: product.id, warehouseId: warehouse.id, notes: '', idempotencyKey: randomUUID() }
  const insufficient = await request('submit', { ...common, requestedQuantity: 20 })
  expect(insufficient.status).toBe(409)
  expect(insufficient.body.json.code).toBe('EXACT_STOCK_AVAILABLE')
  const wrongWarehouse = (await sdk.find({ collection: 'warehouses', where: { code: { equals: 'E1' } }, limit: 1 })).docs[0]!
  expect((await request('submit', { ...common, idempotencyKey: randomUUID(), warehouseId: wrongWarehouse.id, requestedQuantity: 200 })).body.json.code).toBe('SOURCE_UNAVAILABLE')
  const preview = await request('preview', { productId: product.id, requestedQuantity: 200 })
  expect(preview.status).toBe(200)
  expect(preview.body.json).toMatchObject({ eligible: true, quote: { packageCount: 139, roundedQuantity: 200.16 } })
  const input = { ...common, idempotencyKey: randomUUID(), requestedQuantity: 200 }
  const created = await request('submit', input)
  expect(created.status).toBe(200)
  expect(created.body.json).toMatchObject({ status: 'new', productId: product.id, warehouseId: warehouse.id })
  const replay = await request('submit', input)
  expect(replay.body.json.id).toBe(created.body.json.id)
  expect((await request('submit', { ...input, requestedQuantity: 201 })).body.json.code).toBe('CONFLICT')
  expect((await request('detail', { id: created.body.json.id })).body.json.id).toBe(created.body.json.id)
  const anotherUser = await sdk.create({
    collection: 'users',
    data: {
      phone: `0912${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
      fullName: 'Other fixture',
      status: 'active',
      customerType: typeof user.customerType === 'object' ? user.customerType.id : user.customerType!,
      showProductImageWatermark: false,
    },
  })
  const otherToken = await generateToken({ id: anotherUser.id, role: 'customer' })
  const otherDetail = await fetch('http://127.0.0.1:55175/api/rpc/supplyRequest/detail', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${otherToken}` }, body: JSON.stringify({ json: { id: created.body.json.id } }) })
  expect(otherDetail.status).toBe(404)
  const adminToken = await generateToken({ id: user.id, role: 'admin' })
  const adminDetail = await fetch('http://127.0.0.1:55175/api/rpc/supplyRequest/detail', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ json: { id: created.body.json.id } }) })
  expect(adminDetail.status).toBe(403)
  expect((await request('cancel', { id: created.body.json.id })).body.json.status).toBe('cancelled_by_customer')
  expect((await request('cancel', { id: created.body.json.id })).body.json.status).toBe('cancelled_by_customer')
  expect((await balances()).docs.map(item => item.inventorySqm)).toEqual(before)
  const concurrentInput = { ...input, idempotencyKey: randomUUID(), requestedQuantity: 201 }
  const concurrent = await Promise.all([request('submit', concurrentInput), request('submit', concurrentInput)])
  expect(concurrent.map(result => result.status)).toEqual([200, 200])
  expect(concurrent[0]!.body.json.id).toBe(concurrent[1]!.body.json.id)
}, 60_000)
