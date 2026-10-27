'use client'

import { useEffect } from 'react'

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']

export function toPersianDigits(str: string | number): string {
  if (str === null || str === undefined) return ''
  return String(str).replace(/[0-9]/g, (w) => PERSIAN_DIGITS[+w])
}

export function toEnglishDigits(str: string): string {
  if (!str) return ''
  let result = str
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(PERSIAN_DIGITS[i], String(i))
    result = result.replaceAll(ARABIC_DIGITS[i], String(i))
  }
  return result
}

export default function AdminEnhancements() {
  useEffect(() => {
    // Intercept input / paste events to normalize Persian keyboard input for number fields
    const handleBeforeInput = (e: InputEvent) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null
      if (!target) return

      if (target.type === 'number' && e.data) {
        const hasEasternDigits = /[۰-۹٠-٩]/.test(e.data)
        if (hasEasternDigits) {
          e.preventDefault()
          const ascii = toEnglishDigits(e.data)
          const start = target.selectionStart ?? target.value.length
          const end = target.selectionEnd ?? target.value.length
          const val = target.value
          const newVal = val.slice(0, start) + ascii + val.slice(end)
          target.value = newVal
          target.setSelectionRange(start + ascii.length, start + ascii.length)
          target.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null
      if (!target) return

      if (target.type === 'number') {
        const text = e.clipboardData?.getData('text')
        if (text && /[۰-۹٠-٩]/.test(text)) {
          e.preventDefault()
          const ascii = toEnglishDigits(text)
          const start = target.selectionStart ?? target.value.length
          const end = target.selectionEnd ?? target.value.length
          const val = target.value
          const newVal = val.slice(0, start) + ascii + val.slice(end)
          target.value = newVal
          target.setSelectionRange(start + ascii.length, start + ascii.length)
          target.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
    }

    document.addEventListener('beforeinput', handleBeforeInput as EventListener)
    document.addEventListener('paste', handlePaste)

    return () => {
      document.removeEventListener('beforeinput', handleBeforeInput as EventListener)
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

  return null
}
