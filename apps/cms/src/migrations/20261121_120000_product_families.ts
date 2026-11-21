import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "product_families" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "product_families_updated_at_idx" ON "product_families" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "product_families_created_at_idx" ON "product_families" USING btree ("created_at");

    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "family_id" integer;

    CREATE INDEX IF NOT EXISTS "products_family_idx" ON "products" USING btree ("family_id");

    DO $$ BEGIN
      ALTER TABLE "products"
        ADD CONSTRAINT "products_family_id_product_families_id_fk"
        FOREIGN KEY ("family_id")
        REFERENCES "public"."product_families"("id")
        ON DELETE RESTRICT
        ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "product_families_id" integer;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_product_families_id_idx"
      ON "payload_locked_documents_rels" USING btree ("product_families_id");

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_product_families_fk"
        FOREIGN KEY ("product_families_id")
        REFERENCES "public"."product_families"("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_product_families_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_product_families_id_idx";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "product_families_id";

    ALTER TABLE "products"
      DROP CONSTRAINT IF EXISTS "products_family_id_product_families_id_fk";

    DROP INDEX IF EXISTS "products_family_idx";

    ALTER TABLE "products"
      DROP COLUMN IF EXISTS "family_id";

    DROP INDEX IF EXISTS "product_families_created_at_idx";
    DROP INDEX IF EXISTS "product_families_updated_at_idx";

    DROP TABLE IF EXISTS "product_families";
  `)
}
