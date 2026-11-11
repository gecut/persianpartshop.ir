import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "sms_queue_id" integer;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sms_queue_id_idx"
      ON "payload_locked_documents_rels" USING btree ("sms_queue_id");

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_sms_queue_fk"
        FOREIGN KEY ("sms_queue_id")
        REFERENCES "public"."sms_queue"("id")
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
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_sms_queue_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_sms_queue_id_idx";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "sms_queue_id";
  `)
}
