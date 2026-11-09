export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export const toEnglishDigits = (raw: string | undefined): string => {
  if (!raw) return "";
  let str = String(raw);
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(PERSIAN_DIGITS[i], String(i)).replaceAll(ARABIC_DIGITS[i], String(i));
  }
  return str.replace(/\D/g, "");
};

export const toPersianDigits = (raw: string | undefined): string => {
  if (!raw) return "";
  return String(raw).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
};

export const digitsOf = (raw: string | undefined) => toEnglishDigits(raw);
export const toSlots = (raw: string | undefined, n: number) => {
  const d = digitsOf(raw).slice(0, n);
  return Array.from({ length: n }, (_, i) => d[i] ?? "");
};
export const firstEmptyOf = (slots: string[]) => {
  const i = slots.indexOf("");
  return i === -1 ? slots.length - 1 : i;
};
export const isFull = (slots: string[]) => slots.every(Boolean);
