// Shared by the account documents UI and the offline package store.
export interface CustomerDocument {
  id?: string
  documentType?: string
  title?: string
  file?:
    | {
        id: number
        url?: string
        filename?: string
        mimeType?: string
      }
    | number
    | string
  status?: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string | null
  uploadedAt?: string
}
