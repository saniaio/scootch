'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Spacing controls, as Scootch draws them:
//   SpaceValue   – one value: a number whose colour says where it stands on the space scale: a token (purple),
//                  typed in but equal to a token (amber), no token for it (red), nothing (grey, knocked back).
//                  Type, nudge with the arrow keys (Shift ×10), or pick a token: the token button (on hover)
//                  opens every space token with its px; the one in use is purple. Compact in a diagram, or wide in a field
//   BoxModel     – margin → padding → content, a value on each side. White with a border at rest; the box
//                  you're on (margin or padding) eases into its colour, cream or green
//   GapFields    – column and row gap, each a token field (TokenField) with its icon. Just one is a row, label left and field right
//   SpacingScrub – margin and padding as bands around and inside what it wraps, each with its number; drag a band
//                  to change it, snapped to the space scale. Alt moves the opposite side too, Shift all four;
//                  double-click a band to clear it
// Without a design system (scale={null}): no token button or token colours, every value is plain, and a drag
// scrubs through every px instead of snapping to the scale.
// The scale is ours (--space-*) unless another is passed: a list of tokens by name, for another system's own.
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import DropdownMenu from './DropdownMenu'
import TokenField from './TokenField'
import { GapHorizontal, GapVertical, SquareDot } from './icons'

export type Side = 'top' | 'right' | 'bottom' | 'left'
/** A side's value. picked: it came from a token, not typed in. token: that token's name, when it is known
 *  (it may not be one on the scale: a multiple of a base unit, say) */
export type SpaceSide = { value: number; picked: boolean; token?: string }
export type SpaceSides = Record<Side, SpaceSide>
/** onChange for a box's side: the value, whether it was picked from the tokens, and then which one */
export type SideChange = (side: Side, value: number, picked: boolean, token?: string) => void
/** A token on a space scale. A bare number N stands for --space-N */
export type SpaceToken = { name: string; px: number }
/** The space scale the values snap to and pick from; null when there's no design system attached */
export type SpaceScale = (number | SpaceToken)[] | null

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
export const SPACE_SCALE = [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 120]
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

// The scale as tokens, and the token for a value (measured values can be a hair off)
const tokensOf = (scale: SpaceScale): SpaceToken[] => (scale ?? []).map((s) => (typeof s === 'number' ? { name: `--space-${s}`, px: s } : s))
const tokenFor = (v: number, scale: SpaceScale) => tokensOf(scale).find((t) => Math.abs(t.px - v) < 0.01)

type Tone = 'token' | 'matches' | 'rogue' | 'none' | 'plain'
const toneOf = ({ value, picked, token }: SpaceSide, scale: SpaceScale): Tone => {
  if (value === 0) return 'none'
  if (!scale) return 'plain'
  const on = !!tokenFor(value, scale)
  return picked && (on || token) ? 'token' : on ? 'matches' : 'rogue'
}
const TITLE: Record<Tone, (v: SpaceSide, scale: SpaceScale) => string> = {
  plain: (v) => `${v.value}px`,
  token: (v, scale) => `Uses ${v.token ?? tokenFor(v.value, scale)?.name}`,
  matches: (v, scale) => `Typed in, but equal to ${tokenFor(v.value, scale)?.name}: pick it to use the token`,
  rogue: () => 'Not a token value',
  none: () => 'Not set',
}

/** A box's four sides from a number (all sides), or per side: a number, or { value, picked } */
export function sidesOf(spec: number | Partial<Record<Side, number | SpaceSide>>): SpaceSides {
  const one = (v: number | SpaceSide | undefined): SpaceSide => (typeof v === 'object' ? v : { value: v ?? 0, picked: true })
  return Object.fromEntries(SIDES.map((s) => [s, one(typeof spec === 'number' ? spec : spec[s])])) as SpaceSides
}

// The token icon: a rounded square with a dot
const TokenIcon = () => <SquareDot size={10} />

type ValueProps = {
  value: SpaceSide
  label: string
  /** The least it can be; null for none (margins can go below 0) */
  min?: number | null
  /** Fills a field (Gap) instead of sitting small in a diagram (Box model) */
  wide?: boolean
  scale?: SpaceScale
  onChange: (value: number, picked: boolean, token?: string) => void
}

