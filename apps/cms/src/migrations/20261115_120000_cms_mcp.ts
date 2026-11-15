import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TABLE "payload_mcp_api_keys" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "label" varchar,
    "description" varchar,
    "products_find" boolean DEFAULT false,
    "products_create" boolean DEFAULT false,
    "products_update" boolean DEFAULT false,
    "products_delete" boolean DEFAULT false,
    "categories_find" boolean DEFAULT false,
    "categories_create" boolean DEFAULT false,
    "categories_update" boolean DEFAULT false,
    "categories_delete" boolean DEFAULT false,
    "brands_find" boolean DEFAULT false,
    "brands_create" boolean DEFAULT false,
    "brands_update" boolean DEFAULT false,
    "brands_delete" boolean DEFAULT false,
    "tags_find" boolean DEFAULT false,
    "tags_create" boolean DEFAULT false,
    "tags_update" boolean DEFAULT false,
    "tags_delete" boolean DEFAULT false,
    "dimensions_find" boolean DEFAULT false,
    "dimensions_create" boolean DEFAULT false,
    "dimensions_update" boolean DEFAULT false,
    "dimensions_delete" boolean DEFAULT false,
    "plans_find" boolean DEFAULT false,
    "plans_create" boolean DEFAULT false,
    "plans_update" boolean DEFAULT false,
    "plans_delete" boolean DEFAULT false,
    "users_find" boolean DEFAULT false,
    "users_create" boolean DEFAULT false,
    "users_update" boolean DEFAULT false,
    "customer_types_find" boolean DEFAULT false,
    "supply_requests_find" boolean DEFAULT false,
    "supply_requests_update" boolean DEFAULT false,
    "orders_find" boolean DEFAULT false,
    "orders_update" boolean DEFAULT false,
    "warehouses_find" boolean DEFAULT false,
    "warehouses_create" boolean DEFAULT false,
    "warehouses_update" boolean DEFAULT false,
    "warehouse_stock_find" boolean DEFAULT false,
    "media_find" boolean DEFAULT false,
    "media_update" boolean DEFAULT false,
    "media_delete" boolean DEFAULT false,
    "sms_queue_find" boolean DEFAULT false,
    "payload_mcp_tool_create_orders" boolean DEFAULT false,
    "payload_mcp_tool_read_product_stock" boolean DEFAULT false,
    "payload_mcp_tool_adjust_product_stock" boolean DEFAULT false,
    "payload_mcp_tool_prepare_media_upload" boolean DEFAULT false,
    "payload_mcp_tool_prepare_csv_import" boolean DEFAULT false,
    "payload_mcp_tool_get_csv_import_preview" boolean DEFAULT false,
    "payload_mcp_tool_apply_csv_import" boolean DEFAULT false,
    "payload_mcp_tool_export_prices" boolean DEFAULT false,
    "payload_mcp_tool_retry_failed_sms" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "enable_a_p_i_key" boolean,
    "api_key" varchar,
    "api_key_index" varchar
    );
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
    ALTER TABLE "payload_preferences_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
    ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_admins_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
    CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
    CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
    CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
    CREATE UNIQUE INDEX payload_mcp_api_keys_digest_idx ON payload_mcp_api_keys (api_key_index);

    CREATE TABLE mcp_transfers (
      id text PRIMARY KEY,
      kind text NOT NULL CHECK (kind IN ('media', 'csv', 'preview')),
      actor_id integer NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      key_digest text NOT NULL,
      payload jsonb NOT NULL,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX mcp_transfers_expires_idx ON mcp_transfers (expires_at);
  `)
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`
    DROP TABLE mcp_transfers;
    ALTER TABLE payload_preferences_rels DROP COLUMN payload_mcp_api_keys_id;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN payload_mcp_api_keys_id;
    DROP TABLE payload_mcp_api_keys;
  `)
}
