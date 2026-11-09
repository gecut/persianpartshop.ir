import { toPersianDigits } from './currency'

export function formatTrackingNumber(value: string | number): string {
  return toPersianDigits(value)
}
