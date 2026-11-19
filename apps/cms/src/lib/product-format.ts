// Persian digits and currency formatting utilities

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/**
 * Converts English digits in a string or number to Persian digits
 */
function toPersianDigits(value: string | number): string {
  if (value === null || value === undefined) return ''
  return value
    .toString()
    .replace(/[0-9]/g, (char) => PERSIAN_DIGITS[parseInt(char, 10)] ?? char)
}

/**
 * Formats a number with comma thousand separators
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}
/**
 * Formats a price in Toman with Persian digits and separator
 */
export function formatToman(value: number): string {
  return `${toPersianDigits(formatNumber(value))}`
}

/**
 * Formats square meter value (e.g. 35.2 -> ۳۵.۲)
 */
export function formatSquareMeters(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return toPersianDigits(rounded.toFixed(rounded % 1 === 0 ? 0 : 2))
}

export function formatUnit(rawUnit?: string | null): string {
  if (!rawUnit) return 'عدد'
  const mapping: Record<string, string> = {
    bag: 'کیسه',
    bucket: 'سطل',
    pack: 'بسته',
    can: 'قوطی',
    branch: 'شاخه',
    piece: 'عدد',
    box: 'کارتن',
    roll: 'رول',
    kg: 'کیلوگرم',
    liter: 'لیتر',
    m2: 'مترمربع',
    meter: 'متر',
    m: 'متر',
    cm: 'سانتی‌متر',
    'سانتی متر': 'سانتی‌متر',
    // prettier-ignore
    "سانتی‌متر": "سانتی‌متر",
    g: 'گرم',
    gram: 'گرم',
    گرم: 'گرم',
    کیلوگرم: 'کیلوگرم',
    متر: 'متر',
  }
  return mapping[rawUnit] || rawUnit
}
