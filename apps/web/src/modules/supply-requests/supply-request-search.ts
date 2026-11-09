export const validateSupplyRequestSearch = (search: Record<string, unknown>): { from?: 'order' } => ({ from: search.from === 'order' ? 'order' : undefined })
