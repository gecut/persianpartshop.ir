'use client'
import { Button } from '@payloadcms/ui'
import { CatalogSection, CatalogSelect, CatalogText } from './_catalog-controls'
import type { CatalogEditorProps } from './_catalog-form'
import styles from './catalog-settings-field.module.css'

const examples = {
  phone: 'tel:+982112345678',
  email: 'mailto:info@example.com',
  telegram: 'https://t.me/username',
  whatsapp: 'https://wa.me/989121234567',
  eitaa: 'https://eitaa.com/username',
  bale: 'https://ble.ir/username',
  website: 'https://example.com',
}
export function CatalogContact({
  settings,
  field,
  hasError,
  group,
  readOnly,
}: CatalogEditorProps) {
  const channels = settings.contact.channels
  return (
    <CatalogSection
      title={`راه‌های ارتباطی · ${channels.length.toLocaleString('fa-IR')} کانال`}
      hasError={hasError('contact')}
    >
      <p>
        در پایین فهرست و جزئیات محصول نمایش داده می‌شوند. افزودن راه ارتباطی
        اختیاری است؛ حداکثر ۱۰ مورد.
      </p>
      {channels.length === 0 && <p>راه ارتباطی تنظیم نشده است.</p>}
      {channels.map((channel, index) => {
        const key = `contact.channels.${index}`
        const change = (patch: Partial<typeof channel>) =>
          group('contact', {
            channels: channels.map((item, i) =>
              i === index ? { ...item, ...patch } : item,
            ),
          })
        return (
          <div key={index} className={styles.channel}>
            <h4>
              راه ارتباطی {(index + 1).toLocaleString('fa-IR')}
              {channel.label ? ` · ${channel.label}` : ''}
            </h4>
            <div className={styles.grid}>
              <CatalogSelect
                {...field(`${key}.type`)}
                label="نوع راه ارتباطی"
                value={channel.type}
                choices={
                  [
                    ['phone', 'تلفن'],
                    ['email', 'ایمیل'],
                    ['telegram', 'تلگرام'],
                    ['whatsapp', 'واتساپ'],
                    ['eitaa', 'ایتا'],
                    ['bale', 'بله'],
                    ['website', 'وب‌سایت'],
                  ] as const
                }
                onChange={([type]) => change({ type })}
              />
              <CatalogText
                {...field(`${key}.label`)}
                label="عنوان نمایشی"
                value={channel.label}
                onChange={(label) => change({ label })}
              />
            </div>
            <CatalogText
              {...field(`${key}.url`)}
              label="نشانی ارتباط"
              ltr
              value={channel.url}
              description={`نمونه: ${examples[channel.type]}`}
              onChange={(url) => change({ url })}
            />
            <Button
              type="button"
              buttonStyle="secondary"
              size="small"
              disabled={readOnly}
              onClick={() =>
                group('contact', {
                  channels: channels.filter((_, i) => i !== index),
                })
              }
            >
              حذف این راه ارتباطی
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        buttonStyle="secondary"
        size="small"
        disabled={readOnly || channels.length >= 10}
        onClick={() =>
          group('contact', {
            channels: [...channels, { type: 'website', label: '', url: '' }],
          })
        }
      >
        افزودن راه ارتباطی
      </Button>
    </CatalogSection>
  )
}
