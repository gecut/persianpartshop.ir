import { useSyncExternalStore } from 'react'

const SELECTED_STORAGE_KEY = 'persianpart_selected_products'
const QUANTITIES_STORAGE_KEY = 'persianpart_product_quantities'

export function normalizeId(id: unknown): string {
  if (id === null || id === undefined) return ''
  return String(id).replace(/["']/g, '').trim()
}

interface SelectionState {
  selectedIds: string[]
  quantities: Record<string, number>
}

let listeners: Array<() => void> = []

function getStoredState(): SelectionState {
  let selectedIds: string[] = []
  let quantities: Record<string, number> = {}

  if (typeof window !== 'undefined') {
    try {
      const rawSelected = localStorage.getItem(SELECTED_STORAGE_KEY)
      if (rawSelected) {
        const parsed = JSON.parse(rawSelected)
        if (Array.isArray(parsed)) {
          selectedIds = Array.from(new Set(parsed.map(normalizeId))).filter(Boolean)
        }
      }
    } catch {
      // Ignore JSON parse / localStorage errors
    }

    try {
      const rawQuantities = localStorage.getItem(QUANTITIES_STORAGE_KEY)
      if (rawQuantities) {
        const parsed = JSON.parse(rawQuantities)
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            const cleanKey = normalizeId(k)
            if (cleanKey && typeof v === 'number') {
              quantities[cleanKey] = v
            }
          })
        }
      }
    } catch {
      // Ignore JSON parse / localStorage errors
    }
  }

  return { selectedIds, quantities }
}

let memoryState: SelectionState = getStoredState()
let persistTimeout: ReturnType<typeof setTimeout> | null = null

function persistAndNotify(nextState: SelectionState) {
  memoryState = nextState
  // Notify UI subscribers synchronously for immediate 0ms reaction
  listeners.forEach((listener) => listener())

  // Debounce expensive localStorage disk writes so drag events never drop frames
  if (typeof window !== 'undefined') {
    if (persistTimeout) clearTimeout(persistTimeout)
    persistTimeout = setTimeout(() => {
      try {
        localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(nextState.selectedIds))
        localStorage.setItem(QUANTITIES_STORAGE_KEY, JSON.stringify(nextState.quantities))
      } catch {
        // Ignore storage quota errors
      }
    }, 150)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    try {
      localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(memoryState.selectedIds))
      localStorage.setItem(QUANTITIES_STORAGE_KEY, JSON.stringify(memoryState.quantities))
    } catch {
      // Ignore
    }
  })
}

