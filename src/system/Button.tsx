'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Button: Base UI Button + our tokens. One size (the system's control height, 12px sides, 13px text).
// Looks: Fluid's label that gets heavier on hover without reflow, and a small press.
//   leadingIcon / trailingIcon – text with an icon (that side's padding drops to 10px)
//   icon (no text)             – icon only: always square; give it an aria-label
import type { ComponentProps, ComponentType, ReactNode } from 'react'
import { Button as BaseButton } from '@base-ui/react/button'
import { CircleNotch } from './icons'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link'
type Icon = ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill' }>

type ButtonProps = Omit<ComponentProps<typeof BaseButton>, 'children'> & {
  variant?: ButtonVariant
  loading?: boolean
  icon?: Icon
  leadingIcon?: Icon
  trailingIcon?: Icon
  children?: ReactNode
}

export default function Button({
  variant = 'primary',
  loading = false,
  icon: IconOnly,
  leadingIcon: Leading,
  trailingIcon: Trailing,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const text = typeof children === 'string' ? children : undefined
  const iconOnly = IconOnly && children == null
  return (
    <BaseButton
      className={`sc-ui-button sc-ui-focus ${className}`}
      data-variant={variant}
      data-icon-only={iconOnly || undefined}
      data-leading={(Leading || loading) && !iconOnly ? true : undefined}
      data-trailing={Trailing && !iconOnly ? true : undefined}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      {...props}
    >
      {loading ? (
        <CircleNotch size={14} className="sc-ui-spin" aria-hidden />
      ) : iconOnly ? (
        <IconOnly size={14} />
      ) : (
        Leading && <Leading size={14} />
      )}
      {!iconOnly &&
        (text ? (
          <span className="sc-ui-button-label" data-text={text}>
            <span>{text}</span>
          </span>
        ) : (
          children
        ))}
      {Trailing && !iconOnly && <Trailing size={14} />}
    </BaseButton>
  )
}
