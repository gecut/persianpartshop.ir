import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_secondary_unit" AS ENUM('meter', 'kg', 'cm', 'g');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "secondary_unit" "enum_products_secondary_unit";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "secondary_unit";
    DROP TYPE IF EXISTS "public"."enum_products_secondary_unit";
  `)
}
