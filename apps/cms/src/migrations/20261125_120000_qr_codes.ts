import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Expand step only: adds qr_codes. It never alters, drops or updates an existing column or row.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "qr_codes" (
      "id" serial PRIMARY KEY NOT NULL,
      "token" varchar NOT NULL,
      "product_id" integer,
      "store" varchar,
      "note" varchar,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "qr_codes_token_idx" ON "qr_codes" USING btree ("token");
    CREATE INDEX IF NOT EXISTS "qr_codes_product_idx" ON "qr_codes" USING btree ("product_id");
    CREATE INDEX IF NOT EXISTS "qr_codes_updated_at_idx" ON "qr_codes" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "qr_codes_created_at_idx" ON "qr_codes" USING btree ("created_at");
    DO $$ BEGIN
      ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "qr_codes_id" integer;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_qr_codes_id_idx"
      ON "payload_locked_documents_rels" USING btree ("qr_codes_id");
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_qr_codes_fk"
        FOREIGN KEY ("qr_codes_id") REFERENCES "public"."qr_codes"("id") ON DELETE cascade ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    INSERT INTO "offline_source_revision" ("source") VALUES ('qr_codes') ON CONFLICT DO NOTHING;
    DROP TRIGGER IF EXISTS mark_offline_source_changed ON "qr_codes";
    CREATE TRIGGER mark_offline_source_changed
      AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON "qr_codes"
      FOR EACH STATEMENT EXECUTE FUNCTION mark_offline_source_changed();
  `)
}

// For local rehearsal only. This drops qr token data; never run it operationally.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS mark_offline_source_changed ON "qr_codes";
    DELETE FROM "offline_source_revision" WHERE "source" = 'qr_codes';
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_qr_codes_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_qr_codes_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "qr_codes_id";
    DROP TABLE IF EXISTS "qr_codes";
  `)
}
