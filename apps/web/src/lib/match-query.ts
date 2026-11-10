import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { match, P } from 'ts-pattern'

export interface QueryMatchHandlers<TData, TError = unknown> {
  pending: () => ReactNode
  error: (error: TError) => ReactNode
  empty?: () => ReactNode
  data: (data: NonNullable<TData>) => ReactNode
}

export function matchQuery<TData, TError = unknown>(
  query: Pick<UseQueryResult<TData, TError>, 'isPending' | 'isError' | 'error' | 'data'>,
  handlers: QueryMatchHandlers<TData, TError>
): ReactNode {
  return match({ isPending: query.isPending, isError: query.isError, data: query.data })
    .with({ isPending: true }, () => handlers.pending())
    .with({ isError: true }, () => handlers.error(query.error as TError))
    .with({ data: P.nullish }, () => (handlers.empty ? handlers.empty() : null))
    .otherwise(() => {
      const data = query.data as NonNullable<TData>
      if (Array.isArray(data) && data.length === 0 && handlers.empty) {
        return handlers.empty()
      }
      return handlers.data(data)
    })
}
