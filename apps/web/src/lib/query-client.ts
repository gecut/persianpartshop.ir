import { writeActivity } from './write-activity'
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'

let onAuthError: ((error: unknown) => void) | null = null

export function setQueryAuthErrorHandler(fn: (error: unknown) => void) {
  onAuthError = fn
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => onAuthError?.(err),
  }),
  mutationCache: new MutationCache({
    onError: (err) => onAuthError?.(err),
  }),
  defaultOptions: {
    mutations: { networkMode: 'always', retry: false },
    queries: {
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      retry: (count, error) => {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null
        return count < 1 && !(error instanceof DOMException && error.name === 'AbortError') && (!code || ['SERVICE_UNAVAILABLE', 'INTERNAL_SERVER_ERROR', 'BAD_GATEWAY', 'GATEWAY_TIMEOUT'].includes(String(code)))
      },
      refetchOnWindowFocus: true,
    },
  },
})

queryClient.getMutationCache().subscribe(() => writeActivity.setMutationCount(queryClient.isMutating()))

/**
 * Completely clears all TanStack Query cache (queries and mutations)
 */
export function clearTanStackCache() {
  void queryClient.cancelQueries()
  queryClient.clear()
}
