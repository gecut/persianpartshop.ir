import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { getPayload } from 'payload'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { getTableConfig } from '@payloadcms/db-postgres/drizzle/pg-core'
import type { MigrateUpArgs, MigrateDownArgs, PostgresAdapter } from '@payloadcms/db-postgres'
import { migrations } from './migrations/index'

const require = createRequire(import.meta.url)
const pg = require(require.resolve('pg', { paths: [require.resolve('@payloadcms/db-postgres')] })) as PostgresAdapter['pg']

test('clean baseline migration: full schema coverage, CRUD, and clean teardown', { skip: !process.env.CMS_MIGRATION_TEST_DATABASE_URI }, async () => {
  const target = new URL(process.env.CMS_MIGRATION_TEST_DATABASE_URI!)
  assert.ok(target.protocol === 'postgres:' || target.protocol === 'postgresql:')
  assert.ok(target.hostname === '127.0.0.1' || target.hostname === 'localhost' || target.hostname === '[::1]')
  assert.equal(target.port, '55483')
  assert.equal(target.pathname, '/postgres')

  const name = `cms_migration_test_${randomUUID().replaceAll('-', '')}`
  assert.match(name, /^cms_migration_test_[a-f0-9]+$/)

  const control = new pg.Pool({ connectionString: target.href })
  target.pathname = `/${name}`
  const pool = new pg.Pool({ connectionString: target.href })
  const db = drizzle(pool)

  process.env.DATABASE_URI = target.href
  process.env.DATABASE_URL = process.env.DATABASE_URI
  process.env.CMS_STOCK_WRITE_MODE = 'manual'
  const { default: config } = await import('./payload.config')
  const payload = await getPayload({ config, disableDBConnect: true })

  const applyUp = async () => db.transaction(async transaction => {
    await migrations[0]!.up({ db: transaction, payload } as unknown as MigrateUpArgs)
  })

  const applyDown = async () => db.transaction(async transaction => {
    await migrations[0]!.down({ db: transaction, payload } as unknown as MigrateDownArgs)
  })

  try {
    await control.query(`CREATE DATABASE "${name}"`)
    assert.equal(migrations.length, 1)

    // 1. Apply baseline migration
    await applyUp()
    console.log('baseline migration applied: PASS')

    // 2. Validate columns, nullability, data types, indexes and foreign keys against Payload's metadata
    const columns = (await pool.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
      `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public'`
    )).rows
    const indexes = (await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public'`
    )).rows.map(row => row.indexname)
    const constraints = (await pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE contype='f'`
    )).rows.map(row => row.conname)

    for (const table of Object.values(payload.db.tables)) {
      const metadata = getTableConfig(table)
      for (const column of metadata.columns) {
        const actual = columns.find(row => row.table_name === metadata.name && row.column_name === column.name)
        assert.ok(actual, `missing column ${metadata.name}.${column.name}`)
        assert.equal(actual.is_nullable, column.notNull ? 'NO' : 'YES', `nullability mismatch on ${metadata.name}.${column.name}`)
        const expectedType = column.getSQLType()
        const expectedDataType = expectedType.startsWith('varchar')
          ? 'character varying'
          : expectedType.startsWith('timestamp')
            ? 'timestamp with time zone'
            : expectedType === 'serial'
              ? 'integer'
              : expectedType.startsWith('enum_')
                ? 'USER-DEFINED'
                : expectedType
        assert.equal(actual.data_type, expectedDataType, `type mismatch on ${metadata.name}.${column.name}`)
      }
      for (const index of metadata.indexes) {
        assert.ok(indexes.includes(index.config.name!), `missing index ${index.config.name}`)
      }
      for (const foreignKey of metadata.foreignKeys) {
        assert.ok(constraints.includes(foreignKey.getName()), `missing foreign key ${foreignKey.getName()}`)
      }
    }
    console.log('schema metadata verification: PASS')

    // 3. Connect Payload and test real Local API operations
    await payload.db.connect!()

    // Admin & Service API-key
    const service = await payload.create({
      collection: 'admins',
      data: {
        name: 'Service Agent',
        email: 'service@persianpart.ir',
        role: 'service',
        password: randomUUID(),
        enableAPIKey: true,
        apiKey: randomUUID(),
      },
    })
    assert.equal(service.role, 'service')

    // CustomerTypes & Users
    const tier = await payload.create({
      collection: 'customer-types',
      data: { name: 'عمده‌فروش', slug: 'wholesaler', markupPercent: -10 },
    })
    const user = await payload.create({
      collection: 'users',
      data: { phone: '09120000001', fullName: 'آرش دهقان', customerType: tier.id, status: 'active' },
    })

    // Dimensions & Products
    const dimension = await payload.create({
      collection: 'dimensions',
      data: { name: '۶۰×۱۲۰', width: 60, height: 120, slug: '60x120' },
    })
    const product = await payload.create({
      collection: 'products',
      data: {
        sku: 'PP-TEST-001',
        name: 'کاشی پرسلان کلکته',
        slug: 'pp-test-001',
        dimension: dimension.id,
        sqmPerCarton: 1.44,
        basePricePerSqm: 500000,
        stockCartons: 100,
        inventorySqm: 144,
      },
    })

    // Orders with authoritative calculation and timeline
    const order = await payload.create({
      collection: 'orders',
      user: { ...service, collection: 'admins' },
      data: {
        orderNumber: 'ptp-100001',
        user: user.id,
        status: 'pending',
        items: [{ product: product.id, requestedArea: 10 }] as any,
        subtotal: 0,
        finalTotal: 0,
      },
    })
    assert.equal(order.status, 'pending')
    assert.equal(order.items.length, 1)
    assert.ok(order.finalTotal > 0)

    // Approve transition
    const approved = await payload.update({
      collection: 'orders',
      id: order.id,
      user: { ...service, collection: 'admins' },
      data: { status: 'approve' },
    })
    assert.equal(approved.status, 'approve')

    // Plans
    const plan = await payload.create({
      collection: 'plans',
      data: {
        title: 'طرح ویژه همکاران',
        content: 'تخفیف ویژه سفارشات بالای ۱۰۰ متر',
        users: [user.id],
      },
    })
    assert.equal(plan.title, 'طرح ویژه همکاران')
    console.log('Local API CRUD and lifecycle tests: PASS')

    // 4. Test down migration (clean rollback)
    await applyDown()
    const tablesAfterDown = (await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    )).rows
    assert.equal(tablesAfterDown.length, 0, 'all tables must be dropped cleanly by down migration')
    console.log('clean down migration rollback: PASS')
  } finally {
    await pool.end()
    if (payload.db.pool) payload.db.pool.on('error', () => {})
    await control.query(`DROP DATABASE "${name}" WITH (FORCE)`)
    await payload.destroy?.()
    await control.end()
  }
})
