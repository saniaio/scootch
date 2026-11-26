'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// The bar slider (single value), rebuilt from DialKit's (dialkit, MIT, Josh Puckett) with our tokens and
// our own springs (./spring, no animation library):
// – markers fade in on hover (one per step if ≤ 10 steps, otherwise every 10%)
// – a 3px handle grows in on hover, brightens while dragging, dims + shrinks when it would sit under the text
// – click (no drag) springs the fill there and snaps to the step / nearest 10%; drag moves it directly
// – dragging past an edge stretches the bar a little, then it springs back
// – hover the value for a moment to underline it, click to type a number (Enter to set, Esc to cancel)
// – keyboard: arrows (Shift ×10), Home / End, Enter to type
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { animateSpring, springEasing, springs, type SpringControls } from './spring'

export type BarSliderProps = {
  label?: string
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  format?: (value: number) => string | number
  size?: 'compact' | 'regular' | 'comfortable' | 'spacious'
  disabled?: boolean
}

const CLICK_THRESHOLD = 3
const DEAD_ZONE = 32
const MAX_CURSOR_RANGE = 200
const MAX_STRETCH = 8
const HANDLE_BUFFER = 8
// The handle's springs, as CSS easings
const GROW = springEasing(springs.grow)
const SQUASH = springEasing(springs.squash)


const decimals = (step: number) => Math.min(6, (String(step).split('.')[1] ?? '').length)
const round = (v: number, step: number, min: number, max: number) => {
  const c = Math.max(min, Math.min(max, v))
  if (c === min || c === max) return c
  return Math.max(min, Math.min(max, Number((min + Math.round((c - min) / step) * step).toPrecision(14))))
}
const snapToDecile = (v: number, min: number, max: number) => {
  const n = (v - min) / (max - min)
  const nearest = Math.round(n * 10) / 10
  return Math.abs(n - nearest) <= 0.03125 ? min + nearest * (max - min) : v
}

