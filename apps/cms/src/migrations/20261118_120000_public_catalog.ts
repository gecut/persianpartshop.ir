import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS catalog_settings (
      id serial PRIMARY KEY NOT NULL, policy jsonb NOT NULL, last_edited_by numeric,
      updated_at timestamp(3) with time zone, created_at timestamp(3) with time zone
    );
    CREATE TABLE IF NOT EXISTS _catalog_settings_v (
      id serial PRIMARY KEY NOT NULL, version_policy jsonb NOT NULL, version_last_edited_by numeric,
      version_updated_at timestamp(3) with time zone, version_created_at timestamp(3) with time zone,
      created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
      updated_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS _catalog_settings_v_created_at_idx ON _catalog_settings_v (created_at);
    CREATE INDEX IF NOT EXISTS _catalog_settings_v_updated_at_idx ON _catalog_settings_v (updated_at);
    INSERT INTO catalog_settings (policy, created_at, updated_at)
      SELECT '{
        "paused":true,"pausedMessage":"کاتالوگ در حال آماده‌سازی است.","base":"none","additions":[],"exclusions":[],
        "criteria":{"productTypes":[],"categoryIds":[],"brandIds":[],"dimensionIds":[],"colors":[],"grades":[],"tagIds":[],"tagMatch":"any","stockStatuses":[],"minPrice":null,"maxPrice":null,"onlyWithImage":false,"onlyWithValidPrice":false},
        "pricing":{"showPrice":true,"percentage":0,"roundingStep":1,"note":"قیمت‌های درج‌شده، قیمت عمومی کاتالوگ هستند."},
        "stock":{"mode":"status","displayCap":null},
        "presentation":{"title":"کاتالوگ پرشین‌پارت","introduction":"","fallbackImage":null,"watermark":false,"view":"grid","sort":"default"},
        "sharing":{"title":"کاتالوگ پرشین‌پارت","description":"معرفی محصولات پرشین‌پارت","image":null,"allowIndexing":false},
        "contact":{"channels":[],"linkToStore":false}
      }'::jsonb, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM catalog_settings);
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS _catalog_settings_v; DROP TABLE IF EXISTS catalog_settings;`)
}
