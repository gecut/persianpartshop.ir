import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { APIError, Forbidden, type Endpoint, type PayloadRequest } from 'payload'
import { StockImportModeSchema, StockImportRowSchema } from '@persianpart/contract'
import { z } from 'zod'
import { basename } from 'node:path'
import sharp from 'sharp'
import { businessError } from '../lib/validation'
import { applyStockImport, getStockImportPreview } from '../collections/warehouse-stock/_import.endpoints'
import { keyDigest, mcpEnabled, mcpKeySchema, requireMcpManager } from './access'

const mediaLimit = 5 * 1024 * 1024
const csvLimit = 1_000_000
const multipartOverhead = 16 * 1024
const ticketSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('media'), alt: z.string().trim().min(1).max(500) }),
  z.object({ kind: z.literal('csv'), mode: StockImportModeSchema, warehouseId: z.number().int().positive().optional() }),
])
type Ticket = z.infer<typeof ticketSchema>

const previewSchema = z.object({
  token: z.string().nullable(),
  rows: z.array(StockImportRowSchema),
  errors: z.array(z.object({ rowNumber: z.number(), sku: z.string(), message: z.string() })),
  total: z.number(),
  priceChanges: z.number(),
  stockChanges: z.number(),
})

function database(req: PayloadRequest) {
  if (req.payload.db.name !== 'postgres' || !('drizzle' in req.payload.db)) throw new APIError('MCP requires PostgreSQL.', 503, undefined, true)
  return (req.payload.db.drizzle as PostgresAdapter['drizzle'])
}

function invalidTransfer() {
  return businessError('Transfer is unavailable, expired, or already used.', 'MCP_TRANSFER_UNAVAILABLE', 409)
}

export async function issueUpload(req: PayloadRequest, input: Ticket) {
  const actor = requireMcpManager(req.user)
  const ticket = ticketSchema.parse(input)
  if (ticket.kind === 'csv' && ticket.mode !== 'price' && !ticket.warehouseId) {
    throw businessError('A warehouse ID is required for this import mode.', 'MCP_WAREHOUSE_REQUIRED', 400)
  }
  const db = database(req)
  const secret = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(secret).digest('hex')
  const digest = keyDigest(req)
  await db.execute(sql`
    WITH purge AS (DELETE FROM mcp_transfers WHERE expires_at <= now())
    INSERT INTO mcp_transfers (id, kind, actor_id, key_digest, payload, expires_at)
    VALUES (${hash}, ${ticket.kind}, ${actor.id}, ${digest}, ${JSON.stringify(ticket)}::jsonb, now() + interval '5 minutes')
  `)
  return { ticket: secret, path: '/api/mcp-upload', header: 'X-MCP-Upload-Ticket', expiresIn: 300, maxBytes: ticket.kind === 'media' ? mediaLimit : csvLimit }
}

async function readFile(req: PayloadRequest, limit: number): Promise<File> {
  const maxBody = limit + multipartOverhead
  const contentType = req.headers.get('content-type')
  if (!contentType?.startsWith('multipart/form-data;') || !req.body) {
    throw businessError('Send a multipart request with one file field named file.', 'MCP_INVALID_MULTIPART', 400)
  }
  const chunks: Buffer[] = []
  let length = 0
  const reader = req.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBody) {
        await reader.cancel()
        throw businessError('Upload exceeds the size limit.', 'MCP_FILE_TOO_LARGE', 413)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': contentType } }).formData()
    .catch(() => { throw businessError('Malformed multipart upload.', 'MCP_INVALID_MULTIPART', 400) })
  const file = form.get('file')
  if (typeof file === 'string' || !file || Array.from(form.keys()).length !== 1 || !file.size) {
    throw businessError('Send exactly one non-empty file.', 'MCP_INVALID_FILE', 400)
  }
  if (file.size > limit) throw businessError('Upload exceeds the size limit.', 'MCP_FILE_TOO_LARGE', 413)
  return file
}

