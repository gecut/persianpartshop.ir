import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "otps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"phone" varchar NOT NULL,
  	"code" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"cooldown_until" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "otps_id" integer;
  ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "otps_user_idx" ON "otps" USING btree ("user_id");
  CREATE UNIQUE INDEX "otps_phone_idx" ON "otps" USING btree ("phone");
  CREATE INDEX "otps_updated_at_idx" ON "otps" USING btree ("updated_at");
  CREATE INDEX "otps_created_at_idx" ON "otps" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_otps_fk" FOREIGN KEY ("otps_id") REFERENCES "public"."otps"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_otps_id_idx" ON "payload_locked_documents_rels" USING btree ("otps_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "otps" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "otps" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_otps_fk";
  
  DROP INDEX "payload_locked_documents_rels_otps_id_idx";
  ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "otps_id";`)
}
