import { relationId } from '../../lib/relation-id'

export function familyChange(previous: unknown, next: unknown): string | null {
  const prevId = relationId(previous)
  const nextId = relationId(next)
  if (prevId === nextId) return null
  const display = (id: number | null) => (id == null ? '-' : id.toLocaleString('fa-IR'))
  return `طرح: ${display(prevId)} -> ${display(nextId)}`
}
