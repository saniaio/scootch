'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Textarea: Base UI Field around a textarea that grows with its text (up to `maxRows`).
// `mono` for code (formulas, snippets): the only place text is ABC Areal Mono.
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { Field as BaseField } from '@base-ui/react/field'

type TextareaProps = Omit<ComponentProps<'textarea'>, 'className'> & {
  label?: ReactNode
  description?: ReactNode
  mono?: boolean
  minRows?: number
  maxRows?: number
  invalid?: boolean
}

export default function Textarea({ label, description, mono = false, minRows = 3, maxRows = 12, invalid, disabled, ...props }: TextareaProps) {
  return (
    <BaseField.Root className="sc-ui-field" invalid={invalid} disabled={disabled}>
      {label && <BaseField.Label className="sc-ui-field-label">{label}</BaseField.Label>}
      <BaseField.Control
        render={<textarea />}
        className="sc-ui-textarea sc-ui-focus"
        data-mono={mono || undefined}
        style={{ '--min-rows': minRows, '--max-rows': maxRows } as CSSProperties}
        spellCheck={mono ? false : undefined}
        {...(props as object)}
      />
      {description && <BaseField.Description className="sc-ui-field-description">{description}</BaseField.Description>}
    </BaseField.Root>
  )
}
