import { createHash, randomUUID } from 'node:crypto'
import { link, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { getPayload, type Payload } from 'payload'
import { galleryImageSizes } from './collections/media/media.collection'
import type { Media } from './payload-types'

async function exists(path: string) {
  return stat(path).then(file => file.isFile() && file.size > 0, (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return false
    throw error
  })
}

async function writeVariant(path: string, data: Buffer) {
  const temp = path + '.' + randomUUID() + '.tmp'
  try {
    await writeFile(temp, data, { flag: 'wx' })
    await link(temp, path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })
  } finally {
    await rm(temp, { force: true })
  }
}

async function catalogCoverage(payload: Payload, limit: number) {
  const roles = { cover: new Set<number>(), gallery: new Set<number>() }
  const idOf = (media: number | Media) => typeof media === 'number' ? media : media.id
  let after = 0
  for (;;) {
    const { docs } = await payload.find({
      collection: 'products', depth: 0, sort: 'id', limit, where: { id: { greater_than: after } },
      select: { cover: true, gallery: true },
    })
    if (!docs.length) return roles
    for (const product of docs) {
      after = product.id
      if (product.cover) roles.cover.add(idOf(product.cover))
      for (const { image } of product.gallery ?? []) roles.gallery.add(idOf(image))
    }
  }
}

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
          // The backfill, including report mode, expects an already migrated database.
          if ('prodMigrations' in adapter) adapter.prodMigrations = undefined
          if ('disableCreateDatabase' in adapter) adapter.disableCreateDatabase = true
          return adapter
        },
      },
    },
    disableOnInit: true,
  })
  const report = { mode: values.apply ? 'apply' : 'report', complete: 0, pending: 0, updated: 0, skipped: 0, failed: 0 }
  try {
    const directory = resolve(process.env.MEDIA_DIR || payload.collections.media.config.upload.staticDir || 'media')
    const roles = await catalogCoverage(payload, limit)
    const covered = () => ({ galleryThumb: 0, galleryPreview: 0 })
    const counts = {
      cover: { total: roles.cover.size, before: covered(), after: covered() },
      gallery: { total: roles.gallery.size, before: covered(), after: covered() },
    }
    const tally = (id: number, name: (typeof galleryImageSizes)[number]['name'], stage: 'before' | 'after') => {
      if (roles.cover.has(id)) counts.cover[stage][name]++
      if (roles.gallery.has(id)) counts.gallery[stage][name]++
    }
    let after = 0
    while (true) {
      const { docs } = await payload.find({
        collection: 'media', depth: 0, limit, sort: 'id', where: { id: { greater_than: after } },
        select: { filename: true, mimeType: true, sizes: true, updatedAt: true },
      })
      if (!docs.length) break
      for (const media of docs) {
        after = media.id
        if (!media.mimeType?.startsWith('image/') || !media.filename) {
          report.skipped++
          continue
        }
        try {
          if (basename(media.filename) !== media.filename) throw new Error('Invalid source filename')
          const missing: (typeof galleryImageSizes)[number][] = []
          for (const variant of galleryImageSizes) {
            const filename = media.sizes?.[variant.name]?.filename
            if (!filename || basename(filename) !== filename || !await exists(join(directory, filename))) {
              missing.push(variant)
            } else {
              tally(media.id, variant.name, 'before')
              tally(media.id, variant.name, 'after')
            }
          }
          if (!missing.length) {
            report.complete++
            continue
          }
          const source = join(directory, media.filename)
          if (!await exists(source)) throw new Error('Original file is missing')
          if (!values.apply) {
            report.pending++
            continue
          }

          const sizes: NonNullable<Media['sizes']> = {}
          const image = sharp(source, { animated: true }).autoOrient()
          const metadata = await image.metadata()
          for (const { name, edge, quality } of missing) {
            const { data, info } = await image.clone()
              .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
              .webp({ quality, alphaQuality: 100, effort: 4 })
              .toBuffer({ resolveWithObject: true })
            const hash = createHash('sha256').update(data).digest('hex').slice(0, 24)
            const filename = ['gallery', media.id, edge, hash].join('-') + '.webp'
            await writeVariant(join(directory, filename), data)
            sizes[name] = {
              filename, width: info.width, height: info.height / (metadata.pages || 1),
              filesize: info.size, mimeType: 'image/webp',
            }
          }
          // This touches only the generated sizes, and skips a concurrently replaced original.
          const updated = await payload.db.updateOne({
            collection: 'media',
            where: { id: { equals: media.id }, filename: { equals: media.filename }, updatedAt: { equals: media.updatedAt } },
            data: { sizes },
            options: { atomic: true },
          })
          if (!updated) throw new Error('Original changed during processing. Run the command again.')
          for (const variant of missing) tally(media.id, variant.name, 'after')
          report.updated++
        } catch (error) {
          report.failed++
          console.error('Media', media.id, error instanceof Error ? error.message : String(error))
        }
      }
    }
    console.log(JSON.stringify({ ...report, catalog: counts }))
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
