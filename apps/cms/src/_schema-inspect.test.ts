import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { getPayload, createLocalReq } from 'payload'
import { stockImportEndpoints, parseStockCsv } from './collections/warehouse-stock/_import.endpoints'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { getTableConfig } from '@payloadcms/db-postgres/drizzle/pg-core'
import type { MigrateUpArgs, MigrateDownArgs, PostgresAdapter } from '@payloadcms/db-postgres'
import { migrations } from './migrations/index'

const require = createRequire(import.meta.url)
const pg = require(require.resolve('pg', { paths: [require.resolve('@payloadcms/db-postgres')] })) as PostgresAdapter['pg']

test('full migrations: schema coverage, CRUD, and warehouse rollback', { skip: !process.env.CMS_MIGRATION_TEST_DATABASE_URI }, async () => {
  const target = new URL(process.env.CMS_MIGRATION_TEST_DATABASE_URI!)
  assert.ok(target.protocol === 'postgres:' || target.protocol === 'postgresql:')
  assert.ok(target.hostname === '127.0.0.1' || target.hostname === 'localhost' || target.hostname === '[::1]')
  assert.ok(Number(target.port) > 0)
  assert.equal(target.pathname, '/postgres')

  const name = `cms_migration_test_${randomUUID().replaceAll('-', '')}`
  assert.match(name, /^cms_migration_test_[a-f0-9]+$/)

  const control = new pg.Pool({ connectionString: target.href })
  target.pathname = `/${name}`
  const pool = new pg.Pool({ connectionString: target.href })
  const db = drizzle(pool)

  process.env.DISABLE_SMS = 'true'
  process.env.DATABASE_URI = target.href
  process.env.DATABASE_URL = process.env.DATABASE_URI
  const { default: config } = await import('./payload.config')
  const payload = await getPayload({ config, disableDBConnect: true })

  const applyUp = async () => db.transaction(async transaction => {
    for (const migration of migrations) await migration.up({ db: transaction, payload } as unknown as MigrateUpArgs)
  })

  const applyDown = async () => db.transaction(async transaction => {
    const warehouseNames = new Set([
      '20261107_080025_warehouse_foundation',
      '20261107_080843_warehouse_orders',
      '20261107_082608_order_request_fingerprint',
      '20261107_090722_warehouse_sales_units',
    ])
    for (const migration of [...migrations].filter(migration => warehouseNames.has(migration.name)).reverse()) {
      await migration.down({ db: transaction, payload } as unknown as MigrateDownArgs)
    }
  })

  try {
    await control.query(`CREATE DATABASE "${name}"`)
    assert.ok(migrations.length >= 4)

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

    const schemaDifferences: string[] = []
    for (const table of Object.values(payload.db.tables)) {
      const metadata = getTableConfig(table)
      for (const column of metadata.columns) {
        const actual = columns.find(row => row.table_name === metadata.name && row.column_name === column.name)
        assert.ok(actual, `missing column ${metadata.name}.${column.name}`)
        if (actual.is_nullable !== (column.notNull ? 'NO' : 'YES')) schemaDifferences.push(`nullability ${metadata.name}.${column.name}: ${actual.is_nullable}, expected ${column.notNull ? 'NO' : 'YES'}`)
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
    assert.deepEqual(schemaDifferences, [])
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

    const warehouse = await payload.create({ collection: 'warehouses', data: { code: 'TEST', name: 'انبار تست', isActive: true } })
    await payload.create({ collection: 'warehouse-stock', data: { warehouse: warehouse.id, product: product.id, inventorySqm: 144, revision: 0 } })
    // Orders with authoritative calculation and timeline
    const order = await payload.create({
      collection: 'orders',
      user: { ...service, collection: 'admins' },
      data: {
        orderNumber: 'ptp-100001',
        warehouse: warehouse.id,
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
    const manager = await payload.create({ collection: 'admins', data: { name: 'Manager', email: 'manager@fixture.test', role: 'manager', password: randomUUID() } })
    const importRequest = async (path: string, body: unknown, role: 'manager' | 'service' = 'manager') => {
      const req = await createLocalReq({ user: { ...manager, role, collection: 'admins' } }, payload)
      Object.assign(req, { json: async () => body })
      return stockImportEndpoints.find(endpoint => endpoint.path === path)!.handler(req)
    }
    assert.throws(() => parseStockCsv('sku,inventorySqm\nA,1\nA,2'))
    assert.throws(() => parseStockCsv('sku,inventorySqm\nA,-1'))
    assert.throws(() => parseStockCsv('sku,inventorySqm\nA,1.001'))
    assert.equal((await importRequest('/preview', { warehouseId: warehouse.id, csv: 'sku,inventorySqm\nPP-TEST-001,100' }, 'service')).status, 403)
    const preview = await importRequest('/preview', { warehouseId: warehouse.id, csv: 'sku,inventorySqm\nPP-TEST-001,100' })
    assert.equal(preview.status, 200)
    const previewData = await preview.json()
    const beforeImport = await payload.find({ collection: 'warehouse-stock', depth: 0 })
    assert.equal(beforeImport.docs[0]!.inventorySqm, 133.92)
    assert.equal((await importRequest('/apply', { token: previewData.token })).status, 200)
    assert.equal((await importRequest('/apply', { token: previewData.token })).status, 409)
    const imported = await payload.find({ collection: 'warehouse-stock', depth: 0 })
    assert.equal(imported.docs[0]!.inventorySqm, 100)
    assert.equal((await importRequest('/apply', { token: previewData.token + 'tampered' })).status, 409)
    console.log('CSV preview, authorization, apply, replay and tamper checks: PASS')
    const other = await payload.create({ collection: 'products', data: { sku: 'PP-BAG', slug: 'pp-bag', name: 'چسب', productType: 'other', unit: 'bag', sqmPerCarton: 1.44, basePricePerSqm: 100 } })
    const otherBalance = await payload.create({ collection: 'warehouse-stock', data: { warehouse: warehouse.id, product: other.id, inventorySqm: 10, revision: 0 } })
    const mixed = await payload.create({ collection: 'orders', data: {
      orderNumber: 'ptp-mixed', user: user.id, warehouse: warehouse.id, status: 'pending', subtotal: 0, finalTotal: 0,
      items: [{ product: product.id, requestedArea: 1, cartonCount: 0, deliverableArea: 0, unitPrice: 0, totalPrice: 0 }, { product: other.id, requestedArea: 2.2, cartonCount: 0, deliverableArea: 0, unitPrice: 0, totalPrice: 0 }],
    } })
    const bagLine = mixed.items.find(item => item.unit === 'bag')!
    assert.equal(bagLine.productType, 'other')
    assert.equal(bagLine.salesFactor, 1)
    assert.equal(bagLine.deliverableArea, 3)
    assert.equal(bagLine.totalPrice, 270)
    assert.equal((await payload.findByID({ collection: 'warehouse-stock', id: otherBalance.id })).inventorySqm, 7)
    await assert.rejects(payload.update({ collection: 'products', id: other.id, data: { unit: 'kg' } }), /واحد فروش/)
    await payload.update({ collection: 'orders', id: mixed.id, data: { status: 'cancelled_by_customer' } })
    assert.equal((await payload.findByID({ collection: 'warehouse-stock', id: otherBalance.id })).inventorySqm, 10)
    const tileAfterCancel = await payload.find({ collection: 'warehouse-stock', where: { product: { equals: product.id } }, depth: 0 })
    assert.equal(tileAfterCancel.docs[0]!.inventorySqm, 100)
    const multiPreview = await importRequest('/preview', { warehouseId: warehouse.id, csv: 'sku,inventorySqm\nPP-TEST-001,88\nPP-BAG,9' })
    assert.equal(multiPreview.status, 200)
    const multiToken = (await multiPreview.json()).token
    await pool.query('UPDATE warehouse_stock SET revision = revision + 1 WHERE id = $1', [otherBalance.id])
    assert.equal((await importRequest('/apply', { token: multiToken })).status, 409)
    const tileAfterFailedImport = await payload.find({ collection: 'warehouse-stock', where: { product: { equals: product.id } }, depth: 0 })
    assert.equal(tileAfterFailedImport.docs[0]!.inventorySqm, 100, 'stale second row rolls back first row')
    const staleProductPreview = await importRequest('/preview', { warehouseId: warehouse.id, csv: 'sku,inventorySqm\nPP-BAG,9' })
    await payload.update({ collection: 'products', id: other.id, data: { name: 'چسب جدید' } })
    assert.equal((await importRequest('/apply', { token: (await staleProductPreview.json()).token })).status, 409)
    const audit = await payload.find({ collection: 'audit-logs', where: { target: { equals: `موجودی انبار #${warehouse.id}` } } })
    assert.equal(audit.totalDocs, 1, 'only successful CSV applications are audited')
    console.log('CSV multi-row rollback, product-version invalidation and audit persistence: PASS')
    console.log('mixed units: authoritative pricing, reserve/cancel and unit immutability: PASS')
    console.log('Local API CRUD and lifecycle tests: PASS')

    // 4. Test down migration (clean rollback)
    await applyDown()
    const tablesAfterDown = (await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    )).rows
    assert.ok(!tablesAfterDown.some(row => ['warehouses', 'warehouse_stock'].includes(row.table_name)), 'warehouse tables must be dropped cleanly')
    console.log('clean down migration rollback: PASS')
  } finally {
    await pool.end()
    if (payload.db.pool) payload.db.pool.on('error', () => {})
    await control.query(`DROP DATABASE "${name}" WITH (FORCE)`)
    await payload.destroy?.()
    await control.end()
  }
})
