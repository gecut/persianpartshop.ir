import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE warehouse_stock
      DROP CONSTRAINT warehouse_stock_product_id_products_id_fk,
      ADD CONSTRAINT warehouse_stock_product_id_products_id_fk
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

    -- This retired table keeps its original product IDs as archived data.
    ALTER TABLE supply_sources_legacy DROP CONSTRAINT supply_sources_product_id_products_id_fk;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE supply_sources_legacy
      ADD CONSTRAINT supply_sources_product_id_products_id_fk
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
    ALTER TABLE warehouse_stock
      DROP CONSTRAINT warehouse_stock_product_id_products_id_fk,
      ADD CONSTRAINT warehouse_stock_product_id_products_id_fk
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  `)
}
