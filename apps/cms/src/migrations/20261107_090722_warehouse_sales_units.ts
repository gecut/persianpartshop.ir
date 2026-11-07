import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_items" ADD COLUMN "product_type" varchar;
  ALTER TABLE "orders_items" ADD COLUMN "unit" varchar;
  ALTER TABLE "orders_items" ADD COLUMN "sales_factor" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_items" DROP COLUMN "product_type";
  ALTER TABLE "orders_items" DROP COLUMN "unit";
  ALTER TABLE "orders_items" DROP COLUMN "sales_factor";`)
}
