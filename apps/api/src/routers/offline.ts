import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, basename } from 'node:path'
import { gzipSync } from 'node:zlib'
import { Pool, type PoolClient } from 'pg'
import { ORPCError } from '@orpc/server'
import { OfflineManifestSchema, type OfflineManifest, type OfflineSnapshot } from '@persianpart/contract'
import { offlineAccessUntil } from '../lib/offline-access'
import { createContext } from '../rpc/context'
import { customerOnly } from '../rpc/base'
import { catalogScope } from './catalog-sync'
import { readOfflineData, structuralOfflineData } from './offline-data'

function positiveLimit(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

const ttl = positiveLimit('OFFLINE_SNAPSHOT_TTL_MS', 7 * 24 * 60 * 60 * 1000)
const rateLimit = positiveLimit('OFFLINE_SNAPSHOT_RATE_LIMIT_MS', 5 * 60 * 1000)
const maxBuilders = positiveLimit('OFFLINE_SNAPSHOT_MAX_BUILDERS', 4)
const maxSnapshots = positiveLimit('OFFLINE_SNAPSHOT_MAX_RETAINED', 100)
const maxSnapshotBytes = positiveLimit('OFFLINE_SNAPSHOT_MAX_BYTES', 8 * 1024 * 1024)
const maxStoredBytes = positiveLimit('OFFLINE_SNAPSHOT_MAX_STORED_BYTES', maxSnapshots * maxSnapshotBytes)
const configured = () => process.env.OFFLINE_SNAPSHOTS_ENABLED === 'true'
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const mediaDir = () => resolve(process.env.MEDIA_DIR || fileURLToPath(new URL('../../../cms/media', import.meta.url)))
let pool: Pool | undefined
function database() {
  const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_URI
  if (!configured() || !connectionString) throw new ORPCError('SERVICE_UNAVAILABLE')
  return pool ??= new Pool({ connectionString, max: maxBuilders + 4 })
}

async function revision(client: Pick<PoolClient, 'query'>, includeStock = true) {
  const result = await client.query<{ key: string }>(`
    SELECT md5(string_agg(source || ':' || revision, ',' ORDER BY source)) AS key FROM offline_source_revision
    WHERE $1 OR source <> 'warehouse_stock'
  `, [includeStock])
  const key = result.rows[0]?.key
  if (!key) throw new ORPCError('SERVICE_UNAVAILABLE')
  return key
}

function mediaPath(value: unknown): string | undefined {
  if (value && typeof value === 'object') {
    if ('url' in value && typeof value.url === 'string' && value.url) return mediaPath(value.url)
    if ('filename' in value && typeof value.filename === 'string') return mediaPath(value.filename)
    return
  }
  if (typeof value !== 'string' || !/\.(?:jpe?g|png|webp|avif|gif)(?:[?#]|$)/i.test(value)) return
  const cdn = process.env.CDN_URL ? new URL(process.env.CDN_URL).origin : undefined
  const url = new URL(value, cdn ? cdn + '/' : 'https://offline.invalid/api/media/file/')
  if (url.username || url.password || (url.origin !== cdn &&
    (url.origin !== 'https://offline.invalid' || !url.pathname.startsWith('/api/media/file/')))) {
    throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'نسخهٔ قابل‌دریافت رسانه در دسترس نیست.' })
  }
  return url.origin === 'https://offline.invalid' ? url.pathname : url.href
}

async function mediaEntries(data: OfflineSnapshot) {
  const urls = new Set<string>()
  const add = (value: unknown) => {
    const path = mediaPath(value)
    if (path) urls.add(path)
  }
  for (const product of Object.values(data.products)) {
    add(product.cover)
    product.gallery?.forEach(item => add(item.image))
  }
  for (const item of data.activity) {
    if (item.kind === 'order') item.productImages.forEach(add)
    else add(item.productImage)
  }
  for (const item of Object.values(data.supplies)) add(item.productImage)
  for (const order of Object.values(data.orders)) {
    for (const item of order.items) {
      if (typeof item.product === 'object' && item.product) add(item.product.cover)
    }
  }
  const media: OfflineManifest['media'] = []
  for (const path of [...urls].sort()) {
    const name = decodeURIComponent(basename(new URL(path, 'https://offline.invalid').pathname))
    if (!name || name !== basename(name) || name.includes('\\') || name === '..') throw new ORPCError('SERVICE_UNAVAILABLE')
    const bytes = await readFile(resolve(mediaDir(), name)).catch(() => undefined)
    if (!bytes?.length) throw new ORPCError('SERVICE_UNAVAILABLE', { message: 'فایل یک تصویر بسته در دسترس نیست.' })
    media.push({ path, hash: sha(bytes), bytes: bytes.length })
  }
  return media
}

type SnapshotRow = { manifest: unknown; source_revision: string; structural_revision: string }
const checks = new Map<string, Promise<void>>()

function scheduleFreshness(context: Parameters<typeof readOfflineData>[0], scopeKey: string, source: string) {
  const account = String(context.user?.id)
  if (checks.has(account) || checks.size >= maxBuilders) return
  const db = database()
  const work = (async () => {
    const currentContext = await createContext(context.req)
    if (!currentContext.user || currentContext.authUnavailable || (await catalogScope(currentContext)).scopeKey !== scopeKey) return
    const data = await readOfflineData(currentContext, scopeKey)
    const media = await mediaEntries(data)
    if (source !== await revision(db, false)) return
    const version = sha(JSON.stringify({ data: structuralOfflineData(data), media }))
    await db.query(`
      UPDATE offline_snapshots SET latest_structural_revision = $2, latest_version = $3
      WHERE account_id = $1 AND manifest ->> 'scopeKey' = $4
    `, [account, source, version, scopeKey])
  })().catch(() => { console.error('offline freshness verification failed') })
    .finally(() => { checks.delete(account) })
  checks.set(account, work)
}
const status = customerOnly.offline.status.handler(async ({ input, context }) => {
  const { scopeKey } = await catalogScope(context)
  const unknown = { scopeKey, freshness: 'unknown' as const }
  if (scopeKey !== input.scopeKey) return unknown
  const db = database()
  const result = await db.query<SnapshotRow & { latest_structural_revision: string | null; latest_version: string | null }>(
    'SELECT manifest, source_revision, structural_revision, latest_structural_revision, latest_version FROM offline_snapshots WHERE account_id = $1 AND expires_at > now()', [context.user.id],
  )
  const row = result.rows[0]
  if (!row) return unknown
  const current = OfflineManifestSchema.parse(row.manifest)
  if (current.scopeKey !== scopeKey) return unknown
  const observed = await revision(db, false)
  const version = row.structural_revision === observed ? current.version :
    row.latest_structural_revision === observed ? row.latest_version : null
  if (!version) {
    scheduleFreshness({ ...context, req: new Request(context.req.url, { headers: context.req.headers, signal: AbortSignal.timeout(60_000) }) }, scopeKey, observed)
    return unknown
  }
  return { scopeKey, freshness: version === input.version ? 'upToDate' : 'updateAvailable' }
})

const manifest = customerOnly.offline.manifest.handler(async ({ input, context }) => {
  const { scopeKey } = await catalogScope(context)
  const now = Date.now()
  const accessUntil = offlineAccessUntil(context.jwtPayload?.exp, now)
  if (!accessUntil || accessUntil <= now) throw new ORPCError('UNAUTHORIZED')
  const db = database()
  const connection = await db.connect()
  try {
    await connection.query('BEGIN')
    const account = Number(context.user.id)
    if (!Number.isSafeInteger(account) || account <= 0) throw new ORPCError('UNAUTHORIZED')
    await connection.query('SELECT pg_advisory_xact_lock(780261, $1)', [account])
    const existing = await connection.query<SnapshotRow>('SELECT manifest, source_revision, structural_revision FROM offline_snapshots WHERE account_id = $1 AND expires_at > now()', [account])
    const previous = existing.rows[0]
    const saved = previous && OfflineManifestSchema.parse(previous.manifest)
    const before = await revision(connection)
    const structuralRevision = await revision(connection, false)
    if (saved && saved.scopeKey === scopeKey) {
      if (!input.replace || previous.source_revision === before) {
        await connection.query('COMMIT')
        return saved
      }
      }
    if (saved && now - saved.capturedAt < rateLimit) throw new ORPCError('TOO_MANY_REQUESTS')
    let slot = false
    for (let index = 1; index <= maxBuilders; index++) {
      const result = await connection.query<{ locked: boolean }>('SELECT pg_try_advisory_xact_lock(780262, $1) AS locked', [index])
      if (result.rows[0]?.locked) { slot = true; break }
    }
    if (!slot) throw new ORPCError('TOO_MANY_REQUESTS')

    // The adapters use separate CMS connections. Accept a capture only when every
    // tracked table has the same revision on both sides of the read.
    const data = await readOfflineData(context, scopeKey)
    const media = await mediaEntries(data)
    const after = await revision(connection)
    if (before !== after || structuralRevision !== await revision(connection, false)) throw new ORPCError('CONFLICT', { message: 'داده‌ها هنگام آماده‌سازی تغییر کردند. دوباره تلاش کنید.' })
    const confirmed = await createContext(context.req)
    if (confirmed.authUnavailable) throw new ORPCError('SERVICE_UNAVAILABLE')
    if (!confirmed.user || String(confirmed.user.id) !== String(account) || Date.now() >= accessUntil) throw new ORPCError('UNAUTHORIZED')
    if ((await catalogScope(confirmed)).scopeKey !== scopeKey) throw new ORPCError('CONFLICT')
    const raw = Buffer.from(JSON.stringify(data))
    if (raw.length > maxSnapshotBytes) throw new ORPCError('PAYLOAD_TOO_LARGE')
    const body = gzipSync(raw)
    await connection.query('SELECT pg_advisory_xact_lock(780263, 1)')
    const capacity = await connection.query<{ count: number; bytes: string }>(
      'SELECT count(*)::int AS count, coalesce(sum(octet_length(body)), 0)::text AS bytes FROM offline_snapshots WHERE account_id <> $1',
      [account],
    )
    if ((capacity.rows[0]?.count ?? 0) >= maxSnapshots || Number(capacity.rows[0]?.bytes ?? 0) + body.length > maxStoredBytes) {
      throw new ORPCError('TOO_MANY_REQUESTS')
    }
    const result: OfflineManifest = {
      id: randomUUID(), scopeKey, version: sha(JSON.stringify({ data: structuralOfflineData(data), media })),
      dataHash: sha(raw), capturedAt: now, expiresAt: Math.min(accessUntil, now + ttl), format: 1,
      compressedBytes: body.length, dataBytes: raw.length, media,
      counts: {
        products: Object.keys(data.products).length, dimensions: data.dimensions.length, qr: Object.keys(data.qr).length,
        activity: data.activity.length, plans: data.plans.length, orders: Object.keys(data.orders).length,
        supplies: Object.keys(data.supplies).length,
      },
    }
    await connection.query(`
      INSERT INTO offline_snapshots (account_id, snapshot_id, expires_at, source_revision, manifest, body, structural_revision)
      VALUES ($1, $2, to_timestamp($3 / 1000.0), $4, $5, $6, $7)
      ON CONFLICT (account_id) DO UPDATE SET snapshot_id = EXCLUDED.snapshot_id, expires_at = EXCLUDED.expires_at,
        source_revision = EXCLUDED.source_revision, manifest = EXCLUDED.manifest, body = EXCLUDED.body,
        structural_revision = EXCLUDED.structural_revision, latest_structural_revision = NULL, latest_version = NULL
    `, [account, result.id, result.expiresAt, after, result, body, structuralRevision])
    await connection.query('COMMIT')
    return result
  } catch (error) {
    await connection.query('ROLLBACK')
    throw error
  } finally {
    connection.release()
  }
})

const snapshot = customerOnly.offline.snapshot.handler(async ({ input, context }) => {
  const { scopeKey } = await catalogScope(context)
  const result = await database().query<{ body: Buffer; manifest: unknown }>(
    'SELECT body, manifest FROM offline_snapshots WHERE account_id = $1 AND snapshot_id = $2 AND expires_at > now()',
    [context.user.id, input.id],
  )
  const row = result.rows[0]
  if (!row || OfflineManifestSchema.parse(row.manifest).scopeKey !== scopeKey) throw new ORPCError('NOT_FOUND')
  return { gzip: row.body.toString('base64') }
})

export const offline = { status, manifest, snapshot }

export function startOfflineSnapshotCleanup() {
  if (!configured()) return
  const cleanup = async () => {
    try { await database().query('DELETE FROM offline_snapshots WHERE expires_at <= now()') }
    catch { console.error('offline snapshot cleanup failed') }
  }
  const interval = setInterval(() => void cleanup(), positiveLimit('OFFLINE_SNAPSHOT_CLEANUP_MS', 60 * 60 * 1000))
  interval.unref()
  void cleanup()
}
