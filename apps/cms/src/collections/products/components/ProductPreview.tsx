'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { calculateBasePricePerCarton } from '../_inventory-math'

export const ProductPreview: React.FC = () => {
  const priceField = useFormFields(([fields]) => fields.basePricePerSqm)
  const sqmField = useFormFields(([fields]) => fields.sqmPerCarton)
  const typeField = useFormFields(([fields]) => fields.productType)
  const unitField = useFormFields(([fields]) => fields.unit)
  const weightField = useFormFields(([fields]) => fields.weight)

  const isOther = typeField?.value === 'other'
  const price = typeof priceField?.value === 'number' ? priceField.value : Number(priceField?.value ?? 0)

  if (isOther) {
    const unitLabels: Record<string, string> = {
      bag: 'کیسه',
      bucket: 'سطل / گالن',
      pack: 'بسته',
      can: 'قوطی / کارتریج',
      branch: 'شاخه',
      piece: 'عدد / دستگاه',
      box: 'کارتن / جعبه',
      roll: 'رول / طاقه',
      kg: 'کیلوگرم',
      liter: 'لیتر',
    }
    const unitName = unitLabels[String(unitField?.value)] || 'واحد'
    const weight = Number(weightField?.value)

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
          📦 پیش‌نمایش اطلاعات کالای غیر کاشی:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <span style={{ color: 'var(--theme-elevation-600)' }}>قیمت هر {unitName}: </span>
            <strong style={{ color: 'var(--theme-elevation-900)' }}>{price.toLocaleString('fa-IR')} تومان</strong>
          </div>
<div><a href="/admin/collections/warehouse-stock">مدیریت موجودی به تفکیک انبار</a></div>
          {Number.isFinite(weight) && weight > 0 && (
            <div>
              <span style={{ color: 'var(--theme-elevation-600)' }}>وزن / مقدار هر واحد: </span>
              <strong style={{ color: 'var(--theme-elevation-900)' }}>{unitName} {weight.toLocaleString('fa-IR')}</strong>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Tile preview
  const sqm = typeof sqmField?.value === 'number' ? sqmField.value : Number(sqmField?.value ?? 0)
  const isValidInputs = Number.isFinite(price) && price >= 0 && Number.isFinite(sqm) && sqm > 0

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
        ⚠️ مقادیر قیمت یا ضریب کارتن هنوز کامل یا معتبر نیستند.
      </div>
    )
  }

  const pricePerCarton = calculateBasePricePerCarton(price, sqm)

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
        پیش‌نمایش قیمت بسته‌بندی:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>

        <div>
          <span style={{ color: 'var(--theme-elevation-600)' }}>قیمت پایه هر کارتن: </span>
          <strong style={{ color: 'var(--theme-elevation-900)' }}>{pricePerCarton.toLocaleString('fa-IR')} تومان</strong>
        </div>

      </div>
      <a href="/admin/collections/warehouse-stock">مدیریت موجودی به تفکیک انبار</a>
      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--theme-elevation-500)' }}>
        * این پیش‌نمایش فقط در پنل مدیریت است و قیمت نهایی مشتری بر اساس ضریب رده مشتری محاسبه می‌شود.
      </div>
    </div>
  )
}

export default ProductPreview
