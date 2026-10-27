export function validateSeedTarget(environment: {
  NODE_ENV?: string
  DATABASE_URI?: string
  DATABASE_URL?: string
  CMS_SEED_DATABASE_URI?: string
}): void {
  if (environment.NODE_ENV !== 'development') throw new Error('Seed requires NODE_ENV=development')

  const databaseUri = environment.DATABASE_URI || environment.DATABASE_URL
  if (!databaseUri || environment.CMS_SEED_DATABASE_URI !== databaseUri) {
    throw new Error('Seed requires explicit CMS_SEED_DATABASE_URI matching the configured database')
  }

  const target = new URL(databaseUri)
  if (target.search || target.hash) throw new Error('Seed database URI must not override connection parameters')
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw new Error('Seed requires PostgreSQL')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw new Error('Seed requires a local disposable database')
  if (!/^\/(cms_seed_|persianpart_)[a-z0-9_]+$/.test(target.pathname)) {
    throw new Error('Seed database name must start with cms_seed_ or persianpart_')
  }
}
