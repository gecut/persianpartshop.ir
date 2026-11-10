import type { postgresAdapter } from '@payloadcms/db-postgres'

type SchemaHook = NonNullable<Parameters<typeof postgresAdapter>[0]['beforeSchemaInit']>[number]

export const restrictBusinessForeignKeys: SchemaHook = ({ adapter, schema }) => {
  for (const table of Object.values(adapter.rawTables)) {
    if (table.name.startsWith('payload_')) continue
    for (const column of Object.values(table.columns)) {
      if (column.reference && !['_parent_id', 'parent_id'].includes(column.name)) column.reference.onDelete = 'restrict'
      // categories.parent_id is a business relationship, unlike array ownership.
      if (table.name === 'categories' && column.reference) column.reference.onDelete = 'restrict'
    }
    for (const fk of Object.values(table.foreignKeys ?? {})) {
      if (!fk.columns.some(column => column === '_parent_id' || column === 'parent_id')) fk.onDelete = 'restrict'
    }
  }
  return schema
}
