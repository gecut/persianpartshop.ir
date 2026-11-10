import type { Payload, PayloadRequest } from 'payload'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

type Notification = () => Promise<void>
const pending = new WeakMap<Payload, Map<string | number, Map<string, Notification>>>()
const transactionOptions = z.object({
  isolationLevel: z.enum(['read uncommitted', 'read committed', 'repeatable read', 'serializable']).optional(),
  accessMode: z.enum(['read only', 'read write']).optional(),
  deferrable: z.boolean().optional(),
}).strict()

export function installCommittedSms(payload: Payload): void {
  if (pending.has(payload)) return
  const transactions = new Map<string | number, Map<string, Notification>>()
  pending.set(payload, transactions)
  let commit = payload.db.commitTransaction.bind(payload.db)
  const rollback = payload.db.rollbackTransaction.bind(payload.db)
  if (payload.db.name === 'postgres') {
    // Payload 3.90.2's lifted Drizzle transaction catches and loses COMMIT failures.
    // Own the completion promise while retaining the adapter's public session contract.
    // Payload's global adapter type is augmented by both SQLite and PostgreSQL imports.
    // The runtime name check establishes which adapter/session implementation is present.
    const postgres = payload.db as unknown as PostgresAdapter
    postgres.beginTransaction = async options => {
      if (postgres.transactionOptions === false) return null
      await postgres.initializing
      const configured = options ?? postgres.transactionOptions
      const config = configured == null ? undefined : transactionOptions.parse(configured)
      const id = randomUUID()
      let finish!: () => void
      let abort!: (reason: Error) => void
      const work = new Promise<void>((resolve, reject) => { finish = resolve; abort = reject })
      let ready!: () => void
      let failed!: (error: unknown) => void
      const started = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject })
      const done = postgres.drizzle.transaction(async db => {
        postgres.sessions[id] = {
          db,
          resolve: async () => { finish(); await done },
          reject: async () => { abort(new Error('Transaction rolled back')); await done.catch(() => {}) },
        }
        ready()
        await work
      }, config)
      // Handle pre-start connection failures as well as the later completion rejection.
      void done.catch(failed)
      await started
      return id
    }
    commit = async id => {
      const key = await id
      const session = postgres.sessions[key]
      if (!session) throw new Error('Cannot commit an ended transaction')
      delete postgres.sessions[key]
      await session.resolve()
    }
  }
  payload.db.commitTransaction = async id => {
    const key = await id
    try {
      await commit(id)
      const notifications = transactions.get(key)
      transactions.delete(key)
      for (const notify of notifications?.values() ?? []) {
        try { await notify() } catch { payload.logger.error('[SMS] Post-commit notification failed') }
      }
    } catch (error) {
      transactions.delete(key)
      throw error
    }
  }
  payload.db.rollbackTransaction = async id => {
    transactions.delete(await id)
    await rollback(id)
  }
  const destroy = payload.db.destroy?.bind(payload.db)
  if (destroy) payload.db.destroy = async () => {
    transactions.clear()
    await destroy()
  }
}

export async function sendAfterCommit(req: PayloadRequest, key: string, notify: Notification): Promise<void> {
  const id = await req.transactionID
  if (id == null) throw new Error('SMS notification requires a transaction')
  const transactions = pending.get(req.payload)
  if (!transactions) throw new Error('Post-commit SMS is not installed')
  let notifications = transactions.get(id)
  if (!notifications) { notifications = new Map(); transactions.set(id, notifications) }
  notifications.set(key, notify)
}
