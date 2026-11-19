// Persian / Jalali (شمسی) date formatting utilities
import { toPersianDigits } from './currency'

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}

const persianDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const persianLongDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const persianDateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const persianTimelineFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Formats a date into Persian/Jalali short date string (e.g. ۱۴۰۵/۰۷/۱۸)
 */
export function formatPersianDate(
  date: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (!date) return fallback
  if (typeof date === 'string') {
    // If it's already a Persian date (e.g. starting with 14 or ۱۴)
    if (date.startsWith('۱۴') || date.startsWith('14')) {
      return toPersianDigits(date)
    }
  }
  const d = toDate(date)
  if (!d) return typeof date === 'string' ? toPersianDigits(date) : fallback
  return persianDateFormatter.format(d)
}

/**
 * Formats a date into Persian/Jalali long readable string (e.g. ۱۸ مهر ۱۴۰۵)
 */
export function formatPersianDateLong(
  date: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (!date) return fallback
  if (typeof date === 'string') {
    if (date.startsWith('۱۴') || date.startsWith('14')) {
      return toPersianDigits(date)
    }
  }
  const d = toDate(date)
  if (!d) return typeof date === 'string' ? toPersianDigits(date) : fallback
  return persianLongDateFormatter.format(d)
}

/**
 * Formats a date and time into Persian/Jalali (e.g. ۱۴۰۵/۰۷/۱۸، ۱۱:۴۵)
 */
export function formatPersianDateTime(
  date: string | number | Date | null | undefined,
  fallback = '—'
): string {
  if (!date) return fallback
  const d = toDate(date)
  if (!d) return typeof date === 'string' ? toPersianDigits(date) : fallback
  return persianDateTimeFormatter.format(d)
}

/**
 * Formats a timeline step event timestamp (e.g. مهر ۱۸، ۱۱:۴۵)
 */
export function formatPersianTimelineTs(
  date: string | number | Date | null | undefined,
  fallback = 'هم‌اکنون'
): string {
  if (!date) return fallback
  const d = toDate(date)
  if (!d) return typeof date === 'string' ? toPersianDigits(date) : fallback
  return persianTimelineFormatter.format(d)
}
