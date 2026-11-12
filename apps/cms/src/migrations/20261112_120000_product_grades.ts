import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_products_grade" ADD VALUE IF NOT EXISTS 'grade_d';
    ALTER TYPE "public"."enum_products_grade" ADD VALUE IF NOT EXISTS 'grade_c';
    ALTER TYPE "public"."enum_products_grade" ADD VALUE IF NOT EXISTS 'cg3';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The cast aborts the transaction if any product still uses a new grade.
  await db.execute(sql`
    ALTER TYPE "public"."enum_products_grade" RENAME TO "enum_products_grade_expanded";
    CREATE TYPE "public"."enum_products_grade" AS ENUM ('grade_1', 'grade_2', 'grade_3', 'grade_4');
    ALTER TABLE "public"."products"
      ALTER COLUMN "grade" TYPE "public"."enum_products_grade"
      USING "grade"::text::"public"."enum_products_grade";
    DROP TYPE "public"."enum_products_grade_expanded";
  `)
}
