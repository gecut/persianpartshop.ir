import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { toast } from '../../components/feedback/toast'
import { supplyDraftStore } from './supply-request-draft'

interface Submission {
  owner: string
  productId: number
  warehouseId: number
  requestedQuantity: number
  notes: string
  idempotencyKey: string
}

export function useSupplySubmission(onSuccess: (id: number) => void, onRejected?: (code: string) => void) {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (submitted: Submission) => api.supplyRequest.submit({ productId: submitted.productId, warehouseId: submitted.warehouseId, requestedQuantity: submitted.requestedQuantity, notes: submitted.notes, idempotencyKey: submitted.idempotencyKey }),
    onSuccess: (result, submitted) => {
      const current = supplyDraftStore.getSnapshot()
      if (current.owner !== submitted.owner || current.draft?.submissionKey !== submitted.idempotencyKey) return
      supplyDraftStore.clearIfCurrent(submitted.owner, submitted.idempotencyKey)
      void client.invalidateQueries({ queryKey: queryKeys.supplyRequests.all })
      toast.success('درخواست تأمین ثبت شد', `شماره پیگیری: ${result.requestNumber}`)
      onSuccess(result.id)
    },
    onError: (error, submitted) => {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : ''
      // These errors are returned only after the server checked for a successful replay.
      if (code === 'EXACT_STOCK_AVAILABLE' || code === 'SOURCE_UNAVAILABLE') {
        supplyDraftStore.clearPending(submitted.owner, submitted.idempotencyKey)
        onRejected?.(code)
      }
    },
  })
  const submit = () => {
    const { owner, draft, persisted } = supplyDraftStore.getSnapshot()
    if (!owner || !draft?.warehouseId || !persisted || mutation.isPending) return
    const submitted = { owner, productId: draft.productId, warehouseId: draft.warehouseId, requestedQuantity: draft.requestedQuantity, notes: draft.notes, idempotencyKey: draft.submissionKey }
    if (supplyDraftStore.markPending(owner, draft.submissionKey)) mutation.mutate(submitted)
  }
  return { ...mutation, submit }
}
