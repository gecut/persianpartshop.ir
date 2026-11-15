import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { getPayload } from 'payload'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import { z } from 'zod'
import type { PayloadMcpApiKey } from '../payload-types'
import { SMS_TEMPLATES } from '../modules/sms/constants'

const cmsUrl = process.env.CMS_MCP_TEST_URL
const envelope = z.object({
  result: z.unknown().optional(),
  error: z.unknown().optional(),
})
const toolResult = z.object({ content: z.array(z.object({ text: z.string() })).min(1), isError: z.boolean().optional() })
const images = z.object({ id: z.number(), url: z.string() })
const identity = z.object({ id: z.number() })
const ticket = z.object({ ticket: z.string() })
const preview = z.object({ previewId: z.string().uuid() })

async function verifyCodex(origin: URL, secret: string, productId: number) {
  const codex = spawn('codex', [
    'app-server', '--strict-config',
    '-c', `mcp_servers.persianpart_cms_test.url=${JSON.stringify(new URL('/api/mcp', origin).href)}`,
    '-c', 'mcp_servers.persianpart_cms_test.bearer_token_env_var="PERSIANPART_CMS_MCP_TOKEN"',
    '-c', 'mcp_servers.persianpart_cms_test.tools.updateOrders.approval_mode="prompt"',
  ], { env: { ...process.env, PERSIANPART_CMS_MCP_TOKEN: secret }, stdio: ['pipe', 'pipe', 'ignore'] })
  const lines = createInterface({ input: codex.stdout })
  const stream = lines[Symbol.asyncIterator]()
  let sequence = 0
  const timer = setTimeout(() => codex.kill(), 20_000)
  async function request(method: string, params: Record<string, unknown>) {
    const id = ++sequence
    codex.stdin.write(JSON.stringify({ id, method, params }) + '\n')
    while (true) {
      const line = await stream.next()
      if (line.done) throw new Error(`Codex exited before ${method}`)
      const message = z.object({ id: z.number().optional(), result: z.unknown(), error: z.unknown() }).parse(JSON.parse(line.value))
      if (message.id !== id) continue
      assert.equal(message.error, undefined, JSON.stringify(message.error))
      return message.result
    }
  }
  try {
    await request('initialize', { clientInfo: { name: 'cms-integration', version: '1.0' } })
    codex.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n')
    const { thread } = z.object({ thread: z.object({ id: z.string() }) }).parse(await request('thread/start', { ephemeral: true }))
    const status = await request('mcpServerStatus/list', { threadId: thread.id, serverName: 'persianpart_cms_test', detail: 'toolsAndAuthOnly' })
    const catalog = z.object({ data: z.array(z.object({ tools: z.record(z.unknown()) })) }).parse(status)
    assert.ok(catalog.data.some(server => Object.hasOwn(server.tools, 'findProducts')), JSON.stringify(status))
    const result = await request('mcpServer/tool/call', {
      threadId: thread.id, server: 'persianpart_cms_test', tool: 'findProducts', arguments: { id: productId },
    })
    assert.match(toolResult.parse(result).content[0]!.text, new RegExp(`"id":\\s*${productId}`))
  } finally {
    clearTimeout(timer)
    lines.close()
    codex.kill()
  }
}

