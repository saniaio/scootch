'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Switch: Base UI Switch in two styles.
//   switch    – a track and thumb in a row with its label. Fluid's feel: the thumb stretches into a pill on
//               hover, and on press gets wider and flatter, always growing towards the centre.
//   bar       – DialKit's: the label on the left of a filled row, "Off | On" on the right with a sliding pill.
// Size follows the system density (Compact to Spacious); pass `size` to force one.
import type { ComponentProps, ReactNode } from 'react'
import { Switch as BaseSwitch } from '@base-ui/react/switch'

type SwitchProps = Omit<ComponentProps<typeof BaseSwitch.Root>, 'className'> & {
  label?: ReactNode
  variant?: 'switch' | 'bar'
  size?: 'compact' | 'regular' | 'comfortable' | 'spacious'
  offLabel?: string
  onLabel?: string
}

export default function Switch({
  label,
  variant = 'switch',
  size,
  offLabel = 'Off',
  onLabel = 'On',
  disabled,
  ...props
}: SwitchProps) {
  if (variant === 'bar') {
    return (
      <label className="sc-ui-seg-row" data-size={size} data-disabled={disabled || undefined}>
        <span className="sc-ui-seg-row-label">{label}</span>
        <BaseSwitch.Root className="sc-ui-seg sc-ui-focus" disabled={disabled} {...props}>
          <BaseSwitch.Thumb className="sc-ui-seg-pill" />
          <span className="sc-ui-seg-option" data-side="off">
            {offLabel}
          </span>
          <span className="sc-ui-seg-option" data-side="on">
            {onLabel}
          </span>
        </BaseSwitch.Root>
      </label>
    )
  }
  return (
    <label className="sc-ui-choice" data-disabled={disabled || undefined}>
      <BaseSwitch.Root className="sc-ui-switch sc-ui-focus" disabled={disabled} {...props}>
        <BaseSwitch.Thumb className="sc-ui-switch-thumb" />
      </BaseSwitch.Root>
      {label}
    </label>
  )
}