export function SpaceValue({ value, label, min = 0, wide = false, scale = SPACE_SCALE, onChange }: ValueProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const tone = toneOf(value, scale)
  const set = (n: number) => onChange(min !== null ? Math.max(min, n) : n, false)
  const commit = () => {
    if (draft === null) return
    const n = parseFloat(draft)
    if (Number.isFinite(n)) set(n)
    setDraft(null)
  }
  return (
    <span className="sc-ui-space-value" data-tone={tone} data-wide={wide || undefined} title={TITLE[tone](value, scale)}>
      <input
        className="sc-ui-space-value-input"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? String(value.value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (commit(), e.currentTarget.blur())
          if (e.key === 'Escape') (setDraft(null), e.currentTarget.blur())
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            set(value.value + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))
            setDraft(null)
          }
        }}
      />
      {scale && (
      <DropdownMenu
        align="center"
        trigger={
          <button type="button" className="sc-ui-space-token" aria-label={`Pick a token for ${label}`} title="Pick a token">
            <TokenIcon />
          </button>
        }
        items={tokensOf(scale).filter((t) => t.px >= (min ?? -Infinity)).map((t) => ({
          label: (
            <span className="sc-ui-space-token-row" data-current={(value.picked && value.value === t.px && (!value.token || value.token === t.name)) || undefined}>
              <span>{t.name}</span>
              <span className="sc-ui-space-token-px">{t.px}px</span>
            </span>
          ),
          onSelect: () => onChange(t.px, true, t.name),
        }))}
      />
      )}
    </span>
  )
}

type BoxModelProps = {
  margin: SpaceSides
  padding: SpaceSides
  /** What sits in the middle, e.g. the element's size */
  content?: ReactNode
  onMarginChange: SideChange
  onPaddingChange: SideChange
  /** The space scale; null without a design system */
  scale?: SpaceScale
}

export function BoxModel({ margin, padding, content, onMarginChange, onPaddingChange, scale = SPACE_SCALE }: BoxModelProps) {
  const values = (box: 'margin' | 'padding', st: SpaceSides, on: SideChange, min: number | null) =>
    SIDES.map((side) => (
      <span key={side} className="sc-ui-box-side" data-side={side}>
        <SpaceValue value={st[side]} min={min} scale={scale} label={`${box} ${side}`} onChange={(v, picked, token) => on(side, v, picked, token)} />
      </span>
    ))
  return (
    <div className="sc-ui-box sc-ui-box-margin">
      <span className="sc-ui-box-label">Margin</span>
      {values('margin', margin, onMarginChange, null)}
      <div className="sc-ui-box sc-ui-box-padding">
        <span className="sc-ui-box-label">Padding</span>
        {values('padding', padding, onPaddingChange, 0)}
        <div className="sc-ui-box-content">{content}</div>
      </div>
    </div>
  )
}

const ColumnGapIcon = () => <GapHorizontal size={16} />
const RowGapIcon = () => <GapVertical size={16} />

type GapProps = {
  /** Leave out the gap the layout doesn't use: a row has a column gap, a column a row gap, a grid both */
  column?: SpaceSide
  row?: SpaceSide
  onColumnChange?: (value: number, picked: boolean, token?: string) => void
  onRowChange?: (value: number, picked: boolean, token?: string) => void
  /** The space scale; null without a design system */
  scale?: SpaceScale
}

export function GapFields({ column, row, onColumnChange, onRowChange, scale = SPACE_SCALE }: GapProps) {
  // Each gap is a token field: the space tokens to pick from, its colour from where it stands on the scale
  const tokens = tokensOf(scale)
  const field = (key: string, icon: ReactNode, v: SpaceSide, label: string, on?: (value: number, picked: boolean, token?: string) => void) => {
    const tone = toneOf(v, scale)
    return (
      <TokenField
        key={key}
        className="sc-ui-gap-field"
        label={label}
        icon={icon}
        value={v.value}
        unit="px"
        min={0}
        tone={tone === 'plain' ? 'custom' : tone}
        current={scale && v.picked ? (v.token ?? tokenFor(v.value, scale)?.name) : undefined}
        tokens={tokens.map((t) => ({ name: t.name, label: String(t.px) }))}
        onType={(value) => on?.(value, false)}
        onPick={(name) => {
          const t = tokens.find((x) => x.name === name)
          if (t) on?.(t.px, true, t.name)
        }}
        title={TITLE[tone](v, scale)}
      />
    )
  }
  const fields = [
    column && field('column', <ColumnGapIcon />, column, 'column gap', onColumnChange),
    row && field('row', <RowGapIcon />, row, 'row gap', onRowChange),
  ].filter(Boolean)
  return (
    <div className="sc-ui-gap" data-single={fields.length === 1 || undefined}>
      <span className="sc-ui-gap-label">Gap</span>
      {fields.length === 1 ? fields : <div className="sc-ui-gap-fields">{fields}</div>}
    </div>
  )
}

