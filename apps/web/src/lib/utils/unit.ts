import { toPersianDigits } from './currency'

export function formatUnit(rawUnit?: string | null): string {
  if (!rawUnit) return "عدد";
  const mapping: Record<string, string> = {
    bag: "کیسه",
    bucket: "سطل",
    pack: "بسته",
    can: "قوطی",
    branch: "شاخه",
    piece: "عدد",
    box: "کارتن",
    roll: "رول",
    kg: "کیلوگرم",
    liter: "لیتر",
    m2: "مترمربع",
    meter: "متر",
    m: "متر",
    cm: "سانتی‌متر",
    "سانتی متر": "سانتی‌متر",
    "سانتی‌متر": "سانتی‌متر",
    g: "گرم",
    gram: "گرم",
    گرم: "گرم",
    کیلوگرم: "کیلوگرم",
    متر: "متر",
  };
  return mapping[rawUnit] || rawUnit;
}

export function summarizeQuantities(items: Array<{ unit: string; quantity: number }>): string {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(item.unit, (totals.get(item.unit) ?? 0) + item.quantity)
  return [...totals].map(([unit, quantity]) => `${toPersianDigits(Math.round(quantity * 100) / 100)} ${formatUnit(unit)}`).join('، ')
}

export function formatCartons(count: number, cartonsPerPallet?: number | null): string {
  if (!Number.isSafeInteger(count) || count < 0) return ''
  if (!Number.isSafeInteger(cartonsPerPallet) || !cartonsPerPallet || cartonsPerPallet < 1) return `${toPersianDigits(count)} کارتن`
  const pallets = Math.floor(count / cartonsPerPallet)
  const cartons = count % cartonsPerPallet
  if (!pallets) return `${toPersianDigits(count)} کارتن`
  return `${toPersianDigits(pallets)} پالت${cartons ? ` و ${toPersianDigits(cartons)} کارتن` : ''}`
}
