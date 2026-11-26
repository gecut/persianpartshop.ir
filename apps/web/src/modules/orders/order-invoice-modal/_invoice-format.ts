export const INVOICE_VALIDITY_HOURS = 24

const quantityFormatter = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Tehran',
})

export function formatInvoiceQuantity(value: number): string {
  return quantityFormatter.format(value)
}

export function formatInvoiceDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return dateTimeFormatter.format(d).replace(', ', '، ')
}

export function invoiceValidUntil(createdAt: string): Date {
  return new Date(Date.parse(createdAt) + INVOICE_VALIDITY_HOURS * 3_600_000)
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه']
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده']
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود']
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون']

function threeDigitToWords(num: number): string {
  const parts: string[] = []
  const h = Math.floor(num / 100)
  const rem = num % 100

  if (h > 0) parts.push(HUNDREDS[h])

  if (rem >= 10 && rem <= 19) {
    parts.push(TEENS[rem - 10])
  } else {
    const t = Math.floor(rem / 10)
    const o = rem % 10
    if (t > 0) parts.push(TENS[t])
    if (o > 0) parts.push(ONES[o])
  }

  return parts.join(' و ')
}

export function tomanToPersianWords(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`Expected a non-negative safe integer, got ${amount}`)
  }

  if (amount === 0) return 'صفر تومان'

  const groups: string[] = []
  let remaining = amount
  let scaleIndex = 0

  while (remaining > 0) {
    const group = remaining % 1000
    if (group > 0) {
      const words = threeDigitToWords(group)
      const scale = SCALES[scaleIndex]
      groups.unshift(scale ? `${words} ${scale}` : words)
    }
    remaining = Math.floor(remaining / 1000)
    scaleIndex++
  }

  return `${groups.join(' و ')} تومان`
}
