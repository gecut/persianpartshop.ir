import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SupplyPreviewInputSchema } from '@persianpart/contract'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'
import { useOnline } from '@/lib/use-online'
import { useCatalogProduct } from '@/modules/catalog/catalog-data'
import { isProductAllowedForUser, useAuth } from '@/modules/auth/auth-store'
import { supplyDraftStore, useSupplyDraft } from '../supply-request-draft'
import { useSupplySubmission } from '../use-supply-submission'

type Preview = Awaited<ReturnType<typeof api.supplyRequest.preview>>

/** Draft, preview, review and submission state for one product's supply request. */
export function useSupplyRequestForm(productId: number, onSuccess: (id: number) => void) {
  const online = useOnline()
  const { user } = useAuth()
  const { owner, draft, persisted } = useSupplyDraft()
  const client = useQueryClient()
  const productQuery = useCatalogProduct(productId)
  const product = productQuery.data
  const allowed = !!product && isProductAllowedForUser(product, user) && !user?.disableOrdering && !user?.hideExactStock
  const active = allowed && !!owner && draft?.productId === productId
  const initialized = useRef('')
  useEffect(() => {
    const identity = `${owner}:${productId}`
    if (!owner || !allowed || initialized.current === identity) return
    initialized.current = identity
    if (!supplyDraftStore.getSnapshot().draft) supplyDraftStore.open(productId)
  }, [owner, productId, allowed])

  const [debounced, setDebounced] = useState(0)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(draft?.requestedQuantity ?? 0), 300); return () => window.clearTimeout(timer) }, [draft?.requestedQuantity, draft?.productId])
  const input = { productId, requestedQuantity: debounced }
  const preview = useQuery({ queryKey: queryKeys.supplyRequests.preview(owner, productId, debounced), queryFn: ({ signal }) => api.supplyRequest.preview(input, { signal }), enabled: online && active && SupplyPreviewInputSchema.safeParse(input).success, retry: false, staleTime: 0 })
  const [review, setReview] = useState<{ owner: string; key: string; data: Preview } | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState(false)
  const [exactAvailable, setExactAvailable] = useState(false)
  const mutation = useSupplySubmission(onSuccess, code => { setReview(null); setExactAvailable(code === 'EXACT_STOCK_AVAILABLE'); void preview.refetch() })
  const previousKey = useRef(draft?.submissionKey)
  const resetMutation = mutation.reset
  useEffect(() => {
    if (previousKey.current !== draft?.submissionKey) {
      previousKey.current = draft?.submissionKey
      setReview(null); setCheckError(false); setExactAvailable(false); resetMutation()
    }
  }, [draft?.submissionKey, resetMutation])

  const current = debounced === draft?.requestedQuantity && !preview.isFetching && !preview.error ? preview.data : undefined
  const reviewing = !!review && review.owner === owner && review.key === draft?.submissionKey
  const quote = online ? reviewing ? review.data.quote : current?.quote : undefined
  const valid = SupplyPreviewInputSchema.safeParse({ productId, requestedQuantity: draft?.requestedQuantity }).success
  const confirm = async () => {
    if (!online || !active || !draft || !valid || !persisted || checking) return
    const key = draft.submissionKey
    setChecking(true); setCheckError(false)
    try {
      const data = await client.fetchQuery({ queryKey: queryKeys.supplyRequests.preview(owner, productId, draft.requestedQuantity), queryFn: () => api.supplyRequest.preview({ productId, requestedQuantity: draft.requestedQuantity }), staleTime: 0, retry: false })
      const latest = supplyDraftStore.getSnapshot()
      if (latest.owner !== owner || latest.draft?.submissionKey !== key) return
      setExactAvailable(data.reason === 'exact_stock_available')
      if (data.eligible) setReview({ owner, key, data })
    } catch { setCheckError(true) } finally { setChecking(false) }
  }

  return { online, owner, draft, persisted, productQuery, product, allowed, active, preview, setReview, checking, checkError, setCheckError, exactAvailable, mutation, current, reviewing, quote, valid, confirm }
}
