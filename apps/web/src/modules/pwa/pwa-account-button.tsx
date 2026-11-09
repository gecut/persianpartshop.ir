import { Button } from '@heroui/react'

export function PwaAccountButton() {
  return <Button variant="secondary" onPress={() => window.dispatchEvent(new Event('persianpart:pwa-open'))}>نصب و بروزرسانی برنامه</Button>
}
