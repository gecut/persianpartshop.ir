import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    LOCK TABLE orders, supply_requests IN ACCESS EXCLUSIVE MODE;
    CREATE SEQUENCE customer_tracking_number_seq MINVALUE 1 MAXVALUE 9007199254740991;
    ALTER TABLE orders ADD COLUMN tracking_number numeric;
    ALTER TABLE supply_requests ADD COLUMN tracking_number numeric;
    CREATE TEMP TABLE tracking_number_backfill ON COMMIT DROP AS
      SELECT kind, id, row_number() OVER (ORDER BY created_at, kind, id) AS number
      FROM (
        SELECT 'order' AS kind, id, created_at FROM orders
        UNION ALL
        SELECT 'supply' AS kind, id, created_at FROM supply_requests
      ) records;
    UPDATE orders o SET tracking_number = b.number
      FROM tracking_number_backfill b WHERE b.kind = 'order' AND b.id = o.id;
    UPDATE supply_requests s SET tracking_number = b.number
      FROM tracking_number_backfill b WHERE b.kind = 'supply' AND b.id = s.id;
    SELECT setval('customer_tracking_number_seq', GREATEST(COALESCE(MAX(number), 0), 1), COUNT(*) > 0)
      FROM tracking_number_backfill;
    ALTER TABLE orders ALTER COLUMN tracking_number SET NOT NULL;
    ALTER TABLE supply_requests ALTER COLUMN tracking_number SET NOT NULL;
    CREATE UNIQUE INDEX orders_tracking_number_idx ON orders (tracking_number);
    CREATE UNIQUE INDEX supply_requests_tracking_number_idx ON supply_requests (tracking_number);
    ALTER TABLE orders ADD CONSTRAINT orders_tracking_number_check
      CHECK (tracking_number > 0 AND tracking_number = trunc(tracking_number) AND tracking_number <= 9007199254740991);
    ALTER TABLE supply_requests ADD CONSTRAINT supply_requests_tracking_number_check
      CHECK (tracking_number > 0 AND tracking_number = trunc(tracking_number) AND tracking_number <= 9007199254740991);
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Automatic rollback is disabled: assigned customer tracking numbers must remain stable.')
}
