'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Number field: Base UI NumberField. Drag the label left / right to change the value (like Webflow),
// type a number, or use the arrow keys (Shift ×10). Optional unit (px, %, °).
import type { ReactNode } from 'react'
import { NumberField as BaseNumber } from '@base-ui/react/number-field'

type NumberFieldProps = {
  label: ReactNode
  value?: number | null
  defaultValue?: number
  onValueChange?: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  /** Name for screen readers when the visible label is an icon or empty */
  'aria-label'?: string
}

export default function NumberField({ label, unit, step = 1, 'aria-label': ariaLabel, ...props }: NumberFieldProps) {
  return (
    <BaseNumber.Root className="sc-ui-number" step={step} largeStep={step * 10} {...props}>
      <div className="sc-ui-control sc-ui-number-group">
        <BaseNumber.ScrubArea className="sc-ui-number-scrub" pixelSensitivity={2}>
          <span className="sc-ui-number-label">{label}</span>
          <BaseNumber.ScrubAreaCursor className="sc-ui-number-cursor">↔</BaseNumber.ScrubAreaCursor>
        </BaseNumber.ScrubArea>
        <BaseNumber.Input className="sc-ui-number-input" aria-label={ariaLabel} />
        {unit && <span className="sc-ui-number-unit">{unit}</span>}
      </div>
    </BaseNumber.Root>
  )
}
