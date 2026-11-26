import { generateToken } from './_token'

/** `findExisting` returns the subset of `candidates` that already exist in the database. */
export async function pickFreshTokens(
  count: number,
  findExisting: (candidates: string[]) => Promise<Set<string>>,
): Promise<string[]> {
  const fresh = new Set<string>()
  for (let round = 0; round < 5 && fresh.size < count; round++) {
    const candidates = new Set<string>()
    while (candidates.size < count - fresh.size) {
      const token = generateToken()
      if (!fresh.has(token)) candidates.add(token)
    }
    const taken = await findExisting([...candidates])
    for (const token of candidates) if (!taken.has(token)) fresh.add(token)
  }
  if (fresh.size < count) throw new Error('تولید توکن یکتا ممکن نشد؛ دوباره تلاش کنید.')
  return [...fresh]
}