// Where each side's band sits inside its box, from that box's four values
// A side at 0 still keeps a thin strip to grab, or it could never be pulled back out
const GRAB = 6
function bandStyle(st: SpaceSides, side: Side): CSSProperties {
  const v = (s: Side) => st[s].value
  const t = Math.max(v(side), GRAB)
  if (side === 'top') return { top: 0, left: 0, right: 0, height: t }
  if (side === 'bottom') return { bottom: 0, left: 0, right: 0, height: t }
  if (side === 'left') return { left: 0, top: v('top'), bottom: v('bottom'), width: t }
  return { right: 0, top: v('top'), bottom: v('bottom'), width: t }
}

// The nearest value on the scale, or the nearest px without one
const snap = (v: number, scale: SpaceScale) => {
  const steps = tokensOf(scale).map((t) => t.px)
  return steps.length ? steps.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), steps[0]) : Math.round(v)
}

type ScrubProps = {
  margin: SpaceSides
  padding: SpaceSides
  onMarginChange: SideChange
  onPaddingChange: SideChange
  /** What's being spaced: it sits in a card, inside its padding */
  children: ReactNode
  /** The space scale a drag snaps to; null without a design system, to scrub through every px */
  scale?: SpaceScale
}

type Drag = { box: 'margin' | 'padding'; side: Side; value: number; x: number; y: number }

export function SpacingScrub({ margin, padding, onMarginChange, onPaddingChange, children, scale = SPACE_SCALE }: ScrubProps) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const state = { margin, padding }
  const on = { margin: onMarginChange, padding: onPaddingChange }
  const pad = (s: SpaceSides) => `${s.top.value}px ${s.right.value}px ${s.bottom.value}px ${s.left.value}px`

  // A band's moving edge follows the cursor: margin grows outward (pull its top band up), padding grows
  // inward, towards the content (pull its top band down). Snapped to the scale, unless ⌘ (or Ctrl) is held
  const start = (box: 'margin' | 'padding', side: Side) => (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const from = state[box][side].value
    const [x0, y0] = [e.clientX, e.clientY]
    const out = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[side]
    const sign = box === 'padding' ? out.map((n) => -n) : out
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev: globalThis.PointerEvent) => {
      // ⌘ (or Ctrl) held: off the scale, any whole px
      const free = ev.metaKey || ev.ctrlKey
      const px = Math.max(0, from + (ev.clientX - x0) * sign[0] + (ev.clientY - y0) * sign[1])
      const v = free ? Math.round(px) : snap(px, scale)
      const sides = ev.shiftKey ? SIDES : ev.altKey ? [side, OPPOSITE[side]] : [side]
      for (const s of sides) on[box](s, v, !!scale && !free, free ? undefined : tokenFor(v, scale)?.name)
      setDrag({ box, side, value: v, x: ev.clientX, y: ev.clientY })
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      setDrag(null)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    setDrag({ box, side, value: from, x: e.clientX, y: e.clientY })
  }

  const bands = (box: 'margin' | 'padding') =>
    SIDES.map((side) => {
      const v = state[box][side].value
      return (
        <span
          key={side}
          className="sc-ui-scrub-band"
          data-box={box}
          data-side={side}
          data-empty={v === 0 || undefined}
          data-active={(drag?.box === box && drag.side === side) || undefined}
          style={bandStyle(state[box], side)}
          onPointerDown={start(box, side)}
          onDoubleClick={() => on[box](side, 0, !!scale, tokenFor(0, scale)?.name)}
          title={`${box} ${side}: drag to change, double-click to clear. Alt: both sides, Shift: all four, ⌘: any value`}
        >
          {v >= 12 && <span className="sc-ui-scrub-num">{v}</span>}
        </span>
      )
    })

  return (
    <div className="sc-ui-scrub" data-dragging={drag ? '' : undefined}>
      <div className="sc-ui-scrub-margin" style={{ padding: pad(margin) }}>
        {bands('margin')}
        <div className="sc-ui-scrub-card" style={{ padding: pad(padding) }}>
          {bands('padding')}
          <div className="sc-ui-scrub-content">{children}</div>
        </div>
      </div>
      {drag && (
        <span className="sc-ui-scrub-tag" style={{ left: drag.x + 12, top: drag.y + 12 }}>
          {drag.box} {drag.side} · {tokenFor(drag.value, scale)?.name ?? `${drag.value}px`}
        </span>
      )}
    </div>
  )
}
