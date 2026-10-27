import * as migration_20261027_113124_baseline from './20261027_113124_baseline';
import * as migration_20261027_132154_add_otps from './20261027_132154_add_otps';

export const migrations = [
  {
    up: migration_20261027_113124_baseline.up,
    down: migration_20261027_113124_baseline.down,
    name: '20261027_113124_baseline',
  },
  {
    up: migration_20261027_132154_add_otps.up,
    down: migration_20261027_132154_add_otps.down,
    name: '20261027_132154_add_otps'
  },
];
