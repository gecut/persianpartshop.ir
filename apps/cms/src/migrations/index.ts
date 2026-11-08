import * as migration_20261108_140603_baseline from './20261108_140603_baseline';

export const migrations = [
  {
    up: migration_20261108_140603_baseline.up,
    down: migration_20261108_140603_baseline.down,
    name: '20261108_140603_baseline'
  },
];