export default function BarSlider({
  label = '',
  value: controlled,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  format,
  size,
  disabled = false,
}: BarSliderProps) {
  const [inner, setInner] = useState(defaultValue)
  const value = controlled ?? inner
  const setValue = useCallback(
    (v: number) => {
      if (controlled === undefined) setInner(v)
      onValueChange?.(v)
    },
    [controlled, onValueChange],
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const downRef = useRef<{ x: number; y: number } | null>(null)
  const isClick = useRef(true)
  const anim = useRef<SpringControls | null>(null)
  const stretchAnim = useRef<SpringControls | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  const [hovered, setHovered] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [valueHovered, setValueHovered] = useState(false)
  const [editable, setEditable] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const pct = ((value - min) / (max - min)) * 100
  const active = !disabled && (interacting || hovered)

  // The fill and the stretch are written straight to the DOM each frame (no re-render per frame)
  const fillValue = useRef(pct)
  const stretchValue = useRef(0)
  const textRef = useRef<HTMLDivElement>(null)
  const setFill = useCallback((p: number) => {
    fillValue.current = p
    if (fillRef.current) fillRef.current.style.width = `${p}%`
    // The text darkens where the fill is under it (see .sc-ui-bar-text)
    textRef.current?.style.setProperty('--fill', `${p}%`)
    if (handleRef.current) handleRef.current.style.left = `max(5px, calc(${p}% - 9px))`
  }, [])
  const setStretch = useCallback((s: number) => {
    stretchValue.current = s
    if (!trackRef.current) return
    trackRef.current.style.width = `calc(100% + ${Math.abs(s)}px)`
    trackRef.current.style.transform = s < 0 ? `translateX(${s}px)` : ''
  }, [])

  useEffect(() => {
    if (!interacting && !anim.current) setFill(pct)
  }, [pct, interacting, setFill])

  const toValue = (clientX: number) => {
    const r = rectRef.current
    if (!r) return value
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return min + p * (max - min)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || editing || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    downRef.current = { x: e.clientX, y: e.clientY }
    isClick.current = true
    rectRef.current = wrapperRef.current?.getBoundingClientRect() ?? null
    setInteracting(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!interacting || !downRef.current) return
    const d = Math.hypot(e.clientX - downRef.current.x, e.clientY - downRef.current.y)
    if (isClick.current && d > CLICK_THRESHOLD) {
      isClick.current = false
      setDragging(true)
    }
    if (isClick.current) return
    const r = rectRef.current
    if (r) {
      const past = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0
      const sign = e.clientX < r.left ? -1 : 1
      const over = Math.max(0, past - DEAD_ZONE)
      stretchAnim.current?.stop()
      setStretch(past ? sign * MAX_STRETCH * Math.sqrt(Math.min(over / MAX_CURSOR_RANGE, 1)) : 0)
    }
    const v = toValue(e.clientX)
    anim.current?.stop()
    anim.current = null
    setFill(((v - min) / (max - min)) * 100)
    setValue(round(v, step, min, max))
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!interacting) return
    if (isClick.current) {
      const raw = toValue(e.clientX)
      const steps = (max - min) / step
      const snapped = steps <= 10 ? round(raw, step, min, max) : snapToDecile(raw, min, max)
      const velocity = anim.current?.velocity() ?? 0
      anim.current?.stop()
      anim.current = animateSpring({
        from: fillValue.current,
        to: ((snapped - min) / (max - min)) * 100,
        velocity,
        spring: springs.release,
        onUpdate: setFill,
        onComplete: () => (anim.current = null),
      })
      setValue(round(snapped, step, min, max))
    }
    if (stretchValue.current !== 0) {
      stretchAnim.current?.stop()
      stretchAnim.current = animateSpring({ from: stretchValue.current, to: 0, spring: springs.settle, onUpdate: setStretch, restDelta: 0.05 })
    }
    setInteracting(false)
    setDragging(false)
    downRef.current = null
  }

  const onPointerCancel = () => {
    stretchAnim.current?.stop()
    setStretch(0)
    setInteracting(false)
    setDragging(false)
    downRef.current = null
  }

  // Hover the value for 0.8s and it becomes editable (underlined); click to type.
  useEffect(() => {
    if (valueHovered && !editing && !editable) {
      const t = setTimeout(() => setEditable(true), 800)
      return () => clearTimeout(t)
    }
    if (!valueHovered && !editing) setEditable(false)
  }, [valueHovered, editing, editable])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const startEditing = () => {
    setDraft(value.toFixed(decimals(step)))
    setEditing(true)
  }
  const commit = () => {
    const n = parseFloat(draft)
    if (Number.isFinite(n)) setValue(round(n, step, min, max))
    setEditing(false)
    setEditable(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || editing) return
    const big = e.shiftKey ? 10 : 1
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + step * big
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - step * big
    if (e.key === 'Home') next = min
    if (e.key === 'End') next = max
    if (e.key === 'Enter') {
      e.preventDefault()
      startEditing()
      return
    }
    if (next === null) return
    e.preventDefault()
    anim.current?.stop()
    anim.current = null
    const v = round(next, step, min, max)
    setFill(((v - min) / (max - min)) * 100)
    setValue(v)
  }

  // The handle dodges the label and value: if it would sit under them it dims and shrinks.
  const w = wrapperRef.current?.offsetWidth ?? 0
  let leftLimit = 30
  let rightLimit = 78
  if (w > 0) {
    if (labelRef.current) leftLimit = ((10 + labelRef.current.offsetWidth + HANDLE_BUFFER) / w) * 100
    if (valueRef.current) rightLimit = ((w - 12 - valueRef.current.offsetWidth - HANDLE_BUFFER) / w) * 100
  }
  const dodge = pct < leftLimit || pct > rightLimit
  const handleOpacity = !active ? 0 : dodge ? 0.1 : dragging ? 0.9 : 0.5

  const steps = (max - min) / step
  const marks = steps <= 10 ? Array.from({ length: steps - 1 }, (_, i) => ((i + 1) * step * 100) / (max - min)) : Array.from({ length: 9 }, (_, i) => (i + 1) * 10)
  const shown = format ? format(value) : value.toFixed(decimals(step))

  return (
    <div ref={wrapperRef} className="sc-ui-bar" data-size={size} data-disabled={disabled || undefined}>
      <div
        ref={trackRef}
        className="sc-ui-bar-track sc-ui-focus"
        data-active={active || undefined}
        role="slider"
        tabIndex={disabled || editing ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${shown}${unit}`}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: '100%' }}
      >
        <div className="sc-ui-bar-marks" aria-hidden>
          {marks.map((m) => (
            <span key={m} className="sc-ui-bar-mark" style={{ left: `${m}%` }} />
          ))}
        </div>
        <div ref={fillRef} className="sc-ui-bar-fill" style={{ width: `${fillValue.current}%` }} />
        {/* Outer: position, opacity and the height squash; inner: the width grow. Each has its own spring. */}
        <div
          ref={handleRef}
          className="sc-ui-barh"
          style={
            {
              left: `max(5px, calc(${fillValue.current}% - 9px))`,
              opacity: handleOpacity,
              scale: `1 ${active && dodge ? 0.75 : 1}`,
              '--sq-dur': `${SQUASH.duration}ms`,
              '--sq-ease': SQUASH.easing,
            } as CSSProperties
          }
        >
          <div
            className="sc-ui-barh-bar"
            style={{ transform: `scaleX(${active ? 1 : 0.25})`, transition: `transform ${GROW.duration}ms ${GROW.easing}` }}
          />
        </div>
        {/* One text layer over the whole bar, so its colour can split exactly at the fill's edge */}
        <div ref={textRef} className="sc-ui-bar-text" style={{ '--fill': `${fillValue.current}%` } as CSSProperties}>
        <span ref={labelRef} className="sc-ui-bar-label">
          {label}
        </span>
        {editing ? (
          <input
            ref={inputRef}
            className="sc-ui-bar-input"
            aria-label={`${label} value`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setEditing(false)
                setEditable(false)
              }
            }}
            onBlur={commit}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            ref={valueRef}
            className="sc-ui-bar-value"
            data-editable={editable || undefined}
            onMouseEnter={() => setValueHovered(true)}
            onMouseLeave={() => setValueHovered(false)}
            onPointerDown={(e) => editable && e.stopPropagation()}
            onClick={(e) => {
              if (!editable) return
              e.stopPropagation()
              startEditing()
            }}
          >
            {shown}
            {unit}
          </span>
        )}
        </div>
      </div>
    </div>
  )
}
