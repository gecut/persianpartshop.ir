'use client'
import { FieldError, RelationshipInput } from '@payloadcms/ui'
import type { ValueWithRelation } from 'payload'
import { CatalogMediaPreview } from './_catalog-media-preview'

export interface CatalogRelationPickerProps {
  path: string
  label: string
  collection:
    'products' | 'categories' | 'brands' | 'dimensions' | 'tags' | 'media'
  values: number[]
  onChange: (values: number[]) => void
  single?: boolean
  readOnly?: boolean
  description?: string
  error?: string
}
export function CatalogRelationPicker({
  path,
  label,
  collection,
  values,
  onChange,
  single = false,
  readOnly,
  description,
  error,
}: CatalogRelationPickerProps) {
  const options = values.map((value) => ({ relationTo: collection, value }))
  const change = (selected: ValueWithRelation | ValueWithRelation[] | null) => {
    const rows = selected
      ? Array.isArray(selected)
        ? selected
        : [selected]
      : []
    onChange(
      rows
        .map((item) => Number(item.value))
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    )
  }
  const common = {
    path,
    label,
    relationTo: [collection],
    readOnly,
    description,
    allowCreate: false,
    allowEdit: false,
    isSortable: false,
    showError: !!error,
    Error: <FieldError message={error} showError={!!error} />,
  }
  return (
    <div data-catalog-field={path}>
      {single ? (
        <RelationshipInput
          {...common}
          hasMany={false}
          value={options[0] ?? null}
          onChange={change}
        />
      ) : (
        <RelationshipInput
          {...common}
          hasMany
          value={options}
          onChange={change}
        />
      )}
      {collection === 'media' && values[0] && (
        <CatalogMediaPreview id={values[0]} />
      )}
    </div>
  )
}
