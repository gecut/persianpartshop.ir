import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_sms_queue_status" ADD VALUE IF NOT EXISTS 'sending' BEFORE 'sent';
    ALTER TABLE "sms_queue" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot drop an enum value, so the type is rebuilt without it.
  // Claimed jobs return to pending; the provider may already have accepted them.
  await db.execute(sql`
    UPDATE "sms_queue" SET "status" = 'pending' WHERE "status" = 'sending';
    ALTER TABLE "sms_queue" DROP COLUMN IF EXISTS "claimed_at";
    ALTER TABLE "sms_queue" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TYPE "public"."enum_sms_queue_status" RENAME TO "enum_sms_queue_status_old";
    CREATE TYPE "public"."enum_sms_queue_status" AS ENUM('pending', 'retry_scheduled', 'sent', 'failed');
    ALTER TABLE "sms_queue" ALTER COLUMN "status" TYPE "public"."enum_sms_queue_status"
      USING "status"::text::"public"."enum_sms_queue_status";
    ALTER TABLE "sms_queue" ALTER COLUMN "status" SET DEFAULT 'pending';
    DROP TYPE "public"."enum_sms_queue_status_old";
  `)
}
