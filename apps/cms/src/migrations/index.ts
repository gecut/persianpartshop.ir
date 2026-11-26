import * as cmsMcp from './20261115_120000_cms_mcp';
import * as galleryImageSizes from './20261116_150000_gallery_image_sizes';
import * as publicCatalog from './20261118_120000_public_catalog';
import * as smsQueueClaim from './20261120_120000_sms_queue_claim';
import * as mcpProductFamilies from './20261121_140000_mcp_product_families'
import * as mediaBlurCss from './20261124_120000_media_blur_css';
import * as mediaBlurCssColumnName from './20261124_130000_media_blur_css_column_name';
import * as productFamilies from './20261121_120000_product_families';
import * as offlineSnapshots from './20261114_140000_offline_snapshots';
import * as hookIntegrity from './20261110_120000_hook_integrity';
import * as sharedTracking from './20261109_160000_shared_tracking_numbers';
import * as migration_20261108_152041_baseline from './20261108_152041_baseline';
import * as migration_20261109_140000_supply_simplification from './20261109_140000_supply_simplification';
import * as smsQueueAndNotifications from './20261111_010000_sms_queue_and_notifications';
import * as smsQueueLockedDocs from './20261111_070000_sms_queue_locked_documents_rel';
import * as productImageWatermark from './20261111_120000_product_image_watermark';
import * as productGrades from './20261112_120000_product_grades';
import * as productStockOwnership from './20261114_120000_product_stock_ownership';
import * as customerOtpOwnership from './20261114_130000_customer_otp_ownership';
import * as qrCodes from './20261125_120000_qr_codes';

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
  { up: productGrades.up, down: productGrades.down, name: '20261112_120000_product_grades' },
  { up: productStockOwnership.up, down: productStockOwnership.down, name: '20261114_120000_product_stock_ownership' },
  { up: customerOtpOwnership.up, down: customerOtpOwnership.down, name: '20261114_130000_customer_otp_ownership' },
  { up: offlineSnapshots.up, down: offlineSnapshots.down, name: '20261114_140000_offline_snapshots' },
  { up: cmsMcp.up, down: cmsMcp.down, name: '20261115_120000_cms_mcp' },
  { up: galleryImageSizes.up, down: galleryImageSizes.down, name: '20261116_150000_gallery_image_sizes' },
  { up: publicCatalog.up, down: publicCatalog.down, name: '20261118_120000_public_catalog' },
  { up: smsQueueClaim.up, down: smsQueueClaim.down, name: '20261120_120000_sms_queue_claim' },
  { up: productFamilies.up, down: productFamilies.down, name: '20261121_120000_product_families' },
  { up: mcpProductFamilies.up, down: mcpProductFamilies.down, name: '20261121_140000_mcp_product_families' },
  { up: mediaBlurCss.up, down: mediaBlurCss.down, name: '20261124_120000_media_blur_css' },
  { up: mediaBlurCssColumnName.up, down: mediaBlurCssColumnName.down, name: '20261124_130000_media_blur_css_column_name' },
  { up: qrCodes.up, down: qrCodes.down, name: '20261125_120000_qr_codes' },
];