export const selectionStore = {
  subscribe: (listener: () => void) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  },

  getSnapshot: (): SelectionState => memoryState,

  toggleProduct: (id: unknown) => {
    const cleanId = normalizeId(id)
    if (!cleanId) return

    const exists = memoryState.selectedIds.some((s) => normalizeId(s) === cleanId)
    const nextIds = exists
      ? memoryState.selectedIds.filter((s) => normalizeId(s) !== cleanId)
      : [...memoryState.selectedIds, cleanId]

    const nextQuantities = { ...memoryState.quantities }
    if (exists) {
      delete nextQuantities[cleanId]
    } else if (!nextQuantities[cleanId]) {
      nextQuantities[cleanId] = 35 // Default batch area
    }

    persistAndNotify({
      selectedIds: Array.from(new Set(nextIds)),
      quantities: nextQuantities,
    })
  },

  selectProduct: (id: unknown) => {
    const cleanId = normalizeId(id)
    if (!cleanId) return

    if (!memoryState.selectedIds.some((s) => normalizeId(s) === cleanId)) {
      const nextQuantities = { ...memoryState.quantities }
      if (!nextQuantities[cleanId]) {
        nextQuantities[cleanId] = 35
      }
      persistAndNotify({
        selectedIds: [...memoryState.selectedIds, cleanId],
        quantities: nextQuantities,
      })
    }
  },

  unselectProduct: (id: unknown) => {
    const cleanId = normalizeId(id)
    if (!cleanId) return

    const nextQuantities = { ...memoryState.quantities }
    delete nextQuantities[cleanId]

    persistAndNotify({
      selectedIds: memoryState.selectedIds.filter((s) => normalizeId(s) !== cleanId),
      quantities: nextQuantities,
    })
  },

  setQuantity: (id: unknown, qty: number) => {
    const cleanId = normalizeId(id)
    if (!cleanId) return

    const nextQuantities = {
      ...memoryState.quantities,
      [cleanId]: qty,
    }

    persistAndNotify({
      selectedIds: memoryState.selectedIds,
      quantities: nextQuantities,
    })
  },

  reconcileWithProducts: (validIds: unknown[]) => {
    const validSet = new Set(validIds.map(normalizeId).filter(Boolean))
    const current = memoryState.selectedIds.map(normalizeId).filter(Boolean)
    const nextIds = current.filter((id) => validSet.has(id))

    if (nextIds.length !== current.length) {
      const nextQuantities = { ...memoryState.quantities }
      Object.keys(nextQuantities).forEach((k) => {
        if (!validSet.has(normalizeId(k))) {
          delete nextQuantities[k]
        }
      })

      persistAndNotify({
        selectedIds: Array.from(new Set(nextIds)),
        quantities: nextQuantities,
      })
    }
  },

  setBatchSelection: (items: Array<{ id: unknown; quantity: number }>) => {
    const nextIds: string[] = []
    const nextQuantities: Record<string, number> = {}
    items.forEach((item) => {
      const cleanId = normalizeId(item.id)
      if (cleanId) {
        nextIds.push(cleanId)
        nextQuantities[cleanId] = item.quantity
      }
    })
    persistAndNotify({
      selectedIds: Array.from(new Set(nextIds)),
      quantities: nextQuantities,
    })
  },

  clearSelection: () => {
    persistAndNotify({
      selectedIds: [],
      quantities: {},
    })
  },
}

export function useProductSelection() {
  const state = useSyncExternalStore(selectionStore.subscribe, selectionStore.getSnapshot, () => ({
    selectedIds: [],
    quantities: {},
  }))

  return {
    selectedIds: state.selectedIds,
    quantities: state.quantities,
    isProductSelected: (id: unknown) => {
      const cleanId = normalizeId(id)
      return state.selectedIds.some((s) => normalizeId(s) === cleanId)
    },
    toggleProduct: selectionStore.toggleProduct,
    selectProduct: selectionStore.selectProduct,
    unselectProduct: selectionStore.unselectProduct,
    setQuantity: selectionStore.setQuantity,
    setBatchSelection: selectionStore.setBatchSelection,
    reconcileWithProducts: selectionStore.reconcileWithProducts,
    reconcileWithCatalog: selectionStore.reconcileWithProducts,
    clearSelection: selectionStore.clearSelection,
  }
}

const EMPTY_IDS: string[] = []
const EMPTY_QUANTITIES: Record<string, number> = {}

/**
 * Subscribes only to the selected product IDs. The reference is stable across
 * quantity mutations, so components that only map over the selection do not
 * re-render while a slider drags.
 */
export function useSelectedIds(): string[] {
  return useSyncExternalStore(
    selectionStore.subscribe,
    () => memoryState.selectedIds,
    () => EMPTY_IDS,
  )
}

/**
 * Subscribes to a single product's requested area. Returns a primitive so React
 * bails out of re-rendering every other product card when one changes.
 */
export function useProductQuantity(id: unknown): number | undefined {
  const cleanId = normalizeId(id)
  return useSyncExternalStore(
    selectionStore.subscribe,
    () => memoryState.quantities[cleanId],
    () => undefined,
  )
}

/**
 * Subscribes to the full quantity map. The reference changes on every mutation
 * so reserve this for consumers that must aggregate (order summary).
 */
export function useAllQuantities(): Record<string, number> {
  return useSyncExternalStore(
    selectionStore.subscribe,
    () => memoryState.quantities,
    () => EMPTY_QUANTITIES,
  )
}
