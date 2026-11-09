import { formatTrackingNumber } from '../../lib/utils/tracking-number'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import { queryKeys } from '../../lib/query-keys'
import { toast } from '../../components/feedback/toast'
import { supplyDraftStore } from './supply-request-draft'

interface Submission {
  owner: string
  productId: number
  warehouseId?: number | null
  requestedQuantity: number
  notes: string
  idempotencyKey: string
}

export function useSupplySubmission(onSuccess: (id: number) => void, onRejected?: (code: string) => void) {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (submitted: Submission) => api.supplyRequest.submit({
      productId: submitted.productId,
      warehouseId: submitted.warehouseId ?? undefined,
      requestedQuantity: submitted.requestedQuantity,
      notes: submitted.notes,
      idempotencyKey: submitted.idempotencyKey,
    }),
    onSuccess: (result, submitted) => {
      const current = supplyDraftStore.getSnapshot()
      if (current.owner !== submitted.owner || current.draft?.submissionKey !== submitted.idempotencyKey) return
      supplyDraftStore.clearIfCurrent(submitted.owner, submitted.idempotencyKey)
      client.setQueryData(queryKeys.supplyRequests.detail(submitted.owner, result.id), result)
      void client.invalidateQueries({ queryKey: queryKeys.supplyRequests.lists(submitted.owner) })
      void client.invalidateQueries({ queryKey: queryKeys.activityFeed.all })
      toast.success('درخواست تأمین ثبت شد', `شماره پیگیری: ${formatTrackingNumber(result.requestNumber)}`)
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
  const submit = async () => {
    const { owner, draft, persisted } = supplyDraftStore.getSnapshot()
    if (!owner || !draft || !persisted || mutation.isPending) throw new Error('درخواست آمادهٔ ثبت نیست.')
    const submitted: Submission = {
      owner,
      productId: draft.productId,
      warehouseId: draft.warehouseId ?? undefined,
      requestedQuantity: draft.requestedQuantity,
      notes: draft.notes,
      idempotencyKey: draft.submissionKey,
    }
    if (!supplyDraftStore.markPending(owner, draft.submissionKey)) throw new Error('ذخیرهٔ پیش‌نویس ممکن نیست.')
    return mutation.mutateAsync(submitted)
  }
  return { ...mutation, submit }
}
