import type { Payload } from 'payload'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { sendKavenegarPattern } from './kavenegar-client'

const BATCH_SIZE = 10
const SEND_CONCURRENCY = 3
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 30_000
// Far above the provider timeout: a job still claimed after this belongs to a dead process.
const STALE_CLAIM_SECONDS = 120

export interface ClaimedSmsJob {
  id: number
  receptor: string
  template: string
  tokens: unknown
  attempts: number
}

interface SmsQueueDeps {
  claim: (payload: Payload, limit: number) => Promise<ClaimedSmsJob[]>
  send: typeof sendKavenegarPattern
}

/**
 * Atomically moves due jobs to `sending`. SKIP LOCKED lets concurrent ticks or replicas
 * claim disjoint jobs; stale claims are re-taken, so delivery is at-least-once.
 */
export async function claimSmsJobs(payload: Payload, limit: number): Promise<ClaimedSmsJob[]> {
  if (payload.db.name !== 'postgres') throw new Error('SMS queue requires PostgreSQL.')
  // Payload's global adapter type is augmented by several adapters; the name check selects PostgreSQL.
  const db = (payload.db as unknown as PostgresAdapter).drizzle
  const result = await db.execute(sql`
    UPDATE sms_queue SET status = 'sending', claimed_at = NOW(), updated_at = NOW()
    WHERE id IN (
      SELECT id FROM sms_queue
      WHERE status = 'pending'
        OR (status = 'retry_scheduled' AND next_retry_at <= NOW())
        OR (status = 'sending' AND claimed_at < NOW() - make_interval(secs => ${STALE_CLAIM_SECONDS}))
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, receptor, template, tokens, attempts
  `)
  return result.rows.map(row => ({
    id: Number(row.id),
    receptor: String(row.receptor),
    template: String(row.template),
    tokens: row.tokens,
    attempts: Number(row.attempts) || 0,
  }))
}

async function runLimited<T>(items: readonly T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const lane = async () => {
    while (next < items.length) await run(items[next++]!)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}

const parseTokens = (tokens: unknown): Record<string, string> =>
  typeof tokens === 'string' ? JSON.parse(tokens) : ((tokens as Record<string, string> | null) ?? {})

async function deliver(payload: Payload, job: ClaimedSmsJob, send: SmsQueueDeps['send']): Promise<void> {
  const attempts = job.attempts + 1
  let failure: string | null = null
  try {
    await send({ template: job.template, receptor: job.receptor, tokens: parseTokens(job.tokens) } as Parameters<typeof send>[0])
  } catch (err: any) {
    failure = err?.message || String(err)
  }
  // Only a provider failure schedules a retry; a failed status write propagates to the caller.
  await payload.update({
    collection: 'sms-queue',
    id: job.id,
    data: failure == null
      ? { status: 'sent', attempts, sentAt: new Date().toISOString(), lastError: null }
      : attempts < MAX_ATTEMPTS
        ? { status: 'retry_scheduled', attempts, nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS).toISOString(), lastError: failure }
        : { status: 'failed', attempts, lastError: failure },
    overrideAccess: true,
  })
}

export async function processSmsQueueTick(
  payload: Payload,
  deps: SmsQueueDeps = { claim: claimSmsJobs, send: sendKavenegarPattern },
): Promise<number> {
  const jobs = await deps.claim(payload, BATCH_SIZE)
  await runLimited(jobs, SEND_CONCURRENCY, async job => {
    try {
      await deliver(payload, job, deps.send)
    } catch (err) {
      // A failed status write leaves the claim to expire and be retried.
      payload.logger.error({ msg: '[SmsQueueWorker] Job status update failed', jobId: job.id, err })
    }
  })
  return jobs.length
}

export function startSmsQueueWorker(payload: Payload, intervalMs = 10_000): () => void {
  let isRunning = false

  const tick = async () => {
    if (isRunning) return
    isRunning = true
    try {
      await processSmsQueueTick(payload)
    } catch (e: any) {
      if (e?.message?.includes("reading 'query'")) return
      payload.logger.error({ msg: '[SmsQueueWorker] Tick error', err: e })
    } finally {
      isRunning = false
    }
  }

  // Trigger an initial tick shortly after startup
  const startupTimer = setTimeout(tick, 1000)
  if (typeof startupTimer.unref === 'function') {
    startupTimer.unref()
  }

  const timer = setInterval(tick, intervalMs)
  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  return () => {
    clearTimeout(startupTimer)
    clearInterval(timer)
  }
}
