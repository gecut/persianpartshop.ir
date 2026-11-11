import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHmac, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { getPayload, createLocalReq, initTransaction, commitTransaction, killTransaction } from 'payload'
import { stockImportEndpoints, parseStockCsv } from './collections/warehouse-stock/_import.endpoints'
import { activityFeedEndpoint } from './endpoints/activity-feed.endpoint'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import { getTableConfig } from '@payloadcms/db-postgres/drizzle/pg-core'
import { sql, type MigrateUpArgs, type MigrateDownArgs, type PostgresAdapter } from '@payloadcms/db-postgres'
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

  const applyDown = async () => db.transaction(async transaction => {
    for (const migration of [...migrations].reverse()) {
      await migration.down({ db: transaction, payload } as unknown as MigrateDownArgs)
    }
  })

  try {
    await control.query(`CREATE DATABASE "${name}"`)
    assert.equal(migrations.length, 7)

    // Exercise the production upgrade path with existing baseline data.
    await db.transaction(transaction => migrations[0]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    const legacyProduct = await pool.query<{ id: number }>("INSERT INTO products (name, sku, slug) VALUES ('Legacy', 'MIGRATION-FIXTURE', 'migration-fixture') RETURNING id")
    const warehouses = await pool.query<{ id: number }>("INSERT INTO warehouses (code, name, stock_mode) VALUES ('MIG-EXACT', 'Exact', 'exact'), ('MIG-INQUIRY', 'Inquiry', 'inquiry') RETURNING id")
    const productId = legacyProduct.rows[0]!.id
    const exactId = warehouses.rows[0]!.id
    const inquiryId = warehouses.rows[1]!.id
    await pool.query('INSERT INTO warehouse_stock (warehouse_id, product_id, inventory_sqm, revision) VALUES ($1, $2, 42.5, 7)', [exactId, productId])
    await pool.query("INSERT INTO supply_sources (warehouse_id, product_id, is_active, last_reported_at) VALUES ($1, $2, false, '2026-01-01T00:00:00Z')", [inquiryId, productId])
    await db.transaction(transaction => migrations[1]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await db.transaction(transaction => migrations[2]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await pool.query('UPDATE products SET sqm_per_carton = 0 WHERE id=$1', [productId])
    await assert.rejects(db.transaction(transaction => migrations[3]!.up({ db: transaction, payload } as unknown as MigrateUpArgs)))
    assert.equal((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='orders_items' AND column_name='product_name'")).rowCount, 0)
    await pool.query('UPDATE products SET sqm_per_carton = 1.44 WHERE id=$1', [productId])
    await db.transaction(transaction => migrations[3]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await db.transaction(transaction => migrations[3]!.down({ db: transaction, payload } as unknown as MigrateDownArgs))
    await db.transaction(transaction => migrations[3]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await db.transaction(transaction => migrations[4]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await db.transaction(transaction => migrations[4]!.down({ db: transaction, payload } as unknown as MigrateDownArgs))
    await db.transaction(transaction => migrations[4]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await db.transaction(transaction => migrations[5]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await db.transaction(transaction => migrations[5]!.down({ db: transaction, payload } as unknown as MigrateDownArgs))
    await db.transaction(transaction => migrations[5]!.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    const legacyTier = await pool.query<{ id: number }>("INSERT INTO customer_types (name, slug) VALUES ('Legacy tier', 'legacy-watermark') RETURNING id")
    const legacyCustomer = await pool.query<{ id: number }>(
      "INSERT INTO users (full_name, phone, customer_type_id) VALUES ('Legacy customer', '09120000090', $1) RETURNING id",
      [legacyTier.rows[0]!.id],
    )
    const watermarkMigration = migrations[6]!
    await db.transaction(transaction => watermarkMigration.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    await db.transaction(transaction => watermarkMigration.down({ db: transaction, payload } as unknown as MigrateDownArgs))
    await db.transaction(transaction => watermarkMigration.up({ db: transaction, payload } as unknown as MigrateUpArgs))
    assert.equal((await pool.query(
      'SELECT show_product_image_watermark FROM users WHERE id = $1', [legacyCustomer.rows[0]!.id],
    )).rows[0]?.show_product_image_watermark, false)
    assert.equal((await pool.query(
      "INSERT INTO users (full_name, phone, customer_type_id) VALUES ('New customer', '09120000091', $1) RETURNING show_product_image_watermark",
      [legacyTier.rows[0]!.id],
    )).rows[0]?.show_product_image_watermark, false)
    await pool.query('DELETE FROM users WHERE customer_type_id = $1', [legacyTier.rows[0]!.id])
    await pool.query('DELETE FROM customer_types WHERE id = $1', [legacyTier.rows[0]!.id])
    const upgraded = await pool.query('SELECT warehouse_id, inventory_sqm, revision, is_active, last_reported_at FROM warehouse_stock WHERE product_id=$1 ORDER BY warehouse_id', [productId])
    assert.equal(upgraded.rows.length, 2)
    assert.equal(Number(upgraded.rows[0].inventory_sqm), 42.5)
    assert.equal(Number(upgraded.rows[0].revision), 7)
    assert.equal(upgraded.rows[1].inventory_sqm, null)
    assert.equal(upgraded.rows[1].is_active, false)
    assert.equal(new Date(upgraded.rows[1].last_reported_at).toISOString(), '2026-01-01T00:00:00.000Z')
    assert.equal(Number((await pool.query('SELECT count(*) FROM supply_sources_legacy')).rows[0].count), 1)
    await pool.query('DELETE FROM _migration_supply_sources_mapping')
    await pool.query('DELETE FROM supply_sources_legacy WHERE product_id=$1', [productId])
    await pool.query('DELETE FROM warehouse_stock WHERE product_id=$1', [productId])
    await pool.query('DELETE FROM warehouses WHERE id=ANY($1::int[])', [[exactId, inquiryId]])
    await pool.query('DELETE FROM products WHERE id=$1', [productId])
    const checks = await pool.query<{ conname: string }>(`SELECT conname FROM pg_constraint WHERE contype = 'c'`)
    for (const name of ['warehouse_stock_amount_check', 'warehouse_stock_revision_check', 'products_cartons_per_pallet_valid', 'orders_items_cartons_per_pallet_valid', 'supply_requests_quantities_valid', 'supply_requests_prices_valid', 'supply_requests_cartons_per_pallet_valid']) assert.ok(checks.rows.some(row => row.conname === name), `missing check ${name}`)
    console.log('fresh migrations and database constraints: PASS')

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

    // A fresh installation has no customer tier when the first admin is created.
    assert.equal((await payload.find({ collection: 'customer-types' })).totalDocs, 0)
    // Payload's generated input requires role; omit it deliberately to exercise the runtime default.
    // @ts-expect-error Testing creation without an explicit role.
    const firstAdmin = await payload.create({
      collection: 'admins',
      data: { name: 'Bootstrap Admin', email: 'bootstrap@example.test', phone: '۰۹۱۲۹۹۹۹۹۹۹', password: randomUUID() },
    })
    assert.equal(firstAdmin.role, 'superadmin')
    const linked = await payload.find({ collection: 'users', where: { phone: { equals: '09129999999' } }, depth: 0 })
    assert.equal(linked.totalDocs, 1)
    assert.equal(linked.docs[0]!.status, 'active')
    assert.equal(linked.docs[0]!.showProductImageWatermark, false)
    const bootstrapTier = await payload.findByID({ collection: 'customer-types', id: linked.docs[0]!.customerType as number })
    assert.equal(bootstrapTier.slug, 'regular')
    await payload.update({ collection: 'admins', id: firstAdmin.id, data: { name: 'Updated Bootstrap Admin' } })
    const updatedLinked = await payload.find({ collection: 'users', where: { phone: { equals: '09129999999' } } })
    assert.equal(updatedLinked.totalDocs, 1)
    assert.equal(updatedLinked.docs[0]!.fullName, 'Updated Bootstrap Admin')
    console.log('fresh admin default and transactional customer synchronization: PASS')

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
      data: { phone: '09120000001', fullName: 'آرش دهقان', customerType: tier.id, status: 'active', showProductImageWatermark: false },
    })
    assert.equal(user.canUseProductQr, false)
    assert.equal(user.showProductImageWatermark, false)

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
        scanCode: '  pp-001  ',
      },
    })
    assert.equal(product.scanCode, 'PP-001')
    const publicProduct = await payload.findByID({ collection: 'products', id: product.id, overrideAccess: false })
    assert.equal(publicProduct.scanCode, undefined)
    const serviceProduct = await payload.findByID({ collection: 'products', id: product.id, overrideAccess: false, user: { ...service, collection: 'admins' } })
    assert.equal(serviceProduct.scanCode, 'PP-001')
    await assert.rejects(payload.create({ collection: 'products', data: { sku: 'PP-DUP', slug: 'pp-dup', name: 'Duplicate', scanCode: 'pp-001', sqmPerCarton: 1, basePricePerSqm: 10 } }))
    await assert.rejects(payload.update({ collection: 'products', id: product.id, data: { scanCode: 'A'.repeat(129) } }))
    const maxCode = await payload.update({ collection: 'products', id: product.id, data: { scanCode: 'A'.repeat(128) } })
    assert.equal(maxCode.scanCode, 'A'.repeat(128))
    await payload.update({ collection: 'products', id: product.id, data: { scanCode: 'PP-001' } })
    const noCodeOne = await payload.create({ collection: 'products', data: { sku: 'PP-NO-CODE-1', slug: 'pp-no-code-1', name: 'No QR 1', sqmPerCarton: 1, basePricePerSqm: 10 } })
    const noCodeTwo = await payload.create({ collection: 'products', data: { sku: 'PP-NO-CODE-2', slug: 'pp-no-code-2', name: 'No QR 2', scanCode: '  ', sqmPerCarton: 1, basePricePerSqm: 10 } })
    assert.equal(noCodeOne.scanCode ?? null, null)
    assert.equal(noCodeTwo.scanCode, null)

    const warehouse = await payload.create({ collection: 'warehouses', data: { code: 'TEST', name: 'انبار تست', isActive: true, stockMode: 'exact' } })
    await payload.create({ collection: 'warehouse-stock', data: { isActive: true, warehouse: warehouse.id, product: product.id, inventorySqm: 144, revision: 0 } })
    const inquiry = await payload.create({ collection: 'warehouses', data: { code: 'INQUIRY', name: 'انبار استعلامی', isActive: true, stockMode: 'inquiry' } })
    const supplyManager = await payload.create({ collection: 'admins', data: { name: 'Manager', email: 'manager@supply.test', role: 'manager', password: randomUUID() } })
    const support = await payload.create({ collection: 'admins', data: { name: 'Support', email: 'support@supply.test', role: 'support', password: randomUUID() } })
    const managerActor = { ...supplyManager, collection: 'admins' as const }
    const serviceActor = { ...service, collection: 'admins' as const }
    const supportActor = { ...support, collection: 'admins' as const }
    await payload.update({ collection: 'admins', id: support.id, data: { name: 'Changed support', phone: user.phone }, user: supportActor, overrideAccess: false })
    assert.equal((await payload.findByID({ collection: 'users', id: user.id, depth: 0 })).fullName, user.fullName)
    await assert.rejects(payload.update({ collection: 'users', id: user.id, data: { fullName: 'unauthorized' }, user: supportActor, overrideAccess: false }))
    for (const enabled of [true, false]) {
      const updated = await payload.update({
        collection: 'users', id: user.id, data: { showProductImageWatermark: enabled }, user: managerActor, overrideAccess: false,
      })
      assert.equal(updated.showProductImageWatermark, enabled)
      const logs = await payload.find({
        collection: 'audit-logs',
        where: {
          target: { equals: `${user.fullName} (${user.phone})` },
          details: { contains: `نمایش واترمارک تصاویر محصول: ${enabled ? 'فعال' : 'غیرفعال'}` },
        },
      })
      assert.equal(logs.totalDocs, 1)
    }
    await assert.rejects(payload.update({
      collection: 'users', id: user.id, data: { showProductImageWatermark: true }, user: supportActor, overrideAccess: false,
    }))
    console.log('product image watermark migration, permissions and audit log: PASS')
    await payload.create({ collection: 'warehouse-stock', data: { isActive: true, revision: 0, product: product.id, warehouse: inquiry.id, lastReportedAt: new Date().toISOString() }, user: managerActor, overrideAccess: false })
    await assert.rejects(payload.create({ collection: 'warehouse-stock', data: { isActive: true, revision: 0, product: product.id, warehouse: inquiry.id, lastReportedAt: new Date().toISOString() }, user: managerActor, overrideAccess: false }))
    await assert.rejects(payload.create({ collection: 'warehouse-stock', data: { isActive: true, revision: 0, product: product.id, warehouse: inquiry.id, lastReportedAt: new Date().toISOString() }, user: supportActor, overrideAccess: false }))
    await assert.rejects(payload.create({ collection: 'warehouse-stock', data: { isActive: true, warehouse: inquiry.id, product: product.id, inventorySqm: 10, revision: 0 } }))
    await assert.rejects(payload.update({ collection: 'warehouses', id: inquiry.id, data: { stockMode: 'exact' } }))
    const createSupply = (requestedQuantity: number) => payload.create({ collection: 'supply-requests', data: { user: user.id, product: product.id, warehouse: inquiry.id, requestedQuantity, idempotencyKey: randomUUID() } as never, user: serviceActor, overrideAccess: false })
    await assert.rejects(createSupply(80), error => error instanceof Error && 'data' in error && (error.data as { code?: string }).code === 'EXACT_STOCK_AVAILABLE')
    await assert.rejects(payload.create({ collection: 'supply-requests', data: { user: user.id, product: product.id, warehouse: inquiry.id, requestedQuantity: 200, idempotencyKey: randomUUID(), status: 'supplied' } as never, user: serviceActor, overrideAccess: false }))
    await assert.rejects(payload.create({ collection: 'supply-requests', data: { user: user.id, product: product.id, warehouse: inquiry.id, requestedQuantity: 200, idempotencyKey: randomUUID(), estimatedTotal: 1 } as never, user: serviceActor, overrideAccess: false }))
    const media = await pool.query<{ id: number }>(`INSERT INTO media (alt, filename, mime_type) VALUES ('snapshot', 'snapshot.webp', 'image/webp') RETURNING id`)
    const snapshotUrl = (await payload.findByID({ collection: 'media', id: media.rows[0]!.id, depth: 0 })).url
    assert.ok(snapshotUrl)
    await payload.update({ collection: 'products', id: product.id, data: { cover: media.rows[0]!.id } })
    const supply = await createSupply(200)
    assert.equal(supply.status, 'new')
    assert.ok(Number.isSafeInteger(supply.trackingNumber) && supply.trackingNumber > 0)
    assert.equal(supply.requestNumber, String(supply.trackingNumber))
    await assert.rejects(payload.update({ collection: 'supply-requests', id: supply.id, data: { trackingNumber: supply.trackingNumber + 1 }, user: managerActor, overrideAccess: false }))
    assert.equal(supply.packageCount, 139)
    assert.equal(supply.roundedQuantity, 200.16)
    assert.equal(new Date(supply.responseDueAt).getTime() - new Date(supply.createdAt).getTime(), 48 * 60 * 60 * 1000)
    assert.equal(supply.productImage, snapshotUrl)
    await payload.update({ collection: 'products', id: product.id, data: { cover: null } })
    assert.equal((await payload.findByID({ collection: 'supply-requests', id: supply.id, depth: 0 })).productImage, snapshotUrl)
    await assert.rejects(payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'reviewing' }, user: { ...managerActor, role: 'editor' } as never, overrideAccess: false }))
    const reviewing = await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'reviewing' }, user: supportActor, overrideAccess: false })
    assert.ok(reviewing.reviewStartedAt)
    await assert.rejects(payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'cancelled_by_customer' }, user: serviceActor, overrideAccess: false }), error => error instanceof Error && 'data' in error && (error.data as { code?: string }).code === 'CANNOT_CANCEL')
    await assert.rejects(payload.update({ collection: 'supply-requests', id: supply.id, data: { notes: 'altered' }, user: managerActor, overrideAccess: false }))
    const originalFetch = globalThis.fetch
    const oldSmsKey = process.env.KAVENEGAR_API_KEY
    const oldWebUrl = process.env.WEB_URL
    let smsCalls = 0
    try {
      process.env.KAVENEGAR_API_KEY = 'fixture-only'
      process.env.WEB_URL = 'http://fixture.invalid'
      delete process.env.DISABLE_SMS
      globalThis.fetch = async () => { smsCalls++; return new Response('', { status: 503 }) }
      const supplied = await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'supplied' }, user: managerActor, overrideAccess: false })
      assert.equal(supplied.status, 'supplied', 'provider failure must not roll back status')
      await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'supplied' }, user: managerActor, overrideAccess: false })
      assert.equal(smsCalls, 1, 'unchanged status must not notify')
      await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'unavailable' }, user: managerActor, overrideAccess: false })
      assert.equal(smsCalls, 2, 'changing the final result attempts a notification')
      await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'new' }, user: managerActor, overrideAccess: false })
      assert.equal(smsCalls, 2, 'returning to an open status must not notify')
      await assert.rejects(payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'cancelled_by_customer' }, user: serviceActor, overrideAccess: false }), error => error instanceof Error && 'data' in error && (error.data as { code?: string }).code === 'CANNOT_CANCEL')
      const nestedReq = await createLocalReq({ user: managerActor }, payload)
      await initTransaction(nestedReq)
      await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'supplied' }, req: nestedReq, overrideAccess: false })
      assert.equal(smsCalls, 2, 'nested write must wait for the owner commit')
      await killTransaction(nestedReq)
      assert.equal(smsCalls, 2, 'rollback must discard SMS')
      assert.equal((await payload.findByID({ collection: 'supply-requests', id: supply.id })).status, 'new')
      await pool.query('CREATE TABLE _sms_commit_fixture (user_id integer REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED)')
      const failedCommitReq = await createLocalReq({ user: managerActor }, payload)
      try {
        await initTransaction(failedCommitReq)
        await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'supplied' }, req: failedCommitReq, overrideAccess: false })
        const { getOrderTransaction } = await import('./collections/orders/_transaction')
        await (await getOrderTransaction(failedCommitReq)).execute(sql`INSERT INTO _sms_commit_fixture VALUES (-999)`)
        await assert.rejects(commitTransaction(failedCommitReq))
        assert.equal(smsCalls, 2, 'a real deferred-constraint COMMIT failure must not send SMS')
        assert.equal((await payload.findByID({ collection: 'supply-requests', id: supply.id })).status, 'new')
      } finally {
        await killTransaction(failedCommitReq)
        await pool.query('DROP TABLE _sms_commit_fixture')
      }
      const committedReq = await createLocalReq({ user: managerActor }, payload)
      await initTransaction(committedReq)
      await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'supplied' }, req: committedReq, overrideAccess: false })
      assert.equal(smsCalls, 2)
      await commitTransaction(committedReq)
      assert.equal(smsCalls, 3)
      await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'new' }, user: managerActor, overrideAccess: false })
      globalThis.fetch = async () => new Promise<Response>(() => {})
      const startedAt = Date.now()
      const afterTimeout = await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'supplied' }, user: managerActor, overrideAccess: false })
      assert.equal(afterTimeout.status, 'supplied', 'an unresponsive provider must not prevent commit')
      assert.ok(Date.now() - startedAt < 8_000, 'provider wait must be bounded')
      const unlocked = await payload.update({ collection: 'supply-requests', id: supply.id, data: { status: 'reviewing' }, user: managerActor, overrideAccess: false })
      assert.equal(unlocked.status, 'reviewing', 'the request lock must be released after timeout')
    } finally {
      globalThis.fetch = originalFetch
      process.env.DISABLE_SMS = 'true'
      if (oldSmsKey === undefined) delete process.env.KAVENEGAR_API_KEY; else process.env.KAVENEGAR_API_KEY = oldSmsKey
      if (oldWebUrl === undefined) delete process.env.WEB_URL; else process.env.WEB_URL = oldWebUrl
    }
    const race = await createSupply(201)
    const raceResults = await Promise.allSettled([
      payload.update({ collection: 'supply-requests', id: race.id, data: { status: 'reviewing' }, user: managerActor, overrideAccess: false }),
      payload.update({ collection: 'supply-requests', id: race.id, data: { status: 'cancelled_by_customer' }, user: serviceActor, overrideAccess: false }),
    ])
    assert.equal(raceResults.filter(result => result.status === 'fulfilled').length, 1)
    const raceDoc = await payload.findByID({ collection: 'supply-requests', id: race.id, depth: 0 })
    assert.ok((raceDoc.status === 'reviewing' && raceDoc.reviewStartedAt) || (raceDoc.status === 'cancelled_by_customer' && !raceDoc.reviewStartedAt))
    const duplicateKey = randomUUID()
    const duplicateInput = { user: user.id, product: product.id, warehouse: inquiry.id, requestedQuantity: 202, idempotencyKey: duplicateKey } as never
    const duplicateResults = await Promise.allSettled([
      payload.create({ collection: 'supply-requests', data: duplicateInput, user: serviceActor, overrideAccess: false }),
      payload.create({ collection: 'supply-requests', data: duplicateInput, user: serviceActor, overrideAccess: false }),
    ])
    assert.equal(duplicateResults.filter(result => result.status === 'fulfilled').length, 1)
    const splitProduct = await payload.create({ collection: 'products', data: { sku: 'PP-SPLIT', slug: 'pp-split', name: 'Split stock', sqmPerCarton: 1, basePricePerSqm: 100 } })
    const secondExact = await payload.create({ collection: 'warehouses', data: { code: 'EXACT-TWO', name: 'انبار قطعی دوم', isActive: true, stockMode: 'exact' } })
    for (const warehouseId of [warehouse.id, secondExact.id]) await payload.create({ collection: 'warehouse-stock', data: { isActive: true, warehouse: warehouseId, product: splitProduct.id, inventorySqm: 60, revision: 0 } })
    await payload.create({ collection: 'warehouse-stock', data: { isActive: true, revision: 0, product: splitProduct.id, warehouse: inquiry.id, lastReportedAt: new Date().toISOString() }, user: managerActor, overrideAccess: false })
    const splitRequest = await payload.create({ collection: 'supply-requests', data: { user: user.id, product: splitProduct.id, requestedQuantity: 100, idempotencyKey: randomUUID() } as never, user: serviceActor, overrideAccess: false })
    assert.equal(splitRequest.roundedQuantity, 100, 'two insufficient warehouses must not be pooled')
    assert.equal(splitRequest.fingerprintVersion, 2)
    assert.equal(splitRequest.warehouse, null)
    console.log('supply source, request, status and access checks: PASS')
    await assert.rejects(pool.query('UPDATE warehouse_stock SET inventory_sqm = -1 WHERE warehouse_id = $1 AND product_id = $2', [warehouse.id, product.id]))
    await assert.rejects(pool.query('UPDATE warehouse_stock SET inventory_sqm = 1.001 WHERE warehouse_id = $1 AND product_id = $2', [warehouse.id, product.id]))
    await assert.rejects(pool.query('UPDATE warehouse_stock SET revision = 0.5 WHERE warehouse_id = $1 AND product_id = $2', [warehouse.id, product.id]))
    const warehouseConstraints = await pool.query<{ conname: string; confdeltype: string }>(`SELECT conname, confdeltype FROM pg_constraint WHERE conname IN ('warehouse_stock_warehouse_id_warehouses_id_fk', 'warehouse_stock_product_id_products_id_fk', 'orders_warehouse_id_warehouses_id_fk')`)
    assert.equal(warehouseConstraints.rowCount, 3)
    assert.ok(warehouseConstraints.rows.every(constraint => constraint.confdeltype === 'r'))

    await assert.rejects(payload.update({ collection: 'products', id: product.id, data: { sqmPerCarton: 2 } }), error => error instanceof Error && 'data' in error && (error.data as { code?: string }).code === 'PACKAGING_HAS_OPEN_ACTIVITY')
    // Orders with authoritative calculation and timeline
    await payload.update({ collection: 'products', id: product.id, data: { cartonsPerPallet: 48 }, user: managerActor, overrideAccess: false })
    const order = await payload.create({
      collection: 'orders',
      user: { ...service, collection: 'admins' },
      data: {
        trackingNumber: 0, orderNumber: 'ptp-100001',
        warehouse: warehouse.id,
        user: user.id,
        status: 'pending',
        items: [{ product: product.id, requestedArea: 10 }] as any,
        subtotal: 0,
        finalTotal: 0,
      },
    })
    assert.equal(order.status, 'pending')
    assert.ok(order.trackingNumber > supply.trackingNumber)
    assert.equal(order.orderNumber, String(order.trackingNumber))
    await assert.rejects(payload.update({ collection: 'orders', id: order.id, data: { trackingNumber: order.trackingNumber + 1 } }))
    assert.equal(order.items.length, 1)
    assert.ok(order.finalTotal > 0)
    assert.equal(order.items[0]!.cartonsPerPallet, 48)
    assert.equal(order.items[0]!.productName, product.name)
    assert.equal(order.items[0]!.productSku, product.sku)
    const form = await payload.findByID({ collection: 'orders', id: order.id, depth: 2 })
    const formItems = form.items.map(item => Object.fromEntries(Object.entries(item).reverse()))
    const echoedTimeline = form.timeline?.map(({ id: _id, ...event }) => ({ ...event, timestamp: event.timestamp?.replace('Z', '+00:00') }))
    const formSaved = await payload.update({ collection: 'orders', id: order.id, user: supportActor, overrideAccess: false, data: { ...form, items: formItems, timeline: echoedTimeline, notes: 'full form note', deliveryAddress: 'address' } as never })
    assert.deepEqual(formSaved.timeline, form.timeline, 'form row IDs and date formatting must not replace persisted history')
    await assert.rejects(payload.update({ collection: 'orders', id: order.id, user: managerActor, overrideAccess: false, data: { user: null } as never }))
    await assert.rejects(payload.update({ collection: 'orders', id: order.id, data: { timeline: [{ status: 'completed' }] } }))
    await assert.rejects(payload.update({ collection: 'products', id: product.id, data: { sqmPerCarton: 2 } }), error => error instanceof Error && 'data' in error && (error.data as { code?: string }).code === 'PACKAGING_HAS_OPEN_ACTIVITY')
    await assert.rejects(payload.update({ collection: 'orders', where: { id: { equals: order.id } }, data: { notes: 'bulk' } }))
    await assert.rejects(payload.delete({ collection: 'users', id: user.id }), /به‌جای حذف/)
    await assert.rejects(payload.delete({ collection: 'dimensions', id: dimension.id }), /ابتدا/)
    await assert.rejects(pool.query('DELETE FROM dimensions WHERE id=$1', [dimension.id]))
    await payload.update({ collection: 'dimensions', id: dimension.id, data: { width: 61 } })
    assert.equal((await payload.findByID({ collection: 'products', id: product.id })).width, 61)
    await payload.update({ collection: 'products', id: noCodeOne.id, data: { dimension: dimension.id } })
    await payload.update({ collection: 'products', id: noCodeOne.id, data: { dimension: null } })
    assert.equal((await payload.findByID({ collection: 'products', id: noCodeOne.id })).width, null)
    const stockDoc = (await payload.find({ collection: 'warehouse-stock', where: { and: [{ warehouse: { equals: warehouse.id } }, { product: { equals: product.id } }] }, depth: 0 })).docs[0]!
    await payload.update({ collection: 'warehouse-stock', id: stockDoc.id, data: { isActive: false }, user: managerActor, overrideAccess: false })
    await assert.rejects(payload.update({ collection: 'warehouse-stock', id: stockDoc.id, data: { inventorySqm: 999 }, user: managerActor, overrideAccess: false }))
    await assert.rejects(payload.findByID({ collection: 'warehouse-stock', id: stockDoc.id, user: supportActor, overrideAccess: false }))
    await payload.findByID({ collection: 'warehouses', id: warehouse.id, user: supportActor, overrideAccess: false })
    await payload.findByID({ collection: 'customer-types', id: tier.id, user: supportActor, overrideAccess: false })
    await assert.rejects(payload.create({ collection: 'orders', data: { user: user.id, warehouse: warehouse.id, status: 'pending', trackingNumber: 0, orderNumber: '', subtotal: 0, finalTotal: 0, items: [{ product: product.id, requestedArea: 1 }] } as never }), error => error instanceof Error && 'data' in error && (error.data as { code?: string }).code === 'INSUFFICIENT_STOCK')
    await payload.update({ collection: 'warehouse-stock', id: stockDoc.id, data: { isActive: true }, user: managerActor, overrideAccess: false })
    const sourceDoc = (await payload.find({ collection: 'warehouse-stock', where: { and: [{ warehouse: { equals: inquiry.id } }, { product: { equals: product.id } }] }, depth: 0 })).docs[0]!
    await assert.rejects(payload.update({ collection: 'warehouse-stock', id: sourceDoc.id, data: { product: noCodeOne.id }, user: managerActor, overrideAccess: false }))
    const parent = await payload.create({ collection: 'categories', data: { name: 'Parent', slug: 'parent' } })
    const child = await payload.create({ collection: 'categories', data: { name: 'Child', slug: 'child', parent: parent.id } })
    await assert.rejects(payload.update({ collection: 'categories', id: parent.id, data: { parent: child.id } }))
    await payload.update({ collection: 'users', id: user.id, data: { hideExactStock: true, disableOrdering: false } })
    const flags = await payload.update({ collection: 'users', id: user.id, data: { disableOrdering: false } })
    assert.equal(flags.disableOrdering, true)
    await payload.update({ collection: 'users', id: user.id, data: { hideExactStock: false, disableOrdering: false } })
    const unrelated = await payload.create({ collection: 'admins', data: { name: 'Unrelated manager', email: 'unrelated@example.test', phone: user.phone, role: 'manager', password: randomUUID() } })
    assert.equal(unrelated.customer ?? null, null)
    assert.equal((await payload.findByID({ collection: 'users', id: user.id })).fullName, user.fullName)
    await payload.update({ collection: 'admins', id: firstAdmin.id, data: { isActive: false } })
    await payload.update({ collection: 'admins', id: firstAdmin.id, data: { isActive: true } })
    assert.equal((await payload.findByID({ collection: 'users', id: linked.docs[0]!.id })).status, 'suspended')
    console.log('full form, snapshots, immutable relations, dimensions, flags and explicit account linkage: PASS')
    await payload.update({ collection: 'products', id: product.id, data: { cartonsPerPallet: 24 }, user: managerActor, overrideAccess: false })
    assert.equal((await payload.findByID({ collection: 'orders', id: order.id, depth: 0 })).items[0]!.cartonsPerPallet, 48)

    // Approve transition
    const approved = await payload.update({
      collection: 'orders',
      id: order.id,
      user: { ...service, collection: 'admins' },
      data: { status: 'approve', timeline: echoedTimeline },
    })
    assert.equal(approved.status, 'approve')
    assert.deepEqual(approved.timeline?.[0], form.timeline?.[0])
    assert.equal(approved.timeline?.length, (form.timeline?.length ?? 0) + 1)

    // Pre-hook orders can have no timeline. Payload admin serializes an empty array as 0,
    // which beforeOperation sees before the normal field sanitizers run.
    const legacy = await payload.create({ collection: 'orders', data: {
      trackingNumber: 0, orderNumber: '', user: user.id, warehouse: warehouse.id, status: 'pending',
      items: [{ product: product.id, requestedArea: 1 }], subtotal: 0, finalTotal: 0,
    } as never })
    await pool.query('DELETE FROM orders_timeline WHERE _parent_id=$1', [legacy.id])
    for (const timeline of [0, '0']) {
      const saved = await payload.update({ collection: 'orders', id: legacy.id, user: supportActor, overrideAccess: false, data: { notes: 'legacy empty form', timeline } as never })
      assert.deepEqual(saved.timeline, [])
    }
    const legacyApproved = await payload.update({ collection: 'orders', id: legacy.id, user: supportActor, overrideAccess: false, data: { status: 'approve', timeline: 0 } as never })
    assert.equal(legacyApproved.status, 'approve')
    assert.equal(legacyApproved.timeline?.length, 1)
    assert.equal(legacyApproved.timeline?.[0]?.status, 'approve')
    await assert.rejects(payload.update({ collection: 'orders', id: legacy.id, user: supportActor, overrideAccess: false, data: { notes: 'cannot erase history', timeline: 0 } as never }))
    await payload.update({ collection: 'orders', id: legacy.id, user: supportActor, overrideAccess: false, data: { status: 'cancelled_by_admin' } })

    // Activity Feed Endpoint check (CTE query in PostgreSQL)
    const feedReq = await createLocalReq({ user: { ...service, role: 'service', collection: 'admins' } }, payload)
    Object.assign(feedReq, { url: `http://localhost/api/activity-feed?userId=${user.id}&limit=10&filter=all` })
    const feedResponse = await activityFeedEndpoint.handler(feedReq)
    assert.equal(feedResponse.status, 200)
    const feedData = (await feedResponse.json()) as { items: Array<{ kind: string; id: unknown }>; hasMore: boolean }
    assert.ok(feedData.items.length >= 2, 'activity feed should contain both orders and supply requests')
    assert.ok(feedData.items.some(i => i.kind === 'order'))
    assert.ok(feedData.items.some(i => i.kind === 'supply'))

    // Filter by order
    const orderOnlyReq = await createLocalReq({ user: { ...service, role: 'service', collection: 'admins' } }, payload)
    Object.assign(orderOnlyReq, { url: `http://localhost/api/activity-feed?userId=${user.id}&limit=10&filter=order` })
    const orderOnlyRes = await activityFeedEndpoint.handler(orderOnlyReq)
    assert.equal(orderOnlyRes.status, 200)
    const orderOnlyData = (await orderOnlyRes.json()) as { items: Array<{ kind: string }> }
    assert.ok(orderOnlyData.items.length >= 1)
    assert.ok(orderOnlyData.items.every(i => i.kind === 'order'))

    // Filter by supply
    const supplyOnlyReq = await createLocalReq({ user: { ...service, role: 'service', collection: 'admins' } }, payload)
    Object.assign(supplyOnlyReq, { url: `http://localhost/api/activity-feed?userId=${user.id}&limit=10&filter=supply` })
    const supplyOnlyRes = await activityFeedEndpoint.handler(supplyOnlyReq)
    assert.equal(supplyOnlyRes.status, 200)
    const supplyOnlyData = (await supplyOnlyRes.json()) as { items: Array<{ kind: string }> }
    assert.ok(supplyOnlyData.items.length >= 1)
    assert.ok(supplyOnlyData.items.every(i => i.kind === 'supply'))
    console.log('activity feed CTE endpoint: PASS')
    await payload.update({ collection: 'orders', id: order.id, data: { status: 'completed' }, user: supportActor, overrideAccess: false })
    const terminal = await payload.update({ collection: 'orders', id: order.id, data: { notes: 'terminal note' }, user: supportActor, overrideAccess: false })
    assert.equal(terminal.notes, 'terminal note')
    await assert.rejects(payload.update({ collection: 'orders', id: order.id, data: { deliveryAddress: 'changed terminal' } }))
    await assert.rejects(payload.update({ collection: 'orders', id: order.id, data: { status: 'pending' } }))

    await pool.query(`CREATE FUNCTION fail_audit_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$; CREATE TRIGGER fail_audit_fixture BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_audit_fixture()`)
    try {
      const saved = await payload.update({ collection: 'users', id: user.id, data: { companyName: 'Audit failure survived' } })
      assert.equal(saved.companyName, 'Audit failure survived')
      assert.equal((await payload.findByID({ collection: 'users', id: user.id })).companyName, 'Audit failure survived')
    } finally { await pool.query('DROP TRIGGER fail_audit_fixture ON audit_logs; DROP FUNCTION fail_audit_fixture()') }
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
    const beforeImport = await payload.find({ collection: 'warehouse-stock', where: { and: [{ product: { equals: product.id } }, { warehouse: { equals: warehouse.id } }] }, depth: 0 })
    assert.equal(beforeImport.docs[0]!.inventorySqm, 133.92)
    assert.equal((await importRequest('/apply', { token: previewData.token })).status, 200)
    assert.equal((await importRequest('/apply', { token: previewData.token })).status, 409)
    const imported = await payload.find({ collection: 'warehouse-stock', where: { and: [{ product: { equals: product.id } }, { warehouse: { equals: warehouse.id } }] }, depth: 0 })
    assert.equal(imported.docs[0]!.inventorySqm, 100)
    assert.equal((await importRequest('/apply', { token: previewData.token + 'tampered' })).status, 409)
    console.log('CSV preview, authorization, apply, replay and tamper checks: PASS')
    const other = await payload.create({ collection: 'products', data: { sku: 'PP-BAG', slug: 'pp-bag', name: 'چسب', productType: 'other', unit: 'bag', sqmPerCarton: 1.44, basePricePerSqm: 100 } })
    const otherBalance = await payload.create({ collection: 'warehouse-stock', data: { isActive: true, warehouse: warehouse.id, product: other.id, inventorySqm: 10, revision: 0 } })
    const mixed = await payload.create({ collection: 'orders', data: {
      trackingNumber: 0, orderNumber: 'ptp-mixed', user: user.id, warehouse: warehouse.id, status: 'pending', subtotal: 0, finalTotal: 0,
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
    const tileAfterCancel = await payload.find({ collection: 'warehouse-stock', where: { and: [{ product: { equals: product.id } }, { warehouse: { equals: warehouse.id } }] }, depth: 0 })
    assert.equal(tileAfterCancel.docs[0]!.inventorySqm, 100)
    const multiPreview = await importRequest('/preview', { warehouseId: warehouse.id, csv: 'sku,inventorySqm\nPP-TEST-001,88\nPP-BAG,9' })
    assert.equal(multiPreview.status, 200)
    const multiToken = (await multiPreview.json()).token
    await pool.query('UPDATE warehouse_stock SET revision = revision + 1 WHERE id = $1', [otherBalance.id])
    assert.equal((await importRequest('/apply', { token: multiToken })).status, 409)
    const tileAfterFailedImport = await payload.find({ collection: 'warehouse-stock', where: { and: [{ product: { equals: product.id } }, { warehouse: { equals: warehouse.id } }] }, depth: 0 })
    assert.equal(tileAfterFailedImport.docs[0]!.inventorySqm, 100, 'stale second row rolls back first row')
    const staleProductPreview = await importRequest('/preview', { warehouseId: warehouse.id, csv: 'sku,inventorySqm\nPP-BAG,9' })
    await payload.update({ collection: 'products', id: other.id, data: { name: 'چسب جدید' } })
    assert.equal((await importRequest('/apply', { token: (await staleProductPreview.json()).token })).status, 409)
    const audit = await payload.find({ collection: 'audit-logs', where: { target: { equals: `موجودی انبار #${warehouse.id}` } } })
    assert.equal(audit.totalDocs, 1, 'only successful CSV applications are audited')
    const kimiaPreview = await importRequest('/preview', { mode: 'kimia', warehouseId: warehouse.id, csv: '"متر مربع";"12345";"77.5";"نام نادیده";"PP-TEST-001";\n"عدد";"10";"2";"ناشناخته";"MISSING";' })
    assert.equal(kimiaPreview.status, 200)
    const kimia = await kimiaPreview.json()
    assert.equal(kimia.total, 2)
    assert.equal(kimia.rows.length, 1)
    assert.equal(kimia.errors.length, 1)
    assert.equal(kimia.rows[0].basePricePerSqm, 1235)
    assert.equal((await importRequest('/apply', { token: kimia.token })).status, 200)
    assert.equal((await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).basePricePerSqm, 1235)
    assert.equal((await payload.find({ collection: 'warehouse-stock', where: { and: [{ product: { equals: product.id } }, { warehouse: { equals: warehouse.id } }] }, depth: 0 })).docs[0]!.inventorySqm, 77.5)
    const pricePreview = await importRequest('/preview', { mode: 'price', csv: 'sku,basePricePerSqm\nPP-TEST-001,999' })
    assert.equal(pricePreview.status, 200)
    const priceToken = (await pricePreview.json()).token
    await payload.update({ collection: 'products', id: product.id, data: { basePricePerSqm: 2222 } })
    assert.equal((await importRequest('/apply', { token: priceToken })).status, 409)
    assert.equal((await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).basePricePerSqm, 2222)
    const exportReq = await createLocalReq({ user: { ...manager, role: 'manager', collection: 'admins' } }, payload)
    Object.assign(exportReq, { url: 'http://localhost/api/warehouse-stock/export?mode=price' })
    const exported = await stockImportEndpoints.find(endpoint => endpoint.path === '/export')!.handler(exportReq)
    assert.equal(exported.status, 200)
    const priceRoundTrip = await importRequest('/preview', { mode: 'price', csv: await exported.text() })
    assert.equal(priceRoundTrip.status, 200)
    assert.equal((await priceRoundTrip.json()).errors.length, 0)
    const expiredPreview = await importRequest('/preview', { mode: 'price', csv: 'sku,basePricePerSqm\nPP-TEST-001,999' })
    const expiredBody = JSON.parse(Buffer.from((await expiredPreview.json()).token.split('.')[0], 'base64url').toString())
    expiredBody.expiresAt = 0
    const encodedExpired = Buffer.from(JSON.stringify(expiredBody)).toString('base64url')
    const expiredSignature = createHmac('sha256', payload.secret).update(encodedExpired).digest('hex')
    assert.equal((await importRequest('/apply', { token: `${encodedExpired}.${expiredSignature}` })).status, 409)
    const rollbackPreview = await importRequest('/preview', { mode: 'kimia', warehouseId: warehouse.id, csv: '"m";"4000";"45";"x";"PP-TEST-001";\n"m";"5000";"5";"x";"PP-BAG";' })
    const rollbackToken = (await rollbackPreview.json()).token
    await pool.query('UPDATE warehouse_stock SET revision = revision + 1 WHERE id = $1', [otherBalance.id])
    assert.equal((await importRequest('/apply', { token: rollbackToken })).status, 409)
    assert.equal((await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).basePricePerSqm, 2222)
    assert.equal((await payload.find({ collection: 'warehouse-stock', where: { and: [{ product: { equals: product.id } }, { warehouse: { equals: warehouse.id } }] }, depth: 0 })).docs[0]!.inventorySqm, 77.5)
    console.log('CSV multi-row rollback, product-version invalidation and audit persistence: PASS')
    console.log('mixed units: authoritative pricing, reserve/cancel and unit immutability: PASS')
    const raceProduct = await payload.create({ collection: 'products', data: { name: 'Packaging race', sku: 'PACK-RACE', slug: 'pack-race', sqmPerCarton: 1, basePricePerSqm: 100 } })
    await payload.create({ collection: 'warehouse-stock', data: { product: raceProduct.id, warehouse: warehouse.id, inventorySqm: 100, revision: 0, isActive: true } })
    const packagingRace = await Promise.allSettled([
      payload.update({ collection: 'products', id: raceProduct.id, data: { sqmPerCarton: 2 } }),
      payload.create({ collection: 'orders', data: { user: user.id, warehouse: warehouse.id, status: 'pending', trackingNumber: 0, orderNumber: '', subtotal: 0, finalTotal: 0, items: [{ product: raceProduct.id, requestedArea: 1 }] } as never }),
    ])
    assert.equal(packagingRace[1]!.status, 'fulfilled')
    const persistedFactor = (await payload.findByID({ collection: 'products', id: raceProduct.id })).sqmPerCarton
    if (packagingRace[1]!.status === 'fulfilled') assert.equal(packagingRace[1]!.value.items[0]!.salesFactor, persistedFactor)
    const raceBrand = await payload.create({ collection: 'brands', data: { name: 'Reference race', slug: 'reference-race' } })
    const deletionRace = await Promise.allSettled([
      payload.delete({ collection: 'brands', id: raceBrand.id }),
      payload.update({ collection: 'products', id: noCodeTwo.id, data: { brand: raceBrand.id } }),
    ])
    assert.ok(deletionRace.some(result => result.status === 'rejected'), 'delete and new reference must never both succeed')
    console.log('packaging/order and reference/deletion races: PASS')
    console.log('Local API CRUD and lifecycle tests: PASS')

    // Rollback must never silently delete post-migration records.
    await assert.rejects(applyDown(), /Automatic rollback is disabled/)
    assert.equal((await pool.query("select to_regclass('public.warehouse_stock') as name")).rows[0].name, 'warehouse_stock')
    console.log('destructive automatic rollback is blocked: PASS')

  } finally {
    await pool.end()
    if (payload.db.pool) payload.db.pool.on('error', () => {})
    await payload.destroy?.()
    await control.query(`DROP DATABASE "${name}" WITH (FORCE)`)
    await control.end()
  }
})
