'use client'
import { useState } from 'react'
import { Button, Dropdown, Label, cn } from '@heroui/react'
import { AltArrowDownIcon } from '@solar-icons/react/linear'

type FilterSelectProps = {
  label: string
  selected: string[]
  options: { id: string; label: string }[]
  onChange: (ids: string[]) => void
  multiple?: boolean
}
export function FilterSelect({
  label,
  selected,
  options,
  onChange,
  multiple = false,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const text =
    options
      .filter((option) => selected.includes(option.id))
      .map((option) => option.label)
      .join('، ') || (multiple ? 'همه' : options[0]?.label)
  return (
    <div className="space-y-1 text-start">
      <label className="text-xs font-bold text-foreground block">{label}</label>
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <Button
          variant="secondary"
          aria-label={label}
          className="w-full justify-between h-14 px-3.5 rounded-2xl bg-muted/5 text-foreground font-semibold text-xs flex items-center cursor-pointer hover:bg-muted/10 transition-colors"
        >
          <span className="truncate">{text}</span>
          <AltArrowDownIcon
            size={16}
            className={cn(
              'text-muted transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </Button>
        <Dropdown.Popover
          dir="rtl"
          placement="bottom"
          shouldFlip={false}
          className="w-[var(--trigger-width)] text-start max-h-56 overflow-y-auto scrollbar-none rounded-2xl p-1.5 bg-surface z-60 border border-border/20"
        >
          <Dropdown.Menu
            dir="rtl"
            aria-label={label}
            selectionMode={multiple ? 'multiple' : 'single'}
            selectedKeys={new Set(selected)}
            onSelectionChange={(keys) => {
              if (keys === 'all') return
              onChange(Array.from(keys, String))
              if (!multiple) setOpen(false)
            }}
          >
            {options.map((option) => (
              <Dropdown.Item
                key={option.id}
                id={option.id}
                textValue={option.label}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-start text-start w-full',
                  selected.includes(option.id)
                    ? 'bg-primary/15 text-primary'
                    : 'hover:bg-default/20',
                )}
              >
                <Label className="cursor-pointer text-start w-full">
                  {option.label}
                </Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  )
}
