'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { calculateBasePricePerCarton, calculateStockCartons } from '../_inventory-math'

export const ProductPreview: React.FC = () => {
  const priceField = useFormFields(([fields]) => fields.basePricePerSqm)
  const sqmField = useFormFields(([fields]) => fields.sqmPerCarton)
  const invField = useFormFields(([fields]) => fields.inventorySqm)

  const price = typeof priceField?.value === 'number' ? priceField.value : Number(priceField?.value ?? 0)
  const sqm = typeof sqmField?.value === 'number' ? sqmField.value : Number(sqmField?.value ?? 0)
  const inv = typeof invField?.value === 'number' ? invField.value : Number(invField?.value ?? 0)

  const isValidInputs = Number.isFinite(price) && price >= 0 && Number.isFinite(sqm) && sqm > 0 && Number.isFinite(inv) && inv >= 0

  if (!isValidInputs) {
    return (
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'var(--theme-elevation-50)',
        borderRadius: '6px',
        border: '1px dashed var(--theme-elevation-200)',
        marginBottom: '16px',
        fontSize: '13px',
        color: 'var(--theme-elevation-600)',
      }}>
        ⚠️ مقادیر قیمت، ضریب کارتن یا متراژ هنوز کامل یا معتبر نیستند.
      </div>
    )
  }

  const cartons = calculateStockCartons(inv, sqm)
  const pricePerCarton = calculateBasePricePerCarton(price, sqm)
  const remainderSqm = Math.max(0, Math.round((inv - cartons * sqm) * 100) / 100)

  return (
    <div style={{
      padding: '14px 18px',
      backgroundColor: 'var(--theme-elevation-100)',
      borderRadius: '8px',
      border: '1px solid var(--theme-elevation-250)',
      marginBottom: '16px',
      fontSize: '13px',
      lineHeight: '1.6',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--theme-elevation-900)' }}>
        📊 پیش‌نمایش محاسباتی مقادیر:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div>
          <span style={{ color: 'var(--theme-elevation-600)' }}>موجودی کارتن کامل: </span>
          <strong style={{ color: 'var(--theme-elevation-900)' }}>{cartons.toLocaleString('fa-IR')} کارتن</strong>
        </div>
        <div>
          <span style={{ color: 'var(--theme-elevation-600)' }}>قیمت پایه هر کارتن: </span>
          <strong style={{ color: 'var(--theme-elevation-900)' }}>{pricePerCarton.toLocaleString('fa-IR')} تومان</strong>
        </div>
        <div>
          <span style={{ color: 'var(--theme-elevation-600)' }}>باقی‌مانده خارج از کارتن: </span>
          <strong style={{ color: 'var(--theme-elevation-900)' }}>{remainderSqm.toLocaleString('fa-IR')} م²</strong>
        </div>
      </div>
      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--theme-elevation-500)' }}>
        * این پیش‌نمایش فقط در پنل مدیریت است و قیمت نهایی مشتری بر اساس ضریب رده مشتری محاسبه می‌شود.
      </div>
    </div>
  )
}

export default ProductPreview
