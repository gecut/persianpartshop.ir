import * as planTitleConstraint from './20261107_100000_plan_title_constraint';
import * as migration_20261027_113124_baseline from './20261027_113124_baseline';
import * as migration_20261027_132154_add_otps from './20261027_132154_add_otps';
import * as migration_20261101_151430_update_plans_is_active from './20261101_151430_update_plans_is_active';
import * as migration_20261104_082415_add_secondary_unit_to_products from './20261104_082415_add_secondary_unit_to_products';
import * as migration_20261107_080025_warehouse_foundation from './20261107_080025_warehouse_foundation';
import * as migration_20261107_080843_warehouse_orders from './20261107_080843_warehouse_orders';
import * as migration_20261107_082608_order_request_fingerprint from './20261107_082608_order_request_fingerprint';
import * as migration_20261107_090722_warehouse_sales_units from './20261107_090722_warehouse_sales_units';

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
    name: '20261104_082415_add_secondary_unit_to_products',
  },
  {
    up: migration_20261107_080025_warehouse_foundation.up,
    down: migration_20261107_080025_warehouse_foundation.down,
    name: '20261107_080025_warehouse_foundation',
  },
  {
    up: migration_20261107_080843_warehouse_orders.up,
    down: migration_20261107_080843_warehouse_orders.down,
    name: '20261107_080843_warehouse_orders',
  },
  {
    up: migration_20261107_082608_order_request_fingerprint.up,
    down: migration_20261107_082608_order_request_fingerprint.down,
    name: '20261107_082608_order_request_fingerprint',
  },
  {
    up: migration_20261107_090722_warehouse_sales_units.up,
    down: migration_20261107_090722_warehouse_sales_units.down,
    name: '20261107_090722_warehouse_sales_units'
  },
  { up: planTitleConstraint.up, down: planTitleConstraint.down, name: '20261107_100000_plan_title_constraint' },
];
