import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN IF EXISTS (SELECT 1 FROM orders) THEN RAISE EXCEPTION 'Warehouse cutover requires an empty orders table; migrate existing orders explicitly or use an approved beta reset.'; END IF; END $$;
   ALTER TABLE "orders" ADD COLUMN "warehouse_id" integer NOT NULL;
  ALTER TABLE "orders" ADD COLUMN "warehouse_name" varchar;
  ALTER TABLE "orders" ADD COLUMN "warehouse_code" varchar;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
  CREATE INDEX "orders_warehouse_idx" ON "orders" USING btree ("warehouse_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders" DROP CONSTRAINT "orders_warehouse_id_warehouses_id_fk";

  DROP INDEX "orders_warehouse_idx";
  ALTER TABLE "orders" DROP COLUMN "warehouse_id";
  ALTER TABLE "orders" DROP COLUMN "warehouse_name";
  ALTER TABLE "orders" DROP COLUMN "warehouse_code";`)
}
