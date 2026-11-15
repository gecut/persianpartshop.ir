/*
 * Adapted from Magic UI Animated Circular Progress Bar.
 * https://magicui.design/docs/components/animated-circular-progress-bar
 *
 * MIT License
 *
 * Copyright (c) Magic UI
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { cn } from '@/lib/utils'
import { toPersianDigits } from '@/lib/utils/currency'

interface AnimatedCircularProgressBarProps {
  label: string
  percent?: number
  valueText?: string
  isEmpty?: boolean
  className?: string
}

const circumference = 2 * Math.PI * 45

export function AnimatedCircularProgressBar({ label, percent, valueText, isEmpty = false, className }: AnimatedCircularProgressBarProps) {
  const known = percent !== undefined
  const pending = !known && !isEmpty
  const remainingArc = Math.max(0, 90 - (percent ?? 0))

  return (
    <div
      role={isEmpty ? undefined : 'progressbar'}
      aria-hidden={isEmpty || undefined}
      aria-label={isEmpty ? undefined : label}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      className={cn('relative isolate grid place-items-center', className)}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        fill="none"
        viewBox="0 0 100 100"
        className={cn('size-full', pending && 'motion-safe:animate-spin motion-safe:[animation-duration:1.6s]')}
      >
        <circle
          cx="50" cy="50" r="45"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-accent/18 motion-safe:transition-[stroke-dasharray] motion-safe:duration-500"
          strokeDasharray={known ? `${remainingArc * circumference / 100} ${circumference}` : undefined}
          transform="rotate(-108 50 50) translate(0 100) scale(1 -1)"
        />
        {!isEmpty && (
          <circle
            cx="50" cy="50" r="45"
            strokeWidth="7"
            strokeLinecap="round"
            className="stroke-accent motion-safe:transition-[stroke-dasharray] motion-safe:duration-500 motion-safe:ease-out"
            strokeDasharray={`${(percent ?? 24) * circumference / 100} ${circumference}`}
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
      <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
        {known
          ? <bdi dir="rtl" className="leading-none tabular-nums">{toPersianDigits(percent)}٪</bdi>
          : <span className="text-[0.4em] font-medium text-muted">{isEmpty ? 'بدون مورد' : 'در حال انجام'}</span>}
      </span>
    </div>
  )
}
