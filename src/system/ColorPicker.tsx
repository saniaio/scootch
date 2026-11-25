'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Colour picker: a row like DialKit's (label left, value + swatch right) that opens a popover with
// a saturation / brightness area, hue and opacity sliders, a format switch (Hex · OKLCH · Display P3)
// and a field to type the value. OKLCH and P3 pick in the wider P3 space, like DialKit.
// The value is a CSS colour string in the chosen format; the area and sliders work by keyboard too.
// inline: just the picker, in place, for putting inside another panel (Scootch's colour token list).
import {
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Popover } from '@base-ui/react/popover'
import { Slider } from '@base-ui/react/slider'
import { CaretDown, Check, Copy } from './icons'
import DropdownMenu from './DropdownMenu'
import ScrollArea from './ScrollArea'
import {
  convert,
  css,
  format,
  hsvToRgb,
  parse,
  rgbToHsv,
  spaceFor,
  type Format,
  type HSVA,
  type Space,
} from './lib/color'

type ColorPickerProps = {
  label?: string
  value: string
  onValueChange: (value: string) => void
  alpha?: boolean
  /** Where the swatch sits in the row: after the value (default) or before it. */
  swatch?: 'start' | 'end'
  /** Open the picker from your own element (e.g. a Tune button) instead of the row. */
  trigger?: ReactElement
  /** Colour tokens listed under the picker, like Webflow's swatches. `value` is the token's colour now. */
  tokens?: { name: string; value: string }[]
  /** The token in use, if any: the row shows its name instead of the value. */
  token?: string | null
  /** Picking a token from the list. Moving the picker after that calls onValueChange as usual. */
  onTokenChange?: (name: string) => void
  /** Just the picker, in place: no row and no popover (for putting it inside another panel or list). */
  inline?: boolean
  /** The picker in place, as in its popover (a taller colour area than inline): no row and no popover. */
  open?: boolean
}

const FORMATS: [Format, string][] = [
  ['hex', 'Hex'],
  ['oklch', 'OKLCH'],
  ['p3', 'Display P3'],
]

function toState(value: string) {
  const p = parse(value) ?? parse('#000000')!
  return {
    hsva: { ...rgbToHsv(p.rgb), a: p.a },
    space: p.space,
    format: p.format,
  }
}

function Area({
  hsva,
  space,
  onChange,
}: {
  hsva: HSVA
  space: Space
  onChange: (next: Partial<HSVA>) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const set = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onChange({
      s: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      v: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)),
    })
  }
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01
    const keys: Record<string, Partial<HSVA>> = {
      ArrowLeft: { s: Math.max(0, hsva.s - step) },
      ArrowRight: { s: Math.min(1, hsva.s + step) },
      ArrowUp: { v: Math.min(1, hsva.v + step) },
      ArrowDown: { v: Math.max(0, hsva.v - step) },
    }
    if (keys[e.key]) {
      e.preventDefault()
      onChange(keys[e.key])
    }
  }
  return (
    <div
      ref={ref}
      className="sc-ui-color-area sc-ui-focus"
      style={
        { '--hue-color': css(hsvToRgb(hsva.h, 1, 1), space) } as CSSProperties
      }
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsva.s * 100)}%, brightness ${Math.round(hsva.v * 100)}%`}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        set(e)
      }}
      onPointerMove={(e) => e.buttons && set(e)}
    >
      <span
        className="sc-ui-color-area-thumb"
        style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%` }}
      />
    </div>
  )
}

function Channel({
  label,
  value,
  max,
  onChange,
  className,
  fill,
}: {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
  className: string
  /** The handle's colour, like a gradient stop's */
  fill: string
}) {
  return (
    <Slider.Root
      value={value}
      min={0}
      max={max}
      step={1}
      onValueChange={(v) => onChange(v as number)}
    >
      <Slider.Control className={`sc-ui-color-channel ${className}`}>
        <Slider.Track className="sc-ui-color-channel-track">
          <Slider.Thumb className="sc-ui-color-channel-thumb" aria-label={label} style={{ background: fill }} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  )
}

