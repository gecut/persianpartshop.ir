import { Alert, Button } from '@heroui/react'
import { SmartphoneIcon, SmartphoneUpdateIcon } from '@solar-icons/react/linear'

interface PwaNoticeProps {
  kind: 'install' | 'update'
  onOpen: () => void
  onDismiss: () => void
}

export function PwaNotice({ kind, onOpen, onDismiss }: PwaNoticeProps) {
  const isUpdate = kind === 'update'

  return (
    <Alert status="accent" role="status" className="pwa-alert mx-auto w-[calc(100%-2rem)] max-w-lg">
      <Alert.Indicator aria-hidden="true">
        {isUpdate ? <SmartphoneUpdateIcon size={20} /> : <SmartphoneIcon size={20} />}
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>
          {isUpdate ? 'نسخهٔ جدید آماده است' : 'پرشین‌پارت، همیشه در دسترس'}
        </Alert.Title>
        <Alert.Description>
          {isUpdate ? 'برای استفاده از آخرین نسخه، برنامه را بروزرسانی کنید.' : 'برنامه را به صفحهٔ اصلی دستگاه اضافه کنید تا سریع‌تر به آن دسترسی داشته باشید.'}
        </Alert.Description>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" onPress={onOpen}>
            {isUpdate ? 'بروزرسانی برنامه' : 'نصب برنامه'}
          </Button>
          <Button size="sm" variant="ghost" onPress={onDismiss}>بعداً</Button>
        </div>
      </Alert.Content>
    </Alert>
  )
}
