import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media"
      ADD COLUMN "sizes_gallery_thumb_url" varchar,
      ADD COLUMN "sizes_gallery_thumb_width" numeric,
      ADD COLUMN "sizes_gallery_thumb_height" numeric,
      ADD COLUMN "sizes_gallery_thumb_mime_type" varchar,
      ADD COLUMN "sizes_gallery_thumb_filesize" numeric,
      ADD COLUMN "sizes_gallery_thumb_filename" varchar,
      ADD COLUMN "sizes_gallery_preview_url" varchar,
      ADD COLUMN "sizes_gallery_preview_width" numeric,
      ADD COLUMN "sizes_gallery_preview_height" numeric,
      ADD COLUMN "sizes_gallery_preview_mime_type" varchar,
      ADD COLUMN "sizes_gallery_preview_filesize" numeric,
      ADD COLUMN "sizes_gallery_preview_filename" varchar;
    CREATE INDEX "media_sizes_gallery_thumb_sizes_gallery_thumb_filename_idx"
      ON "media" USING btree ("sizes_gallery_thumb_filename");
    CREATE INDEX "media_sizes_gallery_preview_sizes_gallery_preview_filena_idx"
      ON "media" USING btree ("sizes_gallery_preview_filename");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media"
      DROP COLUMN "sizes_gallery_thumb_url",
      DROP COLUMN "sizes_gallery_thumb_width",
      DROP COLUMN "sizes_gallery_thumb_height",
      DROP COLUMN "sizes_gallery_thumb_mime_type",
      DROP COLUMN "sizes_gallery_thumb_filesize",
      DROP COLUMN "sizes_gallery_thumb_filename",
      DROP COLUMN "sizes_gallery_preview_url",
      DROP COLUMN "sizes_gallery_preview_width",
      DROP COLUMN "sizes_gallery_preview_height",
      DROP COLUMN "sizes_gallery_preview_mime_type",
      DROP COLUMN "sizes_gallery_preview_filesize",
      DROP COLUMN "sizes_gallery_preview_filename";
  `)
}
