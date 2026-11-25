'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Anchor grid: pick one of nine anchor points (top-left … bottom-right), e.g. a transform origin.
// It's a radio group: arrow keys move between points, and the chosen one fills.
// spread: the items spread along a row (x) or column (y), as in flex's space-between, so the whole line through
// the chosen point fills: only the other axis is still a choice.
import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type Anchor = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'
const ANCHORS: Anchor[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']

export default function AnchorGrid({ label, value, onValueChange, spread }: { label?: ReactNode; value: Anchor; onValueChange: (a: Anchor) => void; spread?: 'x' | 'y' }) {
  const at = ANCHORS.indexOf(value)
  const filled = (i: number) => (spread === 'x' ? Math.floor(i / 3) === Math.floor(at / 3) : spread === 'y' ? i % 3 === at % 3 : i === at)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (e: KeyboardEvent, i: number) => {
    const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }
    if (!(e.key in d)) return
    e.preventDefault()
    const n = i + d[e.key]
    if (n < 0 || n > 8 || (Math.abs(d[e.key]) === 1 && Math.floor(n / 3) !== Math.floor(i / 3))) return
    onValueChange(ANCHORS[n])
    refs.current[n]?.focus()
  }
  return (
    <div className="sc-ui-field">
      {label && <span className="sc-ui-field-label">{label}</span>}
      <div className="sc-ui-anchor" role="radiogroup" aria-label={typeof label === 'string' ? label : 'Anchor'}>
        {ANCHORS.map((a, i) => (
          <button
            key={a}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="radio"
            aria-checked={value === a}
            aria-label={a.replace('-', ' ')}
            tabIndex={value === a ? 0 : -1}
            className="sc-ui-anchor-cell sc-ui-focus"
            data-active={filled(i) || undefined}
            onClick={() => onValueChange(a)}
            onKeyDown={(e) => move(e, i)}
          >
            <span className="sc-ui-anchor-dot" />
          </button>
        ))}
      </div>
    </div>
  )
}
