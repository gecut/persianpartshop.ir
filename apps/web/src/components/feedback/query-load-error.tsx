import { Button } from '@heroui/react'

interface QueryLoadErrorProps {
  message: string
  onRetry: () => void
}

export function QueryLoadError({ message, onRetry }: QueryLoadErrorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <p role="alert" className="text-danger">{message}</p>
      <Button size="sm" variant="ghost" onPress={onRetry}>تلاش دوباره</Button>
    </div>
  )
}
