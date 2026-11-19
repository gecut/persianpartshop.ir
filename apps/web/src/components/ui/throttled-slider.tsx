"use client";

import { Slider, I18nProvider } from "@heroui/react";

export interface ThrottledSliderProps {
  value: number;
  minValue: number;
  maxValue: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
}

export function ThrottledSlider({
  value,
  minValue,
  maxValue,
  step = 1,
  onChange,
  ariaLabel,
  className,
}: ThrottledSliderProps) {
  const handleChange = (val: number | number[]) => {
    const num = typeof val === "number" ? val : (val[0] ?? minValue);
    onChange(num);
  };

  return (
    <I18nProvider locale="fa-IR">
      <Slider
        minValue={minValue}
        maxValue={maxValue}
        step={step}
        value={value}
        onChange={handleChange}
        aria-label={ariaLabel}
        className={className ?? "w-full"}
      >
        <Slider.Track className="relative h-2.5 w-full rounded-full bg-muted/20 border-none">
          <Slider.Fill className="rounded-full bg-primary" />
          <Slider.Thumb className="w-5.5! h-5.5! min-w-0! rounded-full! bg-white border-2 border-primary cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary/40 outline-none" />
        </Slider.Track>
      </Slider>
    </I18nProvider>
  );
}
