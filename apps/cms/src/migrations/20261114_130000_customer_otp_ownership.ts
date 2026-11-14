import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE otps
      DROP CONSTRAINT otps_user_id_users_id_fk,
      ADD CONSTRAINT otps_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE otps
      DROP CONSTRAINT otps_user_id_users_id_fk,
      ADD CONSTRAINT otps_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
  `)
}
