import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_mcp_api_keys"
      ADD COLUMN IF NOT EXISTS "product_families_find" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "product_families_create" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "product_families_update" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "product_families_delete" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_mcp_api_keys"
      DROP COLUMN IF EXISTS "product_families_find",
      DROP COLUMN IF EXISTS "product_families_create",
      DROP COLUMN IF EXISTS "product_families_update",
      DROP COLUMN IF EXISTS "product_families_delete";
  `)
}
