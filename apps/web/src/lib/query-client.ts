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
      staleTime: 60 * 1000,
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
