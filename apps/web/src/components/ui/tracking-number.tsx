import { formatTrackingNumber } from '../../lib/utils/tracking-number'

export function TrackingNumber({ value }: { value: string | number }) {
  return <span className="inline-flex items-baseline gap-1.5 rounded-lg bg-muted/5 px-2 py-1.5 text-xs">
    <span className="font-normal text-muted">شمارهٔ پیگیری</span>
    <bdi className="font-bold tabular-nums text-foreground" data-selectable="true">{formatTrackingNumber(value)}</bdi>
  </span>
}