export default function ColorPicker({
  label,
  value,
  onValueChange,
  alpha = true,
  swatch: swatchSide = 'end',
  trigger,
  tokens,
  token,
  onTokenChange,
  inline = false,
  open = false,
}: ColorPickerProps) {
  const [state, setState] = useState(() => toState(value))
  const [draft, setDraft] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const valueRow = useRef<HTMLDivElement>(null); // the format menu lines up with this field's left edge
  const last = useRef(value)
  const { hsva, space, format: fmt } = state
  const rgb = hsvToRgb(hsva.h, hsva.s, hsva.v)
  const out = format(rgb, space, hsva.a, fmt)

  // Follow outside changes (another control editing the same value)
  if (value !== last.current && value !== out) {
    last.current = value
    setState(toState(value))
  }

  const emit = (next: typeof state) => {
    setState(next)
    const v = format(
      hsvToRgb(next.hsva.h, next.hsva.s, next.hsva.v),
      next.space,
      next.hsva.a,
      next.format,
    )
    last.current = v
    onValueChange(v)
  }
  const update = (patch: Partial<HSVA>) =>
    emit({ ...state, hsva: { ...hsva, ...patch } })
  const switchFormat = (f: Format) => {
    const to = spaceFor(f)
    const moved = convert(rgb, space, to).map((n) =>
      Math.min(1, Math.max(0, n)),
    ) as typeof rgb
    emit({ hsva: { ...rgbToHsv(moved), a: hsva.a }, space: to, format: f })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(out)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: the value is still selectable in the field
    }
  }

  const swatch = css(rgb, space, hsva.a)
  const opaque = css(rgb, space)
  const shown = token ? `--${token}` : out

  // The picker itself: area, hue, opacity, format, value and the tokens. In a popover, or in place
  const body = (
    <>
      <Area hsva={hsva} space={space} onChange={update} />
      <Channel
        label="Hue"
        value={Math.round(hsva.h)}
        max={360}
        onChange={(h) => update({ h })}
        className="sc-ui-color-hue"
        fill={`hsl(${Math.round(hsva.h)} 100% 50%)`}
      />
      {alpha && (
        <div style={{ '--opaque': opaque } as CSSProperties}>
          <Channel
            label="Opacity"
            value={Math.round(hsva.a * 100)}
            max={100}
            onChange={(a) => update({ a: a / 100 })}
            className="sc-ui-color-alpha"
            fill={opaque}
          />
        </div>
      )}
      {/* The format is a picker at the start of the value's row (one layout everywhere) */}
      <div ref={valueRow} className="sc-ui-control sc-ui-color-value-row">
        <DropdownMenu
          compact
          anchor={valueRow}
          trigger={
            <button type="button" className="sc-ui-color-format-pick sc-ui-focus" aria-label="Colour format">
              {FORMATS.find(([f]) => f === fmt)?.[1]}
              <CaretDown size={12} />
            </button>
          }
          items={FORMATS.map(([f, name]) => ({ label: name, onSelect: () => switchFormat(f) }))}
        />
        <input
          className="sc-ui-color-value"
          aria-label="Colour value"
          value={draft ?? out}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const p = draft ? parse(draft) : null
            if (p)
              emit({
                hsva: { ...rgbToHsv(p.rgb), a: p.a },
                space: p.space,
                format: p.format,
              })
            setDraft(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <button
          className="sc-ui-icon-button"
          data-copied={copied || undefined}
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy value'}
        >
          {copied ? (
            <Check size={14} />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>
      {tokens && tokens.length > 0 && (
        <ScrollArea className="sc-ui-color-tokens-scroll">
        <div className="sc-ui-color-tokens" role="listbox" aria-label="Colour tokens">
          {tokens.map((t) => (
            <button
              key={t.name}
              role="option"
              aria-selected={token === t.name}
              className="sc-ui-color-token sc-ui-focus"
              data-active={token === t.name || undefined}
              onClick={() => onTokenChange?.(t.name)}
            >
              <span className="sc-ui-color-swatch" style={{ '--swatch': t.value } as CSSProperties} />
              <span className="sc-ui-color-token-name">--{t.name}</span>
              {token === t.name && <Check size={14} />}
            </button>
          ))}
        </div>
        </ScrollArea>
      )}
    
    </>
  )

  if (inline) return <div className="sc-ui-color-inline">{body}</div>
  if (open) return <div className="sc-ui-color-open">{body}</div>

  return (
    <Popover.Root>
      {trigger ? (
        <Popover.Trigger render={trigger} />
      ) : (
        <Popover.Trigger
          className="sc-ui-control sc-ui-color-row"
          data-swatch={swatchSide}
          aria-label={`${label ?? 'Colour'}: ${shown}`}
        >
          {swatchSide === 'start' && (
            <span
              className="sc-ui-color-swatch"
              style={{ '--swatch': swatch } as CSSProperties}
            />
          )}
          {label && <span className="sc-ui-color-row-label">{label}</span>}
          <span className="sc-ui-color-row-value">{shown}</span>
          {swatchSide === 'end' && (
            <span
              className="sc-ui-color-swatch"
              style={{ '--swatch': swatch } as CSSProperties}
            />
          )}
        </Popover.Trigger>
      )}
      <Popover.Portal>
        <Popover.Positioner
          className="sc-ui-positioner"
          sideOffset={6}
          align="end"
        >
          <Popover.Popup className="sc-ui-popup sc-ui-color-popup">
            {/* When it runs out of room the whole picker scrolls, under the same thin bar as the lists */}
            <ScrollArea className="sc-ui-color-popup-scroll">
              <div className="sc-ui-color-popup-body">{body}</div>
            </ScrollArea>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
