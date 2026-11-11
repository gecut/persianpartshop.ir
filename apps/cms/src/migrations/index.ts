import * as hookIntegrity from './20261110_120000_hook_integrity';
import * as sharedTracking from './20261109_160000_shared_tracking_numbers';
import * as migration_20261108_152041_baseline from './20261108_152041_baseline';
import * as migration_20261109_140000_supply_simplification from './20261109_140000_supply_simplification';
import * as smsQueueAndNotifications from './20261111_010000_sms_queue_and_notifications';
import * as smsQueueLockedDocs from './20261111_070000_sms_queue_locked_documents_rel';
import * as productImageWatermark from './20261111_120000_product_image_watermark';

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
  { up: hookIntegrity.up, down: hookIntegrity.down, name: '20261110_120000_hook_integrity' },
  { up: smsQueueAndNotifications.up, down: smsQueueAndNotifications.down, name: '20261111_010000_sms_queue_and_notifications' },
  { up: smsQueueLockedDocs.up, down: smsQueueLockedDocs.down, name: '20261111_070000_sms_queue_locked_documents_rel' },
  { up: productImageWatermark.up, down: productImageWatermark.down, name: '20261111_120000_product_image_watermark' },
];
