'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Segmented control: a joined row of options where exactly one is picked (Fit / Fill / Stretch).
// It picks a value; to switch which content shows, use Tabs. Base UI ToggleGroup underneath.
//   pill   – a sliding raised pill on a grey track (Fluid)
//   joined – Toolcraft's: equal-width joined cells, full width
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Toggle } from '@base-ui/react/toggle'

type SegmentedControlProps = {
  options: { value: string; label: ReactNode }[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  variant?: 'pill' | 'joined'
  /** Greyed out: shows the value but can't be changed */
  disabled?: boolean
  'aria-label'?: string
}

export default function SegmentedControl({
  options,
  value,
  defaultValue = options[0]?.value,
  onValueChange,
  variant = 'pill',
  disabled = false,
  ...props
}: SegmentedControlProps) {
  const [own, setOwn] = useState(defaultValue)
  const current = value ?? own
  const listRef = useRef<HTMLDivElement>(null)

  // Slide the pill to the picked option (the same CSS variables Base UI sets for the tabs' indicator)
  const place = () => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>('[data-pressed]')
    if (!list || !item) return
    list.style.setProperty('--active-tab-left', `${item.offsetLeft}px`)
    list.style.setProperty('--active-tab-width', `${item.offsetWidth}px`)
  }
  useLayoutEffect(place, [current, options])
  // And again whenever its size changes: measured while hidden (a folded section, a closed popup) it has
  // no width, which left the pill as a sliver at the left edge once it was shown
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(place)
    watch.observe(list)
    return () => watch.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sc-ui-tabs" data-variant={variant} data-disabled={disabled || undefined}>
      <ToggleGroup
        ref={listRef}
        disabled={disabled}
        className="sc-ui-tabs-list"
        value={current ? [current] : []}
        onValueChange={(next) => {
          // One option always stays picked: clicking the picked one again changes nothing
          const picked = next[0]
          if (picked === undefined) return
          setOwn(picked)
          onValueChange?.(picked)
        }}
        {...props}
      >
        {options.map((o) => (
          <Toggle key={o.value} value={o.value} className="sc-ui-tab sc-ui-focus">
            {o.label}
          </Toggle>
        ))}
        {variant === 'pill' && <span className="sc-ui-tabs-indicator" aria-hidden />}
      </ToggleGroup>
    </div>
  )
}
