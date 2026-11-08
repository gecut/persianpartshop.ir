import * as migration_20261108_152041_baseline from './20261108_152041_baseline';

export const migrations = [
  {
    up: migration_20261108_152041_baseline.up,
    down: migration_20261108_152041_baseline.down,
    name: '20261108_152041_baseline'
  },
];
