import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Payload maps the `blurCSS` field to "blur_c_s_s"; the previous migration created "blur_css".
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "blur_c_s_s" jsonb;
    ALTER TABLE "media" DROP COLUMN IF EXISTS "blur_css";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "blur_css" jsonb;
    ALTER TABLE "media" DROP COLUMN IF EXISTS "blur_c_s_s";
  `)
}