test('CMS MCP over HTTP with isolated PostgreSQL fixtures', { skip: !cmsUrl }, async () => {
  const origin = new URL(cmsUrl!)
  const dbUrl = new URL(process.env.DATABASE_URL!)
  for (const target of [origin, dbUrl]) {
    assert.equal(target.hostname, '127.0.0.1')
    assert.ok(target.port)
  }
  assert.equal(dbUrl.pathname, '/persianpart_mcp')
  process.env.DISABLE_SMS = 'true'
  const { default: config } = await import('../payload.config')
  const payload = await getPayload({ config })
  assert.ok('drizzle' in payload.db)
  const db = payload.db.drizzle as PostgresAdapter['drizzle']
  const suffix = randomUUID().slice(0, 8)
  const password = randomUUID()
  const root = await payload.create({ collection: 'admins', data: { name: 'MCP test root', email: `root-${suffix}@example.test`, password, role: 'superadmin' } })
  const manager = await payload.create({ collection: 'admins', data: { name: 'MCP test manager', email: `manager-${suffix}@example.test`, password, role: 'manager' } })
  const credentials: number[] = []
  let sequence = 0
  let uploaded: { productId: number; mediaId: number } | undefined

  async function issueKey(data: Partial<PayloadMcpApiKey> = {}) {
    const secret = randomUUID()
    const doc = await payload.create({
      collection: 'payload-mcp-api-keys',
      user: { ...root, collection: 'admins' }, overrideAccess: false,
      data: { user: manager.id, enableAPIKey: true, apiKey: secret, ...data },
    })
    credentials.push(doc.id)
    return { secret, doc }
  }

  async function rpc(secret: string, method: string, params?: Record<string, unknown>) {
    const response = await fetch(new URL('/api/mcp', origin), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params }),
    })
    const body = await response.text()
    const data = response.headers.get('content-type')?.includes('text/event-stream')
      ? body.split('\n').find(line => line.startsWith('data: '))?.slice(6) : body
    return { status: response.status, body: data ? envelope.parse(JSON.parse(data)) : {} }
  }

  async function call(secret: string, name: string, args: Record<string, unknown>) {
    const rpcResult = await rpc(secret, 'tools/call', { name, arguments: args })
    return toolResult.parse(rpcResult.body.result)
  }

  async function succeed(secret: string, name: string, args: Record<string, unknown>) {
    const result = await call(secret, name, args)
    const text = result.content[0]!.text
    assert.ok(!result.isError && !text.startsWith('Error'), `${name}: ${text}`)
    const json = text.match(/```json\s+([\s\S]+?)```/)?.[1] ?? text
    return JSON.parse(json) as unknown
  }

  function upload(value: string, file: Blob, name: string) {
    const form = new FormData()
    form.set('file', file, name)
    return fetch(new URL('/api/mcp-upload', origin), {
      method: 'POST', headers: { 'X-MCP-Upload-Ticket': value }, body: form,
    })
  }

  try {
    assert.equal((await rpc('unknown', 'tools/list')).status, 401)
    await assert.rejects(payload.create({
      collection: 'payload-mcp-api-keys',
      user: { ...manager, collection: 'admins' }, overrideAccess: false,
      data: { user: manager.id },
    }))
    const empty = await issueKey()
    const { secret, doc } = await issueKey({
      products: { find: true, create: true, update: true },
      orders: { find: true, update: true },
      users: { find: true, create: true, update: true },
      supplyRequests: { find: true, update: true },
      smsQueue: { find: true },
      'payload-mcp-tool': {
        createOrders: true, prepareMediaUpload: true, prepareCsvImport: true, getCsvImportPreview: true,
        applyCsvImport: true, readProductStock: true, adjustProductStock: true, retryFailedSms: true,
      },
    })
    const listing = z.object({ tools: z.array(z.object({ name: z.string() })) })
    const emptyListing = await rpc(empty.secret, 'tools/list')
    assert.equal(emptyListing.status, 200, JSON.stringify(emptyListing.body))
    assert.deepEqual(emptyListing.body.result ? listing.parse(emptyListing.body.result).tools : emptyListing.body.error,
      emptyListing.body.result ? [] : { code: -32601, message: 'Method not found' })
    const init = await rpc(secret, 'initialize', {
      protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'cms-integration', version: '1.0' },
    })
    assert.equal(init.status, 200)
    assert.ok(init.body.result)
    const names = listing.parse((await rpc(secret, 'tools/list')).body.result).tools.map(item => item.name)
    assert.ok(names.includes('findProducts') && names.includes('adjustProductStock'))
    assert.ok(!names.includes('deleteProducts') && !names.includes('findOtps') && !names.includes('findAdmins'))

    const sku = `MCP-${suffix}`
    const product = identity.parse(await succeed(secret, 'createProducts', { name: sku, sku, slug: sku.toLowerCase(), basePricePerSqm: 100 }))
    if (process.env.CMS_MCP_TEST_CODEX === 'true') await verifyCodex(origin, secret, product.id)
    const bulk = await call(secret, 'updateProducts', { where: JSON.stringify({ id: { equals: product.id } }), basePricePerSqm: 777 })
    assert.match(bulk.content[0]!.text, /single record ID/)
    assert.equal((await payload.findByID({ collection: 'products', id: product.id })).basePricePerSqm, 100)

    const lock = await payload.create({
      collection: 'payload-locked-documents',
      data: { document: { relationTo: 'products', value: product.id }, user: { relationTo: 'admins', value: root.id } },
    })
    const locked = await call(secret, 'updateProducts', { id: product.id, basePricePerSqm: 777, overrideLock: true })
    assert.match(locked.content[0]!.text, /locked/i)
    assert.equal((await payload.findByID({ collection: 'products', id: product.id })).basePricePerSqm, 100)
    await payload.delete({ collection: 'payload-locked-documents', id: lock.id })

    const mediaTicket = ticket.parse(await succeed(secret, 'prepareMediaUpload', { alt: 'MCP test image' }))
    const png = Uint8Array.from(await sharp({ create: { width: 2, height: 2, channels: 3, background: 'white' } }).png().toBuffer())
    const image = new Blob([png], { type: 'image/png' })
    const imageResponse = await upload(mediaTicket.ticket, image, `mcp-${suffix}.png`)
    const imageBody: unknown = await imageResponse.json()
    assert.equal(imageResponse.status, 201, JSON.stringify(imageBody))
    const media = images.parse(imageBody)
    uploaded = { productId: product.id, mediaId: media.id }
    assert.equal((await upload(mediaTicket.ticket, image, 'replay.png')).status, 409)
    await succeed(secret, 'updateProducts', { id: product.id, cover: media.id })
    const withImage = await payload.findByID({ collection: 'products', id: product.id, depth: 0 })
    assert.equal(withImage.cover, media.id)

    const warehouse = await payload.create({ collection: 'warehouses', data: { code: sku, name: sku, stockMode: 'exact', isActive: true } })
    await succeed(secret, 'adjustProductStock', { productId: product.id, warehouseId: warehouse.id, revision: null, amount: 10 })
    const stale = await call(secret, 'adjustProductStock', { productId: product.id, warehouseId: warehouse.id, revision: null, amount: 20 })
    assert.equal(stale.isError, true)

    const csvTicket = ticket.parse(await succeed(secret, 'prepareCsvImport', { mode: 'price' }))
    const csv = new Blob([`sku,basePricePerSqm\n${sku},250\n`], { type: 'text/csv' })
    const csvResponse = await upload(csvTicket.ticket, csv, 'prices.csv')
    const csvBody: unknown = await csvResponse.json()
    assert.equal(csvResponse.status, 201, JSON.stringify(csvBody))
    const { previewId } = preview.parse(csvBody)
    await succeed(secret, 'getCsvImportPreview', { previewId, page: 1 })
    const other = await issueKey({ 'payload-mcp-tool': { getCsvImportPreview: true, applyCsvImport: true } })
    assert.equal((await call(other.secret, 'getCsvImportPreview', { previewId })).isError, true)
    assert.equal((await call(other.secret, 'applyCsvImport', { previewId })).isError, true)
    const applies = await Promise.all([call(secret, 'applyCsvImport', { previewId }), call(secret, 'applyCsvImport', { previewId })])
    assert.equal(applies.filter(result => !result.isError).length, 1, JSON.stringify(applies))
    assert.equal((await payload.findByID({ collection: 'products', id: product.id })).basePricePerSqm, 250)

    const tier = await payload.create({
      collection: 'customer-types', data: { name: sku, slug: sku.toLowerCase(), markupPercent: 0, isActive: true },
    })
    const customer = identity.parse(await succeed(secret, 'createUsers', {
      phone: '09' + Number.parseInt(suffix, 16).toString().padStart(9, '0').slice(-9),
      fullName: 'MCP customer', customerType: tier.id, status: 'active', showProductImageWatermark: false,
    }))
    await succeed(secret, 'updateUsers', { id: customer.id, fullName: 'Updated MCP customer' })
    const order = identity.parse(await succeed(secret, 'createOrders', {
      customerId: customer.id, warehouseId: warehouse.id,
      items: [{ productId: product.id, requestedArea: 1 }],
    }))
    const stock = async () => (await payload.find({
      collection: 'warehouse-stock', where: { and: [{ product: { equals: product.id } }, { warehouse: { equals: warehouse.id } }] },
    })).docs[0]?.inventorySqm
    const remaining = await stock()
    assert.ok(typeof remaining === 'number' && remaining < 10)
    const invalidTransition = await call(secret, 'updateOrders', { id: order.id, status: 'completed' })
    assert.match(invalidTransition.content[0]!.text, /^Error/)
    assert.equal(await stock(), remaining)
    await succeed(secret, 'updateOrders', { id: order.id, status: 'cancelled_by_admin' })
    assert.equal(await stock(), 10)

    const inquiry = await payload.create({
      collection: 'warehouses', data: { code: sku + '-INQ', name: sku, stockMode: 'inquiry', isActive: true },
    })
    await payload.create({ collection: 'warehouse-stock', data: { warehouse: inquiry.id, product: product.id, revision: 0, isActive: true } })
    const service = await payload.create({
      collection: 'admins', data: { name: 'MCP fixture service', email: `service-${suffix}@example.test`, password, role: 'service' },
    })
    const supply = await payload.create({
      collection: 'supply-requests', user: { ...service, collection: 'admins' }, overrideAccess: false,
      data: { user: customer.id, product: product.id, warehouse: inquiry.id, requestedQuantity: 100, idempotencyKey: randomUUID() } as never,
    })
    await succeed(secret, 'updateSupplyRequests', { id: supply.id, status: 'reviewing' })
    assert.equal((await payload.findByID({ collection: 'supply-requests', id: supply.id })).status, 'reviewing')

    const expired = ticket.parse(await succeed(secret, 'prepareMediaUpload', { alt: 'Expired file' }))
    const expiredHash = createHash('sha256').update(expired.ticket).digest('hex')
    await db.execute(sql`UPDATE mcp_transfers SET expires_at = now() WHERE id = ${expiredHash}`)
    assert.equal((await upload(expired.ticket, image, 'expired.png')).status, 409)

    const rejectedFile = ticket.parse(await succeed(secret, 'prepareMediaUpload', { alt: 'Invalid file' }))
    assert.equal((await upload(rejectedFile.ticket, csv, 'invalid.png')).status, 400)

    const failed = await payload.create({
      collection: 'sms-queue',
      data: { receptor: '09120000100', status: 'failed', attempts: 1, template: SMS_TEMPLATES.ORDER_REGISTERED, tokens: { token: sku } },
    })
    const otp = await payload.create({
      collection: 'sms-queue',
      data: { receptor: '09120000100', status: 'failed', attempts: 1, template: SMS_TEMPLATES.OTP, tokens: { token: '000000' } },
    })
    assert.match((await call(secret, 'findSmsQueue', { id: otp.id })).content[0]!.text, /^Error/)
    assert.equal((await call(secret, 'retryFailedSms', { id: otp.id })).isError, true)
    await succeed(secret, 'retryFailedSms', { id: failed.id })
    assert.equal((await payload.findByID({ collection: 'sms-queue', id: failed.id })).status, 'pending')

    const pending = ticket.parse(await succeed(secret, 'prepareMediaUpload', { alt: 'Revocation test' }))
    await payload.update({ collection: 'payload-mcp-api-keys', id: doc.id, data: { enableAPIKey: false } })
    assert.equal((await rpc(secret, 'tools/list')).status, 401)
    assert.equal((await upload(pending.ticket, image, 'revoked.png')).status, 403)
    await payload.update({ collection: 'admins', id: manager.id, data: { isActive: false } })
    assert.equal((await rpc(empty.secret, 'tools/list')).status, 401)
  } finally {
    if (uploaded) {
      await payload.update({ collection: 'products', id: uploaded.productId, data: { cover: null } })
      await payload.delete({ collection: 'media', id: uploaded.mediaId })
    }
    for (const id of credentials) await payload.delete({ collection: 'payload-mcp-api-keys', id })
    await payload.destroy()
  }
})
