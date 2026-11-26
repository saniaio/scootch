'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Slider: Base UI Slider (keyboard, screen readers, range) in three styles.
//   bar   – DialKit's, all of it (markers, handle, spring, stretch, type-to-edit): see lib/BarSlider.
//           Size follows the system density; pass size to force compact (28px), regular (32px), comfortable (36px) or spacious (40px).
//   track – Toolcraft's: label + value above a thin line with a small square thumb (forms, inspectors)
//   pill  – Fluid's: label inline, a rounded track with a round thumb (settings, compact rows)
import type { ComponentProps } from 'react'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import BarSlider from './lib/BarSlider'

export type SliderVariant = 'bar' | 'track' | 'pill'

type SliderProps = Omit<ComponentProps<typeof BaseSlider.Root>, 'className'> & {
  variant?: SliderVariant
  size?: 'compact' | 'regular' | 'comfortable' | 'spacious'
  label?: string
  unit?: string
  format?: (value: number) => string | number
}

export default function Slider({ variant = 'bar', size, label, unit = '', format: formatProp, ...props }: SliderProps) {
  const format = formatProp ?? ((v: number) => v)
  // Single-value bar: DialKit's full behaviour
  const single = !Array.isArray(props.value ?? props.defaultValue)
  if (variant === 'bar' && single) {
    return (
      <BarSlider
        label={label}
        unit={unit}
        format={formatProp}
        size={size}
        value={props.value as number | undefined}
        defaultValue={props.defaultValue as number | undefined}
        onValueChange={(v) => props.onValueChange?.(v, undefined as never)}
        min={props.min}
        max={props.max}
        step={props.step}
        disabled={props.disabled}
      />
    )
  }

  const value = (
    <BaseSlider.Value className="sc-ui-slider-value">
      {(_, values) => values.map((v) => `${format(v)}${unit}`).join(' – ')}
    </BaseSlider.Value>
  )
  const thumbs = (count: number) =>
    Array.from({ length: count }, (_, i) => (
      <BaseSlider.Thumb key={i} index={i} className="sc-ui-slider-thumb" aria-label={count > 1 ? `${label} ${i === 0 ? 'start' : 'end'}` : label} />
    ))
  const initial = props.value ?? props.defaultValue
  const count = Array.isArray(initial) ? initial.length : 1

  if (variant === 'track') {
    return (
      <BaseSlider.Root className="sc-ui-slider" data-variant="track" {...props}>
        <div className="sc-ui-slider-head">
          <span className="sc-ui-slider-label">{label}</span>
          {value}
        </div>
        <BaseSlider.Control className="sc-ui-slider-control">
          <BaseSlider.Track className="sc-ui-slider-track">
            <BaseSlider.Indicator className="sc-ui-slider-fill" />
            {thumbs(count)}
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
    )
  }

  if (variant === 'pill') {
    return (
      <BaseSlider.Root className="sc-ui-slider" data-variant="pill" {...props}>
        <span className="sc-ui-slider-label">
          {label}: {value}
        </span>
        <BaseSlider.Control className="sc-ui-slider-control">
          <BaseSlider.Track className="sc-ui-slider-track">
            <BaseSlider.Indicator className="sc-ui-slider-fill" />
            {thumbs(count)}
          </BaseSlider.Track>
        </BaseSlider.Control>
      </BaseSlider.Root>
    )
  }

  return (
    <BaseSlider.Root className="sc-ui-slider" data-variant="bar" data-size={size} {...props}>
      <BaseSlider.Control className="sc-ui-slider-control">
        <BaseSlider.Track className="sc-ui-slider-track">
          <BaseSlider.Indicator className="sc-ui-slider-fill" />
          {thumbs(count)}
        </BaseSlider.Track>
        <span className="sc-ui-slider-text">
          <span className="sc-ui-slider-label">{label}</span>
          {value}
        </span>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
