import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

const inputs = [
  'products', 'products_gallery', 'products_rels', 'categories', 'brands', 'tags',
  'dimensions', 'warehouses', 'orders', 'orders_items',
  'orders_timeline', 'supply_requests', 'plans', 'plans_rels', 'users', 'users_rels',
  'users_documents', 'users_addresses', 'customer_types', 'media',
]

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TABLE offline_source_revision (
      source text PRIMARY KEY,
      revision bigint NOT NULL DEFAULT 0
    );
    CREATE TABLE offline_snapshots (
      account_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      snapshot_id uuid NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      source_revision text NOT NULL,
      structural_revision text NOT NULL,
      latest_structural_revision text,
      latest_version text,
      manifest jsonb NOT NULL,
      body bytea NOT NULL
    );
    CREATE INDEX offline_snapshots_expiry ON offline_snapshots(expires_at);
    INSERT INTO offline_source_revision (source) VALUES ('warehouse_stock'), ('warehouse_stock_structure');
    CREATE FUNCTION mark_offline_stock_changed() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE offline_source_revision SET revision = revision + 1 WHERE source = 'warehouse_stock';
      IF TG_OP <> 'UPDATE' THEN
        UPDATE offline_source_revision SET revision = revision + 1 WHERE source = 'warehouse_stock_structure';
      ELSIF EXISTS (
        SELECT 1 FROM stock_after AS a FULL JOIN stock_before AS b USING (id)
        WHERE (to_jsonb(a) - ARRAY['inventory_sqm', 'revision', 'updated_at'])
          IS DISTINCT FROM (to_jsonb(b) - ARRAY['inventory_sqm', 'revision', 'updated_at'])
      ) THEN
        UPDATE offline_source_revision SET revision = revision + 1 WHERE source = 'warehouse_stock_structure';
      END IF;
      RETURN NULL;
    END
    $$;
    CREATE TRIGGER mark_offline_stock_update AFTER UPDATE ON warehouse_stock
      REFERENCING OLD TABLE AS stock_before NEW TABLE AS stock_after
      FOR EACH STATEMENT EXECUTE FUNCTION mark_offline_stock_changed();
    CREATE TRIGGER mark_offline_stock_structure AFTER INSERT OR DELETE OR TRUNCATE ON warehouse_stock
      FOR EACH STATEMENT EXECUTE FUNCTION mark_offline_stock_changed();
    CREATE FUNCTION mark_offline_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE offline_source_revision SET revision = revision + 1 WHERE source = TG_TABLE_NAME;
      RETURN NULL;
    END
    $$;
  `)
  for (const table of inputs) {
    await db.execute(sql`INSERT INTO offline_source_revision (source) VALUES (${table})`)
    await db.execute(sql`
      CREATE TRIGGER mark_offline_source_changed
      AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${sql.identifier(table)}
      FOR EACH STATEMENT EXECUTE FUNCTION mark_offline_source_changed();
    `)
  }
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`
    DROP FUNCTION mark_offline_stock_changed() CASCADE;
    DROP FUNCTION mark_offline_source_changed() CASCADE;
    DROP TABLE offline_snapshots;
    DROP TABLE offline_source_revision;
  `)
}
