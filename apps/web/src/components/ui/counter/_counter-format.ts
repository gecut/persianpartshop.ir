import { NUMERIC } from "./_constants";

export const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export const createFormatter = (
  locale: string,
  options?: Intl.NumberFormatOptions,
) => {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    return new Intl.NumberFormat("fa-IR", options);
  }
};

export const digitsFor = (formatter: Intl.NumberFormat, locale: string): string[] => {
  if (locale.startsWith("fa")) {
    return PERSIAN_DIGITS;
  }
  const { locale: resolvedLocale, numberingSystem } =
    formatter.resolvedOptions();
  const plain = createFormatter(resolvedLocale, {
    numberingSystem,
    useGrouping: false,
  });
  return Array.from({ length: 10 }, (_, digit) => plain.format(digit));
};

export interface SlotInfo {
  key: string;
  kind: "digit" | "symbol";
  digit: number;
  text: string;
  rank: number;
  start?: number;
}

export const slotsFor = (
  formatter: Intl.NumberFormat,
  digits: string[],
  value: number,
): SlotInfo[] => {
  const parts = formatter.formatToParts(value);
  let first = -1;
  let last = -1;
  let place = 0;
  parts.forEach((part, index) => {
    if (!NUMERIC.has(part.type)) return;
    if (first < 0) first = index;
    last = index;
    if (part.type === "integer") place += [...part.value].length;
  });
  let fraction = 0;
  const counts: Record<string, number> = {};
  const slots: SlotInfo[] = [];
  parts.forEach((part, index) => {
    if (part.type === "integer" || part.type === "fraction") {
      [...part.value].forEach((char) => {
        const digit = Math.max(0, digits.indexOf(char));
        if (part.type === "integer") {
          place -= 1;
          slots.push({
            key: `i${place}`,
            kind: "digit",
            digit,
            text: "",
            rank: -2 * place,
          });
        } else {
          slots.push({
            key: `f${fraction}`,
            kind: "digit",
            digit,
            text: "",
            rank: 1 + fraction,
          });
          fraction += 1;
        }
      });
    } else if (part.type === "group") {
      slots.push({
        key: `g${place}`,
        kind: "symbol",
        digit: 0,
        text: part.value,
        rank: 1 - 2 * place,
      });
    } else if (part.type === "decimal") {
      slots.push({
        key: "d",
        kind: "symbol",
        digit: 0,
        text: part.value,
        rank: 0.5,
      });
    } else {
      const before = first < 0 || index < first;
      const name = `${before ? "p" : "s"}-${part.type}`;
      counts[name] = (counts[name] || 0) + 1;
      slots.push({
        key: `${name}-${counts[name]}`,
        kind: "symbol",
        digit: 0,
        text: part.value,
        rank: before ? -10000 - (first - index) : 10000 + (index - last),
      });
    }
  });
  return slots;
};
