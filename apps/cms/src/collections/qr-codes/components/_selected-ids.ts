export function selectedIds(selected: ReadonlyMap<string | number, boolean>): number[] {
  const ids = new Set<number>()
  for (const [key, isSelected] of selected) {
    const id = Number(key)
    if (isSelected && Number.isInteger(id) && id > 0) ids.add(id)
  }
  return [...ids]
}
