import type { Payload } from 'payload'
import { sendKavenegarPattern } from './kavenegar-client'

export async function processSmsQueueTick(payload: Payload): Promise<number> {
  const now = new Date()
  const pendingJobs = await payload.find({
    collection: 'sms-queue',
    where: {
      or: [
        { status: { equals: 'pending' } },
        {
          and: [
            { status: { equals: 'retry_scheduled' } },
            { nextRetryAt: { less_than_equal: now.toISOString() } },
          ],
        },
      ],
    },
    sort: 'createdAt',
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })

  let processedCount = 0

  for (const job of pendingJobs.docs as any[]) {
    processedCount++
    const tokens = typeof job.tokens === 'string' ? JSON.parse(job.tokens) : (job.tokens || {})
    try {
      await sendKavenegarPattern({
        template: job.template,
        receptor: job.receptor,
        tokens,
      })

      const finalAttempts = (job.attempts || 0) + 1
      await payload.update({
        collection: 'sms-queue',
        id: job.id,
        data: {
          status: 'sent',
          attempts: finalAttempts,
          sentAt: new Date().toISOString(),
          lastError: null,
        },
        overrideAccess: true,
      })
    } catch (err: any) {
      const attempts = (job.attempts || 0) + 1
      if (attempts < 2) {
        const nextRetryAt = new Date(Date.now() + 30_000).toISOString()
        await payload.update({
          collection: 'sms-queue',
          id: job.id,
          data: {
            status: 'retry_scheduled',
            attempts,
            nextRetryAt,
            lastError: err?.message || String(err),
          },
          overrideAccess: true,
        })
      } else {
        await payload.update({
          collection: 'sms-queue',
          id: job.id,
          data: {
            status: 'failed',
            attempts,
            lastError: err?.message || String(err),
          },
          overrideAccess: true,
        })
      }
    }
  }

  return processedCount
}

export function startSmsQueueWorker(payload: Payload, intervalMs = 10_000): () => void {
  let isRunning = false

  const tick = async () => {
    if (isRunning) return
    isRunning = true
    try {
      await processSmsQueueTick(payload)
    } catch (e) {
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
