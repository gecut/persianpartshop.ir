import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// The remote collection requires titles, but its baseline allowed NULL.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`UPDATE plans SET title = 'طرح ' || id::text WHERE title IS NULL;
    ALTER TABLE plans ALTER COLUMN title SET NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE plans ALTER COLUMN title DROP NOT NULL;`)
}
