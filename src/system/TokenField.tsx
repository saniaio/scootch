'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Token field: one field for a value that should come from a token. Type a value (or drag on it to scrub,
// Shift ×10), or open the token list from the icon on the right. The list shows each token's name on the left
// and its value on the right, filters as you type, and works with the arrow keys; colour fields get a picker
// above it. The value's colour says where it stands: token (purple), matches (amber: typed in, but equal to a
// token: the link button beside it uses that token in one click), rogue (text colour: no token for it), custom (text
// colour), none (grey: nothing there). Hover for the detail.
// From Scootch, where every value is one. Its height is the density's (--control-height).
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import ColorPicker from './ColorPicker'
import ScrollArea from './ScrollArea'
import DropdownMenu from './DropdownMenu'
import { Grid, Link, LinkBreak, List, SquareDot } from './icons'

export type TokenTone = 'token' | 'matches' | 'rogue' | 'custom' | 'none'
/** A token in the list: its name, the value shown on the right, and a swatch for colours */
export type TokenOption = { name: string; label?: string; swatch?: string }

const TONE_TITLE: Record<TokenTone, (t?: string) => string> = {
  token: (t) => `Uses ${t}`,
  matches: (t) => `Typed in, but equal to ${t}: pick it to use the token`,
  rogue: () => 'Not a token value',
  custom: (t) => `Uses ${t}, which isn't in the token list`,
  none: () => 'Not set',
}

type Rect = { left: number; top: number; bottom: number; width: number }

type ListProps = {
  anchor: Rect
  tokens: TokenOption[]
  current?: string
  unit?: string
  colour?: string
  onColour?: (value: string) => void
  onPick: (name: string) => void
  onClose: () => void
}

