import { describe, expect, test } from 'bun:test'
import { matchQuery } from '../src/lib/match-query'

describe('matchQuery helper', () => {
  test('renders pending state when isPending is true', () => {
    const rendered = matchQuery(
      { isPending: true, isError: false, error: null, data: null },
      {
        pending: () => 'PENDING_NODE',
        error: () => 'ERROR_NODE',
        empty: () => 'EMPTY_NODE',
        data: () => 'DATA_NODE',
      }
    )
    expect(rendered).toBe('PENDING_NODE')
  })

  test('renders error state when isError is true', () => {
    const customError = new Error('Network failed')
    const rendered = matchQuery(
      { isPending: false, isError: true, error: customError, data: null },
      {
        pending: () => 'PENDING_NODE',
        error: (err) => `ERROR: ${(err as Error).message}`,
        empty: () => 'EMPTY_NODE',
        data: () => 'DATA_NODE',
      }
    )
    expect(rendered).toBe('ERROR: Network failed')
  })

  test('renders empty state when data is null or undefined', () => {
    const renderedNull = matchQuery(
      { isPending: false, isError: false, error: null, data: null },
      {
        pending: () => 'PENDING',
        error: () => 'ERROR',
        empty: () => 'EMPTY_STATE',
        data: () => 'DATA',
      }
    )
    expect(renderedNull).toBe('EMPTY_STATE')

    const renderedUndefined = matchQuery(
      { isPending: false, isError: false, error: null, data: undefined },
      {
        pending: () => 'PENDING',
        error: () => 'ERROR',
        empty: () => 'EMPTY_STATE',
        data: () => 'DATA',
      }
    )
    expect(renderedUndefined).toBe('EMPTY_STATE')
  })

  test('renders empty state when data is an empty array', () => {
    const renderedEmptyArray = matchQuery(
      { isPending: false, isError: false, error: null, data: [] },
      {
        pending: () => 'PENDING',
        error: () => 'ERROR',
        empty: () => 'NO_ITEMS',
        data: (items) => `ITEMS: ${items.length}`,
      }
    )
    expect(renderedEmptyArray).toBe('NO_ITEMS')
  })

  test('renders data state when data is non-empty', () => {
    const renderedArray = matchQuery(
      { isPending: false, isError: false, error: null, data: ['tile-1', 'tile-2'] },
      {
        pending: () => 'PENDING',
        error: () => 'ERROR',
        empty: () => 'EMPTY',
        data: (items) => `COUNT: ${items.length}`,
      }
    )
    expect(renderedArray).toBe('COUNT: 2')

    const renderedObject = matchQuery(
      { isPending: false, isError: false, error: null, data: { id: 'order-10', status: 'pending' } },
      {
        pending: () => 'PENDING',
        error: () => 'ERROR',
        empty: () => 'EMPTY',
        data: (order) => `ORDER: ${order.id}`,
      }
    )
    expect(renderedObject).toBe('ORDER: order-10')
  })

  test('returns null when empty handler is omitted and data is nullish', () => {
    const rendered = matchQuery(
      { isPending: false, isError: false, error: null, data: null },
      {
        pending: () => 'PENDING',
        error: () => 'ERROR',
        data: () => 'DATA',
      }
    )
    expect(rendered).toBeNull()
  })
})
