import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "warehouses" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar NOT NULL,
    "name" varchar NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "warehouse_stock" (
    "id" serial PRIMARY KEY NOT NULL,
    "warehouse_id" integer NOT NULL,
    "product_id" integer NOT NULL,
    "inventory_sqm" numeric DEFAULT 0 NOT NULL,
    "revision" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "warehouses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "warehouse_stock_id" integer;
  ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_amount_check" CHECK ("inventory_sqm" >= 0 AND "inventory_sqm" = ROUND("inventory_sqm", 2));
  ALTER TABLE "warehouse_stock" ADD CONSTRAINT "warehouse_stock_revision_check" CHECK ("revision" >= 0 AND "revision" = FLOOR("revision"));
  CREATE UNIQUE INDEX "warehouses_code_idx" ON "warehouses" USING btree ("code");
  CREATE INDEX "warehouses_updated_at_idx" ON "warehouses" USING btree ("updated_at");
  CREATE INDEX "warehouses_created_at_idx" ON "warehouses" USING btree ("created_at");
  CREATE INDEX "warehouse_stock_warehouse_idx" ON "warehouse_stock" USING btree ("warehouse_id");
  CREATE INDEX "warehouse_stock_product_idx" ON "warehouse_stock" USING btree ("product_id");
  CREATE INDEX "warehouse_stock_updated_at_idx" ON "warehouse_stock" USING btree ("updated_at");
  CREATE INDEX "warehouse_stock_created_at_idx" ON "warehouse_stock" USING btree ("created_at");
  CREATE UNIQUE INDEX "warehouse_product_idx" ON "warehouse_stock" USING btree ("warehouse_id","product_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warehouses_fk" FOREIGN KEY ("warehouses_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warehouse_stock_fk" FOREIGN KEY ("warehouse_stock_id") REFERENCES "public"."warehouse_stock"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_warehouses_id_idx" ON "payload_locked_documents_rels" USING btree ("warehouses_id");
  CREATE INDEX "payload_locked_documents_rels_warehouse_stock_id_idx" ON "payload_locked_documents_rels" USING btree ("warehouse_stock_id");
`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "warehouses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "warehouse_stock" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_warehouses_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_warehouse_stock_fk";

  DROP INDEX "payload_locked_documents_rels_warehouses_id_idx";
  DROP INDEX "payload_locked_documents_rels_warehouse_stock_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "warehouses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "warehouse_stock_id";
  DROP TABLE "warehouse_stock";
  DROP TABLE "warehouses";`)
}
