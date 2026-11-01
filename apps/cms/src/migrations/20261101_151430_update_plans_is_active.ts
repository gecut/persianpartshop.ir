import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_product_type" AS ENUM('tile', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_unit" AS ENUM('bag', 'bucket', 'pack', 'can', 'branch', 'piece', 'box', 'roll', 'kg', 'liter');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_documents_document_type" AS ENUM('business_license', 'establishment_license', 'operating_license', 'trade_guild_registration', 'union_membership', 'competent_authorities_permit', 'stewardship_card_or_letter', 'sales_agency_certificate', 'brand_agency_certificate', 'standard_certificate', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_documents_status" AS ENUM('pending', 'approved', 'rejected');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_audit_logs_action" AS ENUM('admin_login', 'product_create', 'product_update', 'product_delete', 'user_create', 'user_update', 'user_ban', 'user_unban', 'user_delete', 'admin_manage', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_audit_logs_entity" AS ENUM('products', 'users', 'admins', 'auth', 'orders');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "users_documents" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"document_type" "enum_users_documents_document_type" DEFAULT 'business_license' NOT NULL,
    	"title" varchar,
    	"file_id" integer NOT NULL,
    	"status" "enum_users_documents_status" DEFAULT 'pending' NOT NULL,
    	"rejection_reason" varchar,
    	"uploaded_at" timestamp(3) with time zone
    );

    CREATE TABLE IF NOT EXISTS "users_rels" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"order" integer,
    	"parent_id" integer NOT NULL,
    	"path" varchar NOT NULL,
    	"categories_id" integer
    );

    CREATE TABLE IF NOT EXISTS "audit_logs" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"action" "enum_audit_logs_action" NOT NULL,
    	"entity" "enum_audit_logs_entity" NOT NULL,
    	"admin_name" varchar,
    	"admin_id" integer,
    	"target" varchar NOT NULL,
    	"details" varchar,
    	"ip" varchar,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "admins" ALTER COLUMN "role" SET DATA TYPE text;
      ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'manager'::text;
      DROP TYPE IF EXISTS "public"."enum_admins_role";
      CREATE TYPE "public"."enum_admins_role" AS ENUM('superadmin', 'manager', 'service');
      ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'manager'::"public"."enum_admins_role";
      ALTER TABLE "admins" ALTER COLUMN "role" SET DATA TYPE "public"."enum_admins_role" USING "role"::"public"."enum_admins_role";
    EXCEPTION
      WHEN OTHERS THEN null;
    END $$;

    DROP INDEX IF EXISTS "otps_phone_idx";
    ALTER TABLE "products" ALTER COLUMN "sqm_per_carton" DROP NOT NULL;
    ALTER TABLE "products" ALTER COLUMN "dimension_id" DROP NOT NULL;

    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_type" "enum_products_product_type" DEFAULT 'tile';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unit" "enum_products_unit" DEFAULT 'bag';
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "items_per_pack" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "approx_coverage" varchar;

    ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "starts_at" timestamp(3) with time zone;
    ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "expires_at" timestamp(3) with time zone;
    ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
    ALTER TABLE "plans" DROP COLUMN IF EXISTS "status";
    DROP TYPE IF EXISTS "public"."enum_plans_status";
    ALTER TABLE "plans_rels" ADD COLUMN IF NOT EXISTS "products_id" integer;

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_banned" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hide_exact_stock" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disable_ordering" boolean DEFAULT false;
    ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "phone" varchar;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "audit_logs_id" integer;

    DO $$ BEGIN
      ALTER TABLE "users_documents" ADD CONSTRAINT "users_documents_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "users_documents" ADD CONSTRAINT "users_documents_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_documents_order_idx" ON "users_documents" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_documents_parent_id_idx" ON "users_documents" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "users_documents_file_idx" ON "users_documents" USING btree ("file_id");
    CREATE INDEX IF NOT EXISTS "users_rels_order_idx" ON "users_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "users_rels_path_idx" ON "users_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "users_rels_categories_id_idx" ON "users_rels" USING btree ("categories_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_admin_idx" ON "audit_logs" USING btree ("admin_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_updated_at_idx" ON "audit_logs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");

    DO $$ BEGIN
      ALTER TABLE "plans_rels" ADD CONSTRAINT "plans_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk" FOREIGN KEY ("audit_logs_id") REFERENCES "public"."audit_logs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "plans_rels_products_id_idx" ON "plans_rels" USING btree ("products_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_audit_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_logs_id");
    CREATE INDEX IF NOT EXISTS "otps_phone_idx" ON "otps" USING btree ("phone");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_plans_status" AS ENUM('active', 'expired', 'draft');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "status" "public"."enum_plans_status" DEFAULT 'active';
    ALTER TABLE "plans" DROP COLUMN IF EXISTS "is_active";
  `)
}
