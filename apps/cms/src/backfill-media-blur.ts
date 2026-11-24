import { join, basename, resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { getPayload } from 'payload'
import { createBlurCss } from './collections/media/media-blur'

async function backfill() {
  const { values } = parseArgs({ options: { apply: { type: 'boolean' }, 'batch-size': { type: 'string', default: '50' } } })
  const limit = Number(values['batch-size'])
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Batch size must be 1–200')
  if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || process.env.DATABASE_URI || '')) {
    throw new Error('Set DATABASE_URL or DATABASE_URI to the PostgreSQL instance to inspect')
  }
  if (process.env.PAYLOAD_DROP_DATABASE === 'true') throw new Error('Unset PAYLOAD_DROP_DATABASE before processing media')

  const { default: config } = await import('./payload.config')
  const cmsConfig = await config
  const payload = await getPayload({
    config: {
      ...cmsConfig,
      telemetry: false,
      db: {
        ...cmsConfig.db,
        init: args => {
          const adapter = cmsConfig.db.init(args)
          // Report mode too expects an already migrated database.
          if ('prodMigrations' in adapter) adapter.prodMigrations = undefined
          if ('disableCreateDatabase' in adapter) adapter.disableCreateDatabase = true
          return adapter
        },
      },
    },
    disableOnInit: true,
  })
  const report = { mode: values.apply ? 'apply' : 'report', complete: 0, pending: 0, updated: 0, skipped: 0, failed: 0, retryLater: 0 }
  try {
    const directory = resolve(process.env.MEDIA_DIR || payload.collections.media.config.upload.staticDir || 'media')
    let after = 0
    while (true) {
      const { docs } = await payload.find({
        collection: 'media', depth: 0, limit, sort: 'id', where: { id: { greater_than: after } },
        select: { filename: true, mimeType: true, blurCSS: true, updatedAt: true },
      })
      if (!docs.length) break
      for (const media of docs) {
        after = media.id
        if (!media.mimeType?.startsWith('image/') || !media.filename || basename(media.filename) !== media.filename) {
          report.skipped++
          continue
        }
        if (media.blurCSS) {
          report.complete++
          continue
        }
        if (!values.apply) {
          report.pending++
          continue
        }
        try {
          const source = join(directory, media.filename)
          if (!(await stat(source)).isFile()) throw new Error('Original file is missing')
          const blur = await createBlurCss(source)
          // Only the preview is written; a concurrently replaced file leaves the record for the next run.
          const updated = await payload.db.updateOne({
            collection: 'media',
            where: { id: { equals: media.id }, filename: { equals: media.filename }, updatedAt: { equals: media.updatedAt } },
            data: { blurCSS: blur },
            options: { atomic: true },
          })
          if (updated) report.updated++
          else report.retryLater++
        } catch (error) {
          report.failed++
          console.error('Media', media.id, error instanceof Error ? error.message : String(error))
        }
      }
    }
    console.log(JSON.stringify(report))
    if (report.failed) process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

await backfill()
await Promise.all([process.stdout, process.stderr].map(stream =>
  new Promise<void>(resolve => stream.write('', () => resolve())),
))
// The Payload Postgres adapter keeps its startup connection checked out.
process.exit(process.exitCode)
