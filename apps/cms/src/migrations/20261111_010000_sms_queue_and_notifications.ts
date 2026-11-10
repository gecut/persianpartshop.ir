import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_sms_queue_template" AS ENUM(
        'otp',
        'order-registered',
        'order-approved',
        'order-cancelled',
        'admin-new-order',
        'admin-order-cancelled',
        'supply-result',
        'admin-new-supply-request',
        'plan-assigned'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_sms_queue_status" AS ENUM(
        'pending',
        'retry_scheduled',
        'sent',
        'failed'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "sms_queue" (
      "id" serial PRIMARY KEY NOT NULL,
      "receptor" varchar NOT NULL,
      "template" "enum_sms_queue_template" NOT NULL,
      "tokens" jsonb NOT NULL,
      "status" "enum_sms_queue_status" DEFAULT 'pending' NOT NULL,
      "attempts" numeric DEFAULT 0 NOT NULL,
      "last_error" varchar,
      "next_retry_at" timestamp(3) with time zone,
      "sent_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "sms_queue_receptor_idx" ON "sms_queue" USING btree ("receptor");
    CREATE INDEX IF NOT EXISTS "sms_queue_status_idx" ON "sms_queue" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "sms_queue_next_retry_at_idx" ON "sms_queue" USING btree ("next_retry_at");
    CREATE INDEX IF NOT EXISTS "sms_queue_updated_at_idx" ON "sms_queue" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "sms_queue_created_at_idx" ON "sms_queue" USING btree ("created_at");

    CREATE TABLE IF NOT EXISTS "notification_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "enable_order_notifications" boolean DEFAULT true,
      "enable_supply_notifications" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );

    CREATE TABLE IF NOT EXISTS "notification_settings_admin_phones" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "phone" varchar NOT NULL,
      "name" varchar
    );

    CREATE INDEX IF NOT EXISTS "notification_settings_admin_phones_order_idx" ON "notification_settings_admin_phones" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "notification_settings_admin_phones_parent_id_idx" ON "notification_settings_admin_phones" USING btree ("_parent_id");

    DO $$ BEGIN
      ALTER TABLE "notification_settings_admin_phones"
        ADD CONSTRAINT "notification_settings_admin_phones_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "notification_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "notification_settings_admin_phones" CASCADE;
    DROP TABLE IF EXISTS "notification_settings" CASCADE;
    DROP TABLE IF EXISTS "sms_queue" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_sms_queue_status";
    DROP TYPE IF EXISTS "public"."enum_sms_queue_template";
  `)
}
