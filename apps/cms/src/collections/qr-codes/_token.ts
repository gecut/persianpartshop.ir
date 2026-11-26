import { randomInt } from 'node:crypto'

export const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const TOKEN_LENGTH = 8
const TOKEN_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/

export function generateToken(random: (max: number) => number = (max) => randomInt(max)): string {
  let token = ''
  for (let i = 0; i < TOKEN_LENGTH; i++) token += TOKEN_ALPHABET[random(TOKEN_ALPHABET.length)] ?? 'A'
  return token
}

export function normalizeToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const token = raw.trim().toUpperCase()
  return TOKEN_PATTERN.test(token) ? token : null
}
