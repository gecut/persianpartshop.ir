import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { call } from '@orpc/server'

let userStatus = 'active'
let mockFetchResponse: { ok: boolean; status: number; json: () => Promise<unknown> }

mock.module('../payload', () => ({
  sdk: {
    findByID: async () => ({
      id: 1,
      status: userStatus,
    }),
  },
}))

// Mock global fetch
const originalFetch = globalThis.fetch
globalThis.fetch = mock(async (url: string | URL | Request) => {
  return mockFetchResponse as unknown as Response
}) as unknown as typeof fetch

const { activityFeed } = await import('./activity-feed')
const context = { user: { id: 1, role: 'customer' }, jwtPayload: null, req: new Request('http://fixture.test') }

describe('activityFeed.list', () => {
  beforeEach(() => {
    userStatus = 'active'
    mockFetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            kind: 'order',
            id: 101,
            orderNumber: 'ORD-101',
            status: 'pending',
            statusLabel: 'در انتظار تایید',
            createdAt: '2026-11-08T10:00:00Z',
            totalAmount: 500000,
            itemCount: 2,
            quantitySummary: '2 قلم کالا',
            productImages: [],
            canReorder: true,
          },
          {
            kind: 'supply',
            id: 202,
            requestNumber: 'SPR-202',
            status: 'new',
            statusLabel: 'جدید',
            createdAt: '2026-11-08T09:00:00Z',
            estimatedTotal: 300000,
            productName: 'کاشی پرسلان',
            productImage: null,
            requestedQuantity: 100,
            roundedQuantity: 100.8,
            unit: 'مترمربع',
            packageCount: 70,
            cartonsPerPallet: 30,
            responseDueAt: '2026-11-09T09:00:00Z',
            canCancel: true,
            isOverdue: false,
          },
        ],
        nextCursor: 'cursor_123',
        hasMore: true,
      }),
    }
  })

  test('successfully fetches activity feed for active customer', async () => {
    const result = await call(activityFeed.list, { filter: 'all', limit: 20 }, { context })
    expect(result.items).toHaveLength(2)
    expect(result.items[0]?.kind).toBe('order')
    expect(result.items[1]?.kind).toBe('supply')
    expect(result.nextCursor).toBe('cursor_123')
    expect(result.hasMore).toBe(true)
  })

  test('rejects inactive user with FORBIDDEN', async () => {
    userStatus = 'inactive'
    await expect(call(activityFeed.list, { filter: 'all', limit: 20 }, { context })).rejects.toThrow()
  })

  test('rejects unauthenticated user', async () => {
    await expect(call(activityFeed.list, { filter: 'all', limit: 20 }, { context: { ...context, user: null } })).rejects.toThrow()
  })

  test('handles upstream CMS failure gracefully', async () => {
    mockFetchResponse = {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Database error' }),
    }
    await expect(call(activityFeed.list, { filter: 'all', limit: 20 }, { context })).rejects.toThrow()
  })
})
