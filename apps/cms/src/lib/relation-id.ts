/** Normalizes a single relationship value (id, populated `{ id }`, or empty) to a positive integer id. */
export function relationId(value: unknown): number | null {
  const raw = value !== null && typeof value === 'object' && 'id' in value ? value.id : value
  const id = typeof raw === 'string' && raw.trim() ? Number(raw) : raw
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null
}
