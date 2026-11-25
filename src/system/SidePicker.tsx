'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Side picker: which sides of a box something applies to (a border, say). Built like the anchor grid (its
// cells, gaps and hover): the four edges as lines around a square for all of them, the corners left empty.
// The picked cell is black, the rest grey. Clicking the picked side again goes back to all.
// empty: there's nothing on any side yet (no border), so every cell is grey; picking one still works.
import type { ReactNode } from 'react'

export type BorderSide = 'all' | 'top' | 'right' | 'bottom' | 'left'

const LINES: Record<BorderSide, ReactNode> = {
  top: <path d="M5 5h14" />,
  right: <path d="M19 5v14" />,
  bottom: <path d="M5 19h14" />,
  left: <path d="M5 5v14" />,
  all: <rect width="14" height="14" x="5" y="5" rx="2" />,
}
const CELLS: (BorderSide | null)[] = [null, 'top', null, 'left', 'all', 'right', null, 'bottom', null]

export default function SidePicker({ value, onValueChange, label = 'Sides', empty = false }: { value: BorderSide; onValueChange: (side: BorderSide) => void; label?: string; empty?: boolean }) {
  return (
    <div className="sc-ui-anchor sc-ui-sides" role="group" aria-label={label}>
      {CELLS.map((side, i) =>
        side ? (
          <button
            key={side}
            type="button"
            className="sc-ui-anchor-cell sc-ui-side-cell sc-ui-focus"
            data-active={(!empty && value === side) || undefined}
            aria-pressed={!empty && value === side}
            aria-label={side === 'all' ? 'All sides' : `${side[0].toUpperCase()}${side.slice(1)}`}
            onClick={() => onValueChange(side !== 'all' && value === side ? 'all' : side)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {LINES[side]}
            </svg>
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  )
}
