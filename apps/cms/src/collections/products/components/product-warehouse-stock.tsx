'use client'
import { useConfig, useDocumentInfo } from '@payloadcms/ui'
import { WarehouseBalances } from './product-warehouse-stock/_warehouse-balances'

export function ProductWarehouseStock() {
  const { id } = useDocumentInfo()
  const { config } = useConfig()
  const url = id == null ? null : `${config.routes.api}/warehouse-stock/for-product/${id}`
  return url ? <WarehouseBalances key={url} url={url} /> : <p>برای مدیریت موجودی، ابتدا محصول را ذخیره کنید.</p>
}
