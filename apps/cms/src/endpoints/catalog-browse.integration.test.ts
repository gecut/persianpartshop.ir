import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { drizzle } from '@payloadcms/db-postgres/drizzle/node-postgres'
import type { MigrateDownArgs, MigrateUpArgs, PostgresAdapter } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { migrations } from '../migrations'
import * as productGrades from '../migrations/20261112_120000_product_grades'
import { catalogBrowseQuery, InternalCatalogBrowseSchema, catalogBrowseEndpoint, planBrowseEndpoint } from './catalog-browse.endpoint'

const require = createRequire(import.meta.url)
const pg = require(require.resolve('pg', { paths: [require.resolve('@payloadcms/db-postgres')] })) as PostgresAdapter['pg']
test('catalog SQL applies permissions, search, stock and price order before pagination over 650 products', { skip: !process.env.CATALOG_TEST_CONTROL_URI }, async () => {
  const uri = new URL(process.env.CATALOG_TEST_CONTROL_URI!)
  assert.ok(['localhost', '127.0.0.1'].includes(uri.hostname))
  assert.equal(uri.pathname, '/postgres')
  const name = `catalog_read_test_${randomUUID().replaceAll('-', '')}`
  assert.match(name, /^catalog_read_test_[a-f0-9]+$/)
  const control = new pg.Pool({ connectionString: uri.href })
  uri.pathname = `/${name}`
  const pool = new pg.Pool({ connectionString: uri.href })
  try {
    await control.query(`CREATE DATABASE "${name}"`)
    const db = drizzle(pool)
    const gradeMigrationIndex = migrations.findIndex(migration => migration.up === productGrades.up)
    assert.ok(gradeMigrationIndex >= 0)
    for (const migration of migrations.slice(0, gradeMigrationIndex)) {
      await db.transaction(tx => migration.up({ db: tx } as unknown as MigrateUpArgs))
    }
    await pool.query("INSERT INTO categories (id,name,slug) VALUES (1,'عمومی','general'),(2,'محدود','restricted')")
    await pool.query("INSERT INTO brands (id,name,slug) VALUES (1,'برند الف','a')")
    await pool.query("INSERT INTO dimensions (id,name,slug,width,height) VALUES (1,'60×120','60-120',60,120)")
    await pool.query("INSERT INTO tags (id,name,slug) VALUES (1,'ویژه','special')")
    await pool.query("INSERT INTO products (id,name,sku,slug,category_id,brand_id,dimension_id,grade,color,base_price_per_sqm,sqm_per_carton,created_at) SELECT i, 'کالا '||i,'SKU-'||i,'p-'||i,CASE WHEN i%2=0 THEN 2 ELSE 1 END,1,1,'grade_1','سفید',651-i,1,'2026-01-01'::timestamptz+i*interval '1 second' FROM generate_series(1,650) i")
    await pool.query("INSERT INTO products_rels (parent_id,path,tags_id) VALUES (649,'tags',1)")
    await pool.query("INSERT INTO warehouses (id,code,name,stock_mode) VALUES (1,'E','Exact','exact'),(2,'I','Inquiry','inquiry')")
    await pool.query("INSERT INTO warehouse_stock (product_id,warehouse_id,inventory_sqm,revision) VALUES (649,1,100,0),(647,2,NULL,0)")
    await pool.query("UPDATE products SET grade = (CASE id WHEN 2 THEN 'grade_2' WHEN 4 THEN 'grade_3' WHEN 6 THEN 'grade_4' END)::enum_products_grade WHERE id IN (2,4,6,8)")
    const productRows = async () => (await pool.query('SELECT * FROM products ORDER BY id')).rows
    const originalProducts = await productRows()
    const upgrade = () => db.transaction(tx => productGrades.up({ db: tx } as unknown as MigrateUpArgs))
    const downgrade = () => db.transaction(tx => productGrades.down({ db: tx } as unknown as MigrateDownArgs))
    await upgrade()
    assert.deepEqual(await productRows(), originalProducts)
    await downgrade()
    assert.deepEqual(await productRows(), originalProducts)
    const { rows: [restored] } = await pool.query("SELECT enum_range(NULL::enum_products_grade)::text AS grades")
    assert.equal(restored.grades, '{grade_1,grade_2,grade_3,grade_4}')
    await upgrade()
    await upgrade()
    for (const migration of migrations.slice(gradeMigrationIndex + 1)) {
      await db.transaction(tx => migration.up({ db: tx } as unknown as MigrateUpArgs))
    }
    const read = async (filters: Record<string, unknown> = {}) => {
      const query = catalogBrowseQuery(InternalCatalogBrowseSchema.parse({ allowedCategoryIds: [1], markupPercent: 10, ...filters }))
      return (await pool.query<{ id: number; total: number }>(query.text, query.params)).rows
    }
    assert.equal((await read())[0]!.total, 325)
    assert.equal((await read({ sort: 'newest' }))[0]!.id, 649)
    await pool.query("UPDATE products SET name = CASE id WHEN 1 THEN 'آزمایش الف' WHEN 3 THEN 'آزمایش ب' WHEN 5 THEN 'آزمایش الف' ELSE name END WHERE id IN (1,3,5)")
    assert.deepEqual((await read({ search: 'آزمایش', limit: 2, page: 1 })).map(row => row.id), [1, 5])
    assert.deepEqual((await read({ search: 'آزمایش', limit: 2, page: 2 })).map(row => row.id), [3])
    assert.deepEqual((await read({ search: 'SKU-649' })).map(row => row.id), [649])
    assert.deepEqual((await read({ search: 'ویژه' })).map(row => row.id), [649])
    assert.deepEqual((await read({ tags: ['ویژه'], grades: ['درجه ۱'], dimension: '60×120', brands: ['برند الف'] })).map(row => row.id), [649])
    assert.deepEqual((await read({ inStock: true })).map(row => row.id), [649])
    assert.deepEqual((await read({ supplyMode: true })).map(row => row.id), [647])
    assert.equal((await read({ sort: 'cheapest', limit: 1 }))[0]!.id, 649)
    assert.equal((await read({ sort: 'expensive', limit: 1 }))[0]!.id, 1)
    assert.equal((await read({ sort: 'oldest', limit: 1 }))[0]!.id, 1)
    assert.equal((await read({ sort: 'cheapest', page: 2, limit: 1 }))[0]!.id, 647)
    assert.deepEqual(await read({ category: 'محدود' }), [])
    assert.deepEqual(await read({ search: "%' OR 1=1 --" }), [])
    await pool.query("UPDATE products SET grade = (CASE id WHEN 1 THEN 'grade_d' WHEN 3 THEN 'grade_c' WHEN 5 THEN 'cg3' END)::enum_products_grade WHERE id IN (1,3,5)")
    const upgradedProducts = await productRows()
    await assert.rejects(downgrade, (error: unknown) =>
      error instanceof Error && error.cause instanceof Error &&
      'code' in error.cause && error.cause.code === '22P02')
    assert.deepEqual(await productRows(), upgradedProducts)
    assert.deepEqual((await read({ grades: ['گرید D'] })).map(row => row.id), [1])
    assert.deepEqual((await read({ grades: ['گرید C'] })).map(row => row.id), [3])
    assert.deepEqual((await read({ grades: ['CG3'] })).map(row => row.id), [5])
    assert.deepEqual((await read({ grades: ['گرید D', 'CG3'] })).map(row => row.id), [1, 5])
    assert.deepEqual(await read({ grades: ['ناشناخته'] }), [])
    const req = (body: unknown, role = 'service') => ({ user: { collection: 'admins', id: 1, role }, json: async () => body, payload: { db: { pool } } }) as unknown as PayloadRequest
    assert.equal((await catalogBrowseEndpoint.handler(req({}, 'support'))).status, 403)
    const catalogResponse = await catalogBrowseEndpoint.handler(req({ allowedCategoryIds: [1], markupPercent: 10, search: 'SKU-649' }))
    assert.deepEqual(await catalogResponse.json(), { ids: [649], total: 1 })
    await pool.query("INSERT INTO customer_types (id,name,slug) VALUES (1,'Default','default')")
    await pool.query("INSERT INTO users (id,full_name,phone,customer_type_id) VALUES (1,'One','09120000001',1),(2,'Two','09120000002',1)")
    await pool.query("INSERT INTO plans (id,title,content,starts_at,expires_at) VALUES (1,'Expired','Content','2026-01-01','2026-01-02'),(2,'Current','Content','2026-06-01',NULL),(3,'Earlier','Content','2026-02-01',NULL),(4,'Other user','Content','2026-09-01',NULL)")
    await pool.query("INSERT INTO plans_rels (parent_id,path,users_id) VALUES (1,'users',1),(2,'users',1),(3,'users',1),(4,'users',2)")
    const planPage = await planBrowseEndpoint.handler(req({ userId: 1, page: 1, limit: 2 }))
    assert.deepEqual(await planPage.json(), { ids: [2, 3], total: 3 })
    const planTail = await planBrowseEndpoint.handler(req({ userId: 1, page: 2, limit: 2 }))
    assert.deepEqual(await planTail.json(), { ids: [1], total: 3 })
  } finally {
    await pool.end()
    await control.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    await control.end()
  }
})
