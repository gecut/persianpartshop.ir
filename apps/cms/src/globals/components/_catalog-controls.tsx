'use client'
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  CheckboxInput,
  Collapsible,
  FieldDescription,
  FieldError,
  FieldLabel,
  ReactSelect,
  SelectInput,
  TextareaInput,
  TextInput,
} from '@payloadcms/ui'
import styles from './catalog-settings-field.module.css'

interface ControlProps {
  path: string
  label: string
  description?: string
  error?: string
  readOnly?: boolean
}
export function CatalogText({
  value,
  onChange,
  multiline,
  ltr,
  ...props
}: ControlProps & {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  ltr?: boolean
}) {
  const common = {
    ...props,
    showError: !!props.error,
    Error: <FieldError message={props.error} showError={!!props.error} />,
    rtl: !ltr,
  }
  return (
    <div
      data-catalog-field={props.path}
      className={ltr ? styles.ltr : undefined}
    >
      {multiline ? (
        <TextareaInput
          {...common}
          rows={3}
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            onChange(event.target.value)
          }
        />
      ) : (
        <TextInput
          {...common}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
      )}
    </div>
  )
}
export function CatalogNumber({
  value,
  onChange,
  ...props
}: ControlProps & {
  value: number | null
  onChange: (value: number | null) => void
}) {
  // Payload exposes no controlled NumberInput. Keep its field chrome and error UI.
  return (
    <div
      className={`field-type number${props.error ? ' error' : ''}`}
      data-catalog-field={props.path}
    >
      <FieldLabel htmlFor={`field-${props.path}`} label={props.label} />
      <FieldError message={props.error} showError={!!props.error} />
      <input
        id={`field-${props.path}`}
        type="number"
        step="any"
        dir="ltr"
        readOnly={props.readOnly}
        aria-invalid={!!props.error}
        aria-describedby={
          props.description ? `${props.path}-description` : undefined
        }
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : event.target.valueAsNumber,
          )
        }
      />
      <div id={`${props.path}-description`}>
        <FieldDescription path={props.path} description={props.description} />
      </div>
    </div>
  )
}
export function CatalogCheck({
  value,
  onChange,
  ...props
}: ControlProps & {
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="field-type checkbox" data-catalog-field={props.path}>
      <CheckboxInput
        label={props.label}
        id={`field-${props.path}`}
        checked={value}
        readOnly={props.readOnly}
        onToggle={(event) => onChange(event.target.checked)}
      />
      <FieldError message={props.error} showError={!!props.error} />
      <FieldDescription path={props.path} description={props.description} />
    </div>
  )
}
export function CatalogSelect<T extends string>({
  value,
  onChange,
  choices,
  multiple,
  ...props
}: ControlProps & {
  value: T | T[]
  choices: readonly (readonly [T, string])[]
  onChange: (value: T[]) => void
  multiple?: boolean
}) {
  return (
    <div data-catalog-field={props.path}>
      <SelectInput
        path={props.path}
        name={props.path}
        label={props.label}
        readOnly={props.readOnly}
        description={props.description}
        hasMany={multiple}
        isClearable={!!multiple}
        value={value}
        options={choices.map(([value, label]) => ({ value, label }))}
        showError={!!props.error}
        Error={<FieldError message={props.error} showError={!!props.error} />}
        onChange={(selected) => {
          const values = !selected
            ? []
            : Array.isArray(selected)
              ? selected
              : [selected]
          onChange(values.map((option) => String(option.value) as T))
        }}
      />
    </div>
  )
}
export function CatalogColors({
  value,
  onChange,
  ...props
}: ControlProps & {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const options = value.map((value) => ({ value, label: value }))
  return (
    <div className="field-type select" data-catalog-field={props.path}>
      <FieldLabel htmlFor={`field-${props.path}`} label={props.label} />
      <ReactSelect
        inputId={`field-${props.path}`}
        isCreatable
        isMulti
        disabled={props.readOnly}
        options={options}
        value={options}
        showError={!!props.error}
        placeholder="رنگ را بنویسید و Enter بزنید…"
        onChange={(selected) =>
          onChange(
            (Array.isArray(selected)
              ? selected
              : selected
                ? [selected]
                : []
            ).map((option) => String(option.value)),
          )
        }
      />
      <FieldError message={props.error} showError={!!props.error} />
      <FieldDescription path={props.path} description={props.description} />
    </div>
  )
}
export function CatalogSection({
  title,
  children,
  open = false,
  hasError = false,
}: {
  title: string
  children: ReactNode
  open?: boolean
  hasError?: boolean
}) {
  const [collapsed, setCollapsed] = useState(!open)
  useEffect(() => {
    if (hasError) setCollapsed(false)
  }, [hasError])
  return (
    <Collapsible
      header={title}
      isCollapsed={hasError ? false : collapsed}
      onToggle={setCollapsed}
      collapsibleStyle={hasError ? 'error' : 'default'}
    >
      <div className={styles.sectionBody}>{children}</div>
    </Collapsible>
  )
}