async function upload(req: PayloadRequest): Promise<Response> {
  const secret = req.headers.get('x-mcp-upload-ticket')
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Forbidden()
  const db = database(req)
  const hash = createHash('sha256').update(secret).digest('hex')
  const { rows: [row] } = await db.execute(sql`
    SELECT actor_id, key_digest, payload FROM mcp_transfers
    WHERE id = ${hash} AND kind IN ('media', 'csv') AND expires_at > now()
  `)
  if (!row) throw invalidTransfer()
  const ticket = ticketSchema.parse(row.payload)
  const file = await readFile(req, ticket.kind === 'media' ? mediaLimit : csvLimit)

  const { docs: [document] } = await req.payload.find({
    collection: 'payload-mcp-api-keys',
    where: { apiKeyIndex: { equals: row.key_digest } },
    limit: 1, depth: 1, req, overrideAccess: true,
  })
  const owner = document?.user
  const parsed = mcpKeySchema.safeParse({
    ...document, user: typeof owner === 'object' && owner ? { ...owner, collection: 'admins' } : owner,
  })
  const capability = ticket.kind === 'media' ? 'prepareMediaUpload' : 'prepareCsvImport'
  if (!owner || typeof owner !== 'object' || !parsed.success || parsed.data.user.id !== row.actor_id || document?.['payload-mcp-tool']?.[capability] !== true) {
    throw new Forbidden()
  }
  req.user = { ...owner, collection: 'admins' }
  const consumed = await db.execute(sql`DELETE FROM mcp_transfers WHERE id = ${hash} AND expires_at > now() RETURNING id`)
  if (consumed.rows.length !== 1) throw invalidTransfer()
  const data = Buffer.from(await file.arrayBuffer())

  if (ticket.kind === 'media') {
    const metadata = await sharp(data).metadata().catch(() => null)
    const format = metadata?.format === 'heif' && metadata.compression === 'av1' ? 'avif' : metadata?.format
    if (!format || !metadata?.width || !metadata.height || !['jpeg', 'png', 'webp', 'avif'].includes(format)) {
      throw businessError('Use a JPEG, PNG, WebP or AVIF image.', 'MCP_INVALID_IMAGE', 400)
    }
    if (metadata.width * metadata.height > 40_000_000) {
      throw businessError('Use an image of at most 40 megapixels.', 'MCP_IMAGE_TOO_LARGE', 413)
    }
    const doc = await req.payload.create({
      collection: 'media', req, depth: 0, overrideAccess: false,
      data: { alt: ticket.alt },
      file: { data, name: basename(file.name), mimetype: `image/${format}`, size: data.byteLength },
    })
    req.payload.logger.info({ msg: 'MCP upload', tool: capability, actor: row.actor_id, id: doc.id, result: 'ok' })
    return Response.json({ id: doc.id, url: doc.url, alt: doc.alt }, { status: 201 })
  }

  let csv: string
  try {
    csv = new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    throw businessError('Use a UTF-8 CSV file.', 'MCP_INVALID_CSV', 400)
  }
  const preview = await getStockImportPreview(req, { ...ticket, csv })
  const previewId = randomUUID()
  await db.execute(sql`
    INSERT INTO mcp_transfers (id, kind, actor_id, key_digest, payload, expires_at)
    VALUES (${previewId}, 'preview', ${row.actor_id}, ${row.key_digest}, ${JSON.stringify(preview)}::jsonb, now() + interval '15 minutes')
  `)
  req.payload.logger.info({ msg: 'MCP upload', tool: capability, actor: row.actor_id, id: previewId, result: 'ok' })
  return Response.json({ previewId, total: preview.total, errorCount: preview.errors.length, priceChanges: preview.priceChanges, stockChanges: preview.stockChanges }, { status: 201 })
}

export const mcpUploadEndpoint: Endpoint = {
  path: '/mcp-upload',
  method: 'post',
  handler: async req => {
    if (!mcpEnabled) return new Response(null, { status: 404 })
    try {
      const response = await upload(req)
      response.headers.set('Cache-Control', 'no-store')
      return response
    } catch (error) {
      const known = error instanceof APIError && error.isPublic
      const status = known ? error.status : error instanceof z.ZodError ? 400 : 500
      req.payload.logger.warn({ msg: 'MCP upload', actor: req.user?.id, status, result: 'error' })
      return Response.json({ error: known ? error.message : status === 400 ? 'Invalid upload input.' : 'Upload failed.' }, {
        status, headers: { 'Cache-Control': 'no-store' },
      })
    }
  },
}

export async function csvPreview(req: PayloadRequest, id: string, page: number, apply = false) {
  const actor = requireMcpManager(req.user)
  const digest = keyDigest(req)
  const db = database(req)
  const filter = sql`id = ${id} AND kind = 'preview' AND actor_id = ${actor.id} AND key_digest = ${digest} AND expires_at > now()`
  const { rows: [row] } = await db.execute(apply
    ? sql`DELETE FROM mcp_transfers WHERE ${filter} AND payload->>'token' IS NOT NULL AND jsonb_array_length(payload->'errors') = 0 RETURNING payload`
    : sql`SELECT payload FROM mcp_transfers WHERE ${filter}`)
  if (!row) throw invalidTransfer()
  const preview = previewSchema.parse(row.payload)
  if (apply) return applyStockImport(req, () => ({ token: preview.token }))
  const offset = (page - 1) * 20
  return {
    page, total: preview.total, rowCount: preview.rows.length, errorCount: preview.errors.length,
    priceChanges: preview.priceChanges, stockChanges: preview.stockChanges, canApply: Boolean(preview.token) && !preview.errors.length,
    rows: preview.rows.slice(offset, offset + 20), errors: preview.errors.slice(offset, offset + 20),
  }
}
