'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Select: Base UI Select. Trigger is our control surface; the list is a popup with a gliding highlight.
// options: [{ value, label }]. Typing jumps to an option, arrows move, Enter picks (all Base UI).
import type { ComponentProps, ReactNode } from 'react'
import { Select as BaseSelect } from '@base-ui/react/select'
import { CaretDown, Check } from './icons'
import OptionHighlight from './lib/OptionHighlight'
import PopupScroll from './lib/PopupScroll'

type Option = { value: string; label: ReactNode }
type SelectProps = Omit<ComponentProps<typeof BaseSelect.Root<string>>, 'items' | 'children'> & {
  options: Option[]
  placeholder?: string
  label?: ReactNode
  /** Name for screen readers when there's no visible label */
  'aria-label'?: string
}

export default function Select({ options, placeholder = 'Select…', label, 'aria-label': ariaLabel, ...props }: SelectProps) {
  return (
    <BaseSelect.Root items={options} {...props}>
      {label && <BaseSelect.Label className="sc-ui-field-label">{label}</BaseSelect.Label>}
      <BaseSelect.Trigger className="sc-ui-control sc-ui-select-trigger" aria-label={ariaLabel}>
        <BaseSelect.Value className="sc-ui-select-value" placeholder={placeholder} />
        <BaseSelect.Icon className="sc-ui-select-icon">
          <CaretDown size={12} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="sc-ui-positioner" sideOffset={4} alignItemWithTrigger={false}>
          <BaseSelect.Popup className="sc-ui-popup sc-ui-popup-list">
            <PopupScroll>
            <OptionHighlight />
            <BaseSelect.List className="sc-ui-list">
              {options.map((o) => (
                <BaseSelect.Item key={o.value} value={o.value} className="sc-ui-item">
                  <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="sc-ui-item-end">
                    <Check size={12} />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </PopupScroll>
</BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