function TokenList({ anchor, tokens, current, unit, colour, onColour, onPick, onClose }: ListProps) {
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  // Colour tokens can be seen as a grid of swatches. It always opens as the list
  const [view, setView] = useState<'list' | 'grid'>('list')
  const swatches = tokens.some((t) => t.swatch)
  // The colour being picked: the picker drives it, not the field's swatch, which lags behind and would reset the picker
  const [picked, setPicked] = useState(colour || '#000000')
  const box = useRef<HTMLDivElement>(null)
  // As wide as its field, and at least 160 like the menus, so small fields still get a usable list
  const width = Math.max(anchor.width, 160)
  const [pos, setPos] = useState({ width, left: anchor.left, top: anchor.bottom + 4 })
  const shown = tokens.filter((t) => `${t.name} ${t.label ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  // Start on the current token
  useEffect(() => {
    const i = tokens.findIndex((t) => t.name === current)
    if (i >= 0) setHi(i)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setHi((h) => Math.min(h, Math.max(0, shown.length - 1))), [query]) // eslint-disable-line react-hooks/exhaustive-deps

  // Below the field, or above it if there's no room; inside the window either way
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const h = el.offsetHeight
    const w = el.offsetWidth
    const below = anchor.bottom + 4 + h <= window.innerHeight - 8
    setPos({
      width,
      left: Math.min(Math.max(8, anchor.left), window.innerWidth - w - 8),
      top: below ? anchor.bottom + 4 : Math.max(8, anchor.top - 4 - h),
    })
  }, [anchor, width])

  useEffect(() => {
    // Outside the list closes it, but not a menu opened from inside it (the colour picker's format menu)
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target as Element
      if (!box.current?.contains(t) && !t.closest?.('.sc-ui-positioner')) onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [onClose])

  useEffect(() => {
    box.current?.querySelector('[data-hi]')?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return e.preventDefault(), e.stopPropagation(), onClose()
    // The arrows and Enter move through the tokens only from the search or the list, not inside the picker
    if (!(e.target as HTMLElement).closest('.sc-ui-token-searchbar, .sc-ui-token-items')) return
    // In the grid, left and right step through the swatches too
    const next = e.key === 'ArrowDown' || (view === 'grid' && e.key === 'ArrowRight')
    const prev = e.key === 'ArrowUp' || (view === 'grid' && e.key === 'ArrowLeft')
    if (next) (e.preventDefault(), setHi((h) => Math.min(shown.length - 1, h + 1)))
    if (prev) (e.preventDefault(), setHi((h) => Math.max(0, h - 1)))
    if (e.key === 'Enter' && shown[hi]) (e.preventDefault(), onPick(shown[hi].name))
  }

  return (
    <div ref={box} className="sc-ui-token-list" data-colour={onColour ? '' : undefined} style={pos} onKeyDown={onKey}>
      {onColour && (
        <div className="sc-ui-token-picker">
          <ColorPicker inline value={picked} onValueChange={(v) => (setPicked(v), onColour(v))} />
        </div>
      )}
      <div className="sc-ui-token-searchbar">
        <input autoFocus className="sc-ui-token-search" placeholder="Search tokens" aria-label="Search tokens" value={query} onChange={(e) => setQuery(e.target.value)} />
        {swatches && (
          <>
            <button type="button" className="sc-ui-token-view" aria-pressed={view === 'list'} aria-label="Show as a list" title="List" onClick={() => setView('list')}>
              <List size={14} />
            </button>
            <button type="button" className="sc-ui-token-view" aria-pressed={view === 'grid'} aria-label="Show as a grid" title="Grid" onClick={() => setView('grid')}>
              <Grid size={14} />
            </button>
          </>
        )}
      </div>
      <ScrollArea className="sc-ui-token-scroll">
      <div className="sc-ui-token-items" role="listbox" data-view={swatches ? view : undefined}>
        {shown.length === 0 && <p className="sc-ui-token-empty">No tokens match</p>}
        {shown.map((t, i) => (
          <button
            key={t.name}
            type="button"
            role="option"
            aria-selected={t.name === current}
            className="sc-ui-token-item"
            data-hi={i === hi || undefined}
            data-current={t.name === current || undefined}
            title={view === 'grid' && swatches ? t.name.replace(/^--/, '') : undefined}
            onMouseEnter={() => setHi(i)}
            onClick={() => onPick(t.name)}
          >
            {t.swatch && <span className="sc-ui-token-swatch" style={{ background: t.swatch }} />}
            <span className="sc-ui-token-name">{t.name.replace(/^--/, '')}</span>
            <span className="sc-ui-token-value">
              {t.label}
              {unit && /^-?[\d.]+$/.test(t.label ?? '') ? unit : ''}
            </span>
          </button>
        ))}
      </div>
      </ScrollArea>
    </div>
  )
}

export type TokenFieldProps = {
  /** The number shown and typed; null for values you can only pick, like a colour or a class */
  value: number | null
  /** Text shown instead of the number (a colour, a class) */
  display?: string
  unit?: string
  /** Units to choose from (px, rem, em): the unit becomes a picker, and typing one ("1rem") switches to it */
  units?: string[]
  /** A unit picked from the list; the field's owner converts the value */
  onUnit?: (unit: string) => void
  /** The unit the tokens' values are in, when it isn't the field's (px tokens in a rem field) */
  tokenUnit?: string
  tone?: TokenTone
  tokens: TokenOption[]
  /** The token it uses or equals */
  current?: string
  /** A typed or scrubbed number; leave out for pick-only fields. unit: a different one typed with it ("1rem") */
  onType?: (value: number, unit?: string) => void
  onPick: (name: string) => void
  /** Colour fields: any colour from the picker above the list */
  onColour?: (value: string) => void
  step?: number
  min?: number | null
  /** A colour's swatch, before the value */
  swatch?: string
  /** Shown before the value, like a field's label in Figma */
  icon?: ReactNode
  /** What the field is, for screen readers (it shows no label of its own) */
  label?: string
  title?: string
  className?: string
  /** Greyed out and read-only: the value comes from something else (a type style's size, say) */
  disabled?: boolean
  /** Shows a break-link button by the token button, to detach the token and use its values one by one */
  onDetach?: () => void
  /** Typed text, before it's read as one number: return true to take it yourself (e.g. "8, 8, 0, 0" for corners) */
  onText?: (text: string) => boolean
}

export default function TokenField({
  value,
  display,
  unit = '',
  units,
  onUnit,
  tokenUnit,
  tone = 'none',
  tokens,
  current,
  onType,
  onPick,
  onColour,
  step = 1,
  min = null,
  swatch,
  icon,
  label,
  title,
  className,
  disabled = false,
  onDetach,
  onText,
}: TokenFieldProps) {
  const [open, setOpen] = useState<Rect | null>(null) // the field's rect while the list is open
  const [draft, setDraft] = useState<string | null>(null) // text while typing
  const wrap = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const drag = useRef<{ x: number; y: number; v: number; moved: boolean } | null>(null)
  const typeable = !disabled && !!onType && value !== null && value !== undefined
  const clamp = (n: number) => (min !== null ? Math.max(min, n) : n)

  const shown = draft ?? display ?? (Number.isFinite(value) ? String(Math.round((value as number) * 1000) / 1000) : '')
  const commit = () => {
    if (draft === null) return
    if (onText?.(draft)) return setDraft(null)
    // A number with a unit from the list ("1rem", "1.5 em") switches to that unit, as in Webflow
    const m = draft.trim().match(/^(-?\d*\.?\d+)\s*([a-z%]+)$/i)
    const typed = m?.[2].toLowerCase()
    const n = parseFloat(draft)
    if (Number.isFinite(n)) onType?.(clamp(n), typed && typed !== unit && units?.includes(typed) ? typed : undefined)
    setDraft(null)
  }
  const rect = () => wrap.current!.getBoundingClientRect()

  // Drag on the field to scrub; a press without moving puts the cursor in it to type
  const onPointerDown = (e: PointerEvent<HTMLInputElement>) => {
    if (!typeable || document.activeElement === input.current || e.button !== 0) return
    e.preventDefault()
    drag.current = { x: e.clientX, y: e.clientY, v: value as number, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLInputElement>) => {
    const d = drag.current
    if (!d) return
    const delta = e.clientX - d.x - (e.clientY - d.y)
    if (!d.moved && Math.abs(delta) < 3) return
    d.moved = true
    onType?.(clamp(Math.round((d.v + Math.round(delta / 3) * step * (e.shiftKey ? 10 : 1)) * 1000) / 1000))
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) {
      input.current?.focus()
      input.current?.select()
    }
  }

  return (
    <span
      ref={wrap}
      className={['sc-ui-token-field', className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-open={open ? '' : undefined}
      data-disabled={disabled || undefined}
      title={title ?? TONE_TITLE[tone](current)}
    >
      {swatch && <span className="sc-ui-token-swatch" style={{ background: swatch }} />}
      {icon && <span className="sc-ui-token-lead">{icon}</span>}
      {typeable ? (
        <input
          ref={input}
          className="sc-ui-token-input"
          aria-label={label}
          inputMode="decimal"
          value={shown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (commit(), e.currentTarget.blur())
            if (e.key === 'Escape') (setDraft(null), e.currentTarget.blur())
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              onType?.(clamp(Math.round(((value as number) + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)) * 1000) / 1000))
              setDraft(null)
            }
          }}
        />
      ) : disabled ? (
        <span className="sc-ui-token-text">{shown || '—'}</span>
      ) : (
        <button type="button" className="sc-ui-token-text" aria-label={label} onClick={() => setOpen(rect())}>
          {shown || '—'}
        </button>
      )}
      {/* The unit and the buttons sit together at the end, closer to each other than to the value */}
      <span className="sc-ui-token-end">
      {units && units.length > 1 && onUnit && !disabled ? (
        <DropdownMenu
          compact
          align="end"
          trigger={
            <button type="button" className="sc-ui-token-unit sc-ui-token-unit-pick" aria-label={label ? `Unit for ${label}` : 'Unit'} title="Change the unit">
              {unit}
            </button>
          }
          items={units.map((u) => ({ label: u, onSelect: () => u !== unit && onUnit(u) }))}
        />
      ) : (
        unit && <span className="sc-ui-token-unit">{unit}</span>
      )}
      {tone === 'matches' && current && !disabled && (
        <button type="button" className="sc-ui-token-button" aria-label={`Use ${current}`} title={`Use ${current}: it has the same value`} onClick={() => onPick(current)}>
          <Link size={14} />
        </button>
      )}
      {onDetach && !disabled && (
        <button type="button" className="sc-ui-token-button" aria-label={label ? `Detach ${label}` : 'Detach the token'} title="Detach: use its values one by one" onClick={onDetach}>
          <LinkBreak size={14} />
        </button>
      )}
      {/* No token button when there are no tokens to offer (and no colour picker behind it) */}
      {!disabled && (tokens.length > 0 || onColour) && (
        <button type="button" className="sc-ui-token-button" aria-label={label ? `Pick a token for ${label}` : 'Pick a token'} title="Pick a token" onClick={() => setOpen((o) => (o ? null : rect()))}>
          <SquareDot size={10} />
        </button>
      )}
      </span>
      {open && (
        <TokenList
          anchor={open}
          tokens={tokens}
          current={current}
          unit={tokenUnit ?? unit}
          colour={swatch}
          onColour={onColour}
          onPick={(name) => {
            onPick(name)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </span>
  )
}
