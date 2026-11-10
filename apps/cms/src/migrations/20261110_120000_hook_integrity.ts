import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM orders WHERE user_id IS NULL OR warehouse_id IS NULL) OR EXISTS (SELECT 1 FROM orders_items WHERE product_id IS NULL) OR EXISTS (SELECT 1 FROM users WHERE customer_type_id IS NULL) THEN
        RAISE EXCEPTION 'Precondition failed: missing required business relationships; inspect orders, orders_items and users.';
      END IF;
      IF EXISTS (SELECT 1 FROM products WHERE COALESCE(product_type, 'tile') = 'tile' AND (sqm_per_carton IS NULL OR sqm_per_carton < 0.01 OR sqm_per_carton <> round(sqm_per_carton, 2))) THEN
        RAISE EXCEPTION 'Precondition failed: invalid tile carton factors; inspect products before migration.';
      END IF;
      IF EXISTS (SELECT 1 FROM dimensions WHERE width <= 0 OR height <= 0) THEN RAISE EXCEPTION 'Precondition failed: nonpositive dimensions.'; END IF;
      IF EXISTS (SELECT 1 FROM customer_types WHERE markup_percent < -100) THEN RAISE EXCEPTION 'Precondition failed: customer markup below -100.'; END IF;
      IF EXISTS (SELECT 1 FROM plans WHERE expires_at <= starts_at) THEN RAISE EXCEPTION 'Precondition failed: plan ends before its start.'; END IF;
      IF EXISTS (
        WITH RECURSIVE ancestry AS (
          SELECT id AS origin, id, parent_id, ARRAY[id] AS visited, false AS cycle FROM categories
          UNION ALL SELECT a.origin, c.id, c.parent_id, a.visited || c.id, c.id = ANY(a.visited)
          FROM ancestry a JOIN categories c ON c.id = a.parent_id WHERE NOT a.cycle
        ) SELECT 1 FROM ancestry WHERE cycle
      ) THEN RAISE EXCEPTION 'Precondition failed: category cycle.'; END IF;
    END $$;

    ALTER TABLE orders_items ADD COLUMN product_name varchar, ADD COLUMN product_sku varchar;
    ALTER TABLE admins ADD COLUMN customer_id integer;
    CREATE UNIQUE INDEX admins_customer_idx ON admins(customer_id);
    ALTER TABLE admins ADD CONSTRAINT admins_customer_id_users_id_fk FOREIGN KEY(customer_id) REFERENCES users(id) ON DELETE RESTRICT;
    ALTER TABLE orders ALTER COLUMN cancelled_by DROP DEFAULT;

    ALTER TABLE products ADD CONSTRAINT products_tile_factor_valid CHECK (COALESCE(product_type, 'tile') <> 'tile' OR (sqm_per_carton IS NOT NULL AND sqm_per_carton >= 0.01 AND sqm_per_carton = round(sqm_per_carton, 2)));
    ALTER TABLE dimensions ADD CONSTRAINT dimensions_positive CHECK(width > 0 AND height > 0);
    ALTER TABLE customer_types ADD CONSTRAINT customer_types_markup_valid CHECK(markup_percent >= -100);
    ALTER TABLE plans ADD CONSTRAINT plans_dates_valid CHECK(expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at);
    ALTER TABLE categories ADD CONSTRAINT categories_not_self CHECK(parent_id IS NULL OR parent_id <> id);

    -- Keep the original definitions for a faithful rollback, including join ownership cascades.
    CREATE TABLE _migration_hook_fk_actions (table_name text NOT NULL, constraint_name text NOT NULL, definition text NOT NULL, PRIMARY KEY(table_name, constraint_name));
    DO $$ DECLARE item record; definition text; BEGIN
      FOR item IN
        SELECT c.conname, c.conrelid::regclass AS source, pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE c.contype='f' AND n.nspname='public' AND t.relname NOT LIKE 'payload_%'
          AND NOT EXISTS (SELECT 1 FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k WHERE a.attname IN ('_parent_id', 'parent_id') AND t.relname <> 'categories')
      LOOP
        INSERT INTO _migration_hook_fk_actions VALUES (item.source::text, item.conname, item.definition);
        definition := regexp_replace(item.definition, 'ON DELETE (SET NULL|CASCADE|SET DEFAULT|NO ACTION|RESTRICT)', 'ON DELETE RESTRICT');
        IF definition = item.definition AND definition NOT LIKE '%ON DELETE RESTRICT%' THEN definition := definition || ' ON DELETE RESTRICT'; END IF;
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.source, item.conname);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', item.source, item.conname, definition);
      END LOOP;
    END $$;
    UPDATE products p SET width=d.width, height=d.height FROM dimensions d WHERE p.dimension_id=d.id;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM orders_items WHERE product_name IS NOT NULL OR product_sku IS NOT NULL) OR EXISTS (SELECT 1 FROM admins WHERE customer_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Automatic rollback is disabled: snapshot or explicit account links would be lost.';
      END IF;
    END $$;
    DO $$ DECLARE item record; BEGIN
      FOR item IN SELECT * FROM _migration_hook_fk_actions LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.table_name, item.constraint_name);
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', item.table_name, item.constraint_name, item.definition);
      END LOOP;
    END $$;
    DROP TABLE _migration_hook_fk_actions;
    ALTER TABLE products DROP CONSTRAINT products_tile_factor_valid;
    ALTER TABLE dimensions DROP CONSTRAINT dimensions_positive;
    ALTER TABLE customer_types DROP CONSTRAINT customer_types_markup_valid;
    ALTER TABLE plans DROP CONSTRAINT plans_dates_valid;
    ALTER TABLE categories DROP CONSTRAINT categories_not_self;
    ALTER TABLE admins DROP COLUMN customer_id;
    ALTER TABLE orders_items DROP COLUMN product_name, DROP COLUMN product_sku;
    ALTER TABLE orders ALTER COLUMN cancelled_by SET DEFAULT 'admin';
  `)
}
