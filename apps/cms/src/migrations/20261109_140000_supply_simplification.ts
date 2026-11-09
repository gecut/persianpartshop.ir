import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Pre-condition checks:
  const orphanSources = await db.execute(sql`
    SELECT id FROM "supply_sources" 
    WHERE "warehouse_id" IS NULL OR "product_id" IS NULL OR "warehouse_id" NOT IN (SELECT "id" FROM "warehouses") 
       OR "product_id" NOT IN (SELECT "id" FROM "products")
    LIMIT 1
  `)
  if (orphanSources.rows.length > 0) {
    throw new Error('Precondition failed: supply_sources contains orphan records.')
  }

  const wrongSourceMode = await db.execute(sql`
    SELECT ss.id FROM supply_sources ss JOIN warehouses w ON w.id = ss.warehouse_id
    WHERE w.stock_mode <> 'inquiry' LIMIT 1
  `)
  if (wrongSourceMode.rows.length) throw new Error('Precondition failed: supply source is not assigned to an inquiry warehouse.')

  const collisions = await db.execute(sql`
    SELECT ss.id FROM "supply_sources" ss 
    JOIN "warehouse_stock" ws ON ss.warehouse_id = ws.warehouse_id AND ss.product_id = ws.product_id
    LIMIT 1
  `)
  if (collisions.rows.length > 0) {
    throw new Error('Precondition failed: Composite key collision (warehouse_id, product_id) between supply_sources and warehouse_stock.')
  }

  const invalidInquiry = await db.execute(sql`
    SELECT ws.id FROM warehouse_stock ws JOIN warehouses w ON w.id = ws.warehouse_id
    WHERE w.stock_mode = 'inquiry' AND ws.inventory_sqm IS NOT NULL AND ws.inventory_sqm <> 0 LIMIT 1
  `)
  if (invalidInquiry.rows.length) throw new Error('Precondition failed: inquiry warehouse has a nonzero inventory.')
  const inquiryRows = await db.execute(sql`
    SELECT ws.id FROM warehouse_stock ws JOIN warehouses w ON w.id = ws.warehouse_id
    WHERE w.stock_mode = 'inquiry' LIMIT 1
  `)
  if (inquiryRows.rows.length) throw new Error('Precondition failed: inquiry warehouse already has stock rows; reconcile before migration.')

  // 2. Modify warehouse_stock:
  await db.execute(sql`
    ALTER TABLE "warehouse_stock" ALTER COLUMN "inventory_sqm" DROP NOT NULL;
    ALTER TABLE "warehouse_stock" DROP CONSTRAINT IF EXISTS "warehouse_stock_amount_check";
    ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_amount_check" 
      CHECK ("inventory_sqm" IS NULL OR ("inventory_sqm" >= 0 AND "inventory_sqm" = ROUND("inventory_sqm", 2)));
    ALTER TABLE "warehouse_stock" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
    ALTER TABLE "warehouse_stock" ADD COLUMN IF NOT EXISTS "last_reported_at" timestamp(3) with time zone;
  `)

  // 3. Create mapping table and copy data from supply_sources to warehouse_stock
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_migration_supply_sources_mapping" (
      "legacy_id" integer PRIMARY KEY,
      "new_id" integer NOT NULL
    );

    WITH inserted AS (
      INSERT INTO "warehouse_stock" (
        "warehouse_id", "product_id", "inventory_sqm", "revision", "is_active", "last_reported_at", "created_at", "updated_at"
      )
      SELECT
        "warehouse_id", "product_id", NULL, 0, "is_active", "last_reported_at", "created_at", "updated_at"
      FROM "supply_sources"
      RETURNING "id", "warehouse_id", "product_id"
    )
    INSERT INTO "_migration_supply_sources_mapping" ("legacy_id", "new_id")
    SELECT ss."id", ins."id"
    FROM "supply_sources" ss
    JOIN inserted ins ON ss."warehouse_id" = ins."warehouse_id" AND ss."product_id" = ins."product_id";
  `)

  // 4. Verify post-condition: row counts match
  const countCheck = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM "supply_sources") AS source_count,
      (SELECT COUNT(*) FROM "_migration_supply_sources_mapping") AS mapped_count
  `)
  const { source_count, mapped_count } = countCheck.rows[0] as { source_count: string; mapped_count: string }
  if (BigInt(source_count) !== BigInt(mapped_count)) {
    throw new Error(`Migration verification failed: expected ${source_count} rows migrated, got ${mapped_count}`)
  }

  // 5. Reset sequence for warehouse_stock
  await db.execute(sql`
    SELECT setval(pg_get_serial_sequence('warehouse_stock', 'id'), COALESCE((SELECT MAX(id) FROM "warehouse_stock"), 1));
  `)

  // 6. Rename supply_sources to supply_sources_legacy
  await db.execute(sql`
    ALTER TABLE "supply_sources" RENAME TO "supply_sources_legacy";
  `)

  // 7. Update supply_requests table
  await db.execute(sql`
    ALTER TABLE "supply_requests" ALTER COLUMN "warehouse_id" DROP NOT NULL;
    ALTER TABLE "supply_requests" ALTER COLUMN "warehouse_name" DROP NOT NULL;
    ALTER TABLE "supply_requests" ALTER COLUMN "warehouse_code" DROP NOT NULL;
    ALTER TABLE "supply_requests" ADD COLUMN IF NOT EXISTS "fingerprint_version" numeric DEFAULT 1 NOT NULL;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Automatic rollback is disabled: restoring the legacy schema can discard supply requests and stock changes. Restore from a verified backup using a reviewed recovery plan.')
}
