import * as sharedTracking from './20261109_160000_shared_tracking_numbers';
import * as migration_20261108_152041_baseline from './20261108_152041_baseline';
import * as migration_20261109_140000_supply_simplification from './20261109_140000_supply_simplification';

export const migrations = [
  {
    up: migration_20261108_152041_baseline.up,
    down: migration_20261108_152041_baseline.down,
    name: '20261108_152041_baseline'
  },
  {
    up: migration_20261109_140000_supply_simplification.up,
    down: migration_20261109_140000_supply_simplification.down,
    name: '20261109_140000_supply_simplification'
  },
  { up: sharedTracking.up, down: sharedTracking.down, name: '20261109_160000_shared_tracking_numbers' },
];
