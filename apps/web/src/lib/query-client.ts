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
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Completely clears all TanStack Query cache (queries and mutations)
 */
export function clearTanStackCache() {
  queryClient.clear()
}
