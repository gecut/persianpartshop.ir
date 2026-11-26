export const TATWEEL = 'ـ'
// Letters that join to the NEXT letter (dual-joining).
const DUAL_JOIN = new Set([...'بپتثجچحخسشصضطظعغفقکگلمنهیئ'])
const isArabicLetter = (ch: string | undefined) => !!ch && /[ء-يٱ-ۓ]/.test(ch)

/**
 * Inserts at most one tatweel per word per round (mid-word first, longest words first) until the
 * measured width reaches `targetUnits`. `measure` returns the ink width of a string.
 */
export function justifyKashida(text: string, targetUnits: number, measure: (text: string) => number, tolerance = 40): string {
  const words = text.split(' ')
  const candidates = words.map((word) => {
    const positions: number[] = []
    for (let i = 0; i < word.length - 1; i++) {
      if (DUAL_JOIN.has(word[i] ?? '') && isArabicLetter(word[i + 1]) && word[i + 1] !== TATWEEL) positions.push(i + 1)
    }
    return positions.sort((a, b) => Math.abs(a - word.length / 2) - Math.abs(b - word.length / 2))
  })
  const adds: number[][] = words.map(() => [])
  const build = () =>
    words
      .map((word, wi) => {
        let out = ''
        for (let i = 0; i < word.length; i++) {
          out += word[i]
          out += TATWEEL.repeat((adds[wi] ?? []).filter((position) => position === i + 1).length)
        }
        return out
      })
      .join(' ')
  const order = [...words.keys()].sort((a, b) => (words[b]?.length ?? 0) - (words[a]?.length ?? 0))
  let best = text
  for (let round = 0; round < 6; round++) {
    for (const wi of order) {
      const options = candidates[wi] ?? []
      if (!options.length) continue
      const position = options[round % options.length]
      if (position === undefined) continue
      adds[wi]?.push(position)
      const next = build()
      if (measure(next) > targetUnits + tolerance) {
        adds[wi]?.pop()
        return best
      }
      best = next
    }
  }
  return best
}
