import * as migration_20261027_113124_baseline from './20261027_113124_baseline';
import * as migration_20261027_132154_add_otps from './20261027_132154_add_otps';
import * as migration_20261101_151430_update_plans_is_active from './20261101_151430_update_plans_is_active';
import * as migration_20261104_082415_add_secondary_unit_to_products from './20261104_082415_add_secondary_unit_to_products';

export const migrations = [
  {
    up: migration_20261027_113124_baseline.up,
    down: migration_20261027_113124_baseline.down,
    name: '20261027_113124_baseline',
  },
  {
    up: migration_20261027_132154_add_otps.up,
    down: migration_20261027_132154_add_otps.down,
    name: '20261027_132154_add_otps',
  },
  {
    up: migration_20261101_151430_update_plans_is_active.up,
    down: migration_20261101_151430_update_plans_is_active.down,
    name: '20261101_151430_update_plans_is_active',
  },
  {
    up: migration_20261104_082415_add_secondary_unit_to_products.up,
    down: migration_20261104_082415_add_secondary_unit_to_products.down,
    name: '20261104_082415_add_secondary_unit_to_products'
  },
];
