// Persian digits and currency formatting utilities



const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/**
 * Converts English digits in a string or number to Persian digits
 */
export function toPersianDigits(value: string | number): string {
  if (value === null || value === undefined) return ''
  return value
    .toString()
    .replace(/[0-9]/g, (char) => PERSIAN_DIGITS[parseInt(char, 10)] ?? char)
}

/**
 * Formats a number with comma thousand separators
 */
export function formatNumber(value: number): string {
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
