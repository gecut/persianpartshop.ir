import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateSeedTarget } from './_seed-target'

const uri = 'postgresql://fixture@127.0.0.1:55483/cms_seed_fixture'
const valid = { NODE_ENV: 'development', DATABASE_URI: uri, CMS_SEED_DATABASE_URI: uri }

test('seed accepts an explicitly selected local disposable target', () => {
  assert.doesNotThrow(() => validateSeedTarget(valid))
})

for (const [name, environment] of Object.entries({
  production: { ...valid, NODE_ENV: 'production' },
  unspecified: {},
  unconfirmed: { ...valid, CMS_SEED_DATABASE_URI: undefined },
  mismatch: { ...valid, CMS_SEED_DATABASE_URI: `${uri}_different` },
  shared: { ...valid, DATABASE_URI: uri.replace('127.0.0.1', 'db.internal'), CMS_SEED_DATABASE_URI: uri.replace('127.0.0.1', 'db.internal') },
  application: { ...valid, DATABASE_URI: uri.replace('cms_seed_fixture', 'production_db'), CMS_SEED_DATABASE_URI: uri.replace('cms_seed_fixture', 'production_db') },
  sqlite: { ...valid, DATABASE_URI: 'file:./payload.db', CMS_SEED_DATABASE_URI: 'file:./payload.db' },
  queryHost: { ...valid, DATABASE_URI: `${uri}?host=db.internal`, CMS_SEED_DATABASE_URI: `${uri}?host=db.internal` },
  queryDatabase: { ...valid, DATABASE_URI: `${uri}?dbname=production`, CMS_SEED_DATABASE_URI: `${uri}?dbname=production` },
})) {
  test(`seed rejects ${name} before opening a database`, () => {
    assert.throws(() => validateSeedTarget(environment))
  })
}
