'use client'

// Scootch: one tool for checking, adjusting and commenting on the page. Dev only; ⌥I opens it.
//   Inspect – click any element to see its padding, margin, gap and type, whether each value is a
//             token, and change it live (drag a value like Webflow, or pick a token).
//   Comment – under the values, a comment box for the same element: type, Enter. No separate mode.
//   Draw    – ⇧D (or the pencil in the bar): drag to sketch over the page, say what it means, Enter. The
//             sketch is saved as a note pinned to the element under it, and drawn there from then on.
//   Rulers  – Figma-style rulers on the top and left edges; drag guides out of them (⇧R).
// The tools' shortcuts are all Shift and a letter (⇧D, ⇧R, and ⇧G when there are grids), so they never fire while you type.
//   Dock    – the panel can sit beside the page, like the browser's inspect panel, so nothing is
//             hidden under it.
//   Breakpoint – the bar shows which breakpoint the window is in, worked out from the app's own CSS
//             (breakpoint.js); every note records it.
//   Tabs    – the app can add its own tabs next to Inspect (the `tabs` prop: { id, label, render }).
// Notes and adjusted elements get numbered markers on the page and one numbered list in the panel.
// Adjustments save themselves as notes too (one per element, kept up to date as you tweak), so
// there's nothing to press. Notes live in .notes/notes.json (via
// /api/notes), where you (or an AI agent) read them, reply and mark them resolved.
import { configure } from './tokens'
import { VERSION } from './version'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CommentBox, Markers, SketchBox, Sketches, anchorFor, elementFor, setNotesApi, toRelative, useFrame, useNotes } from './Notes'
import { ALargeSmall, Moon, Sun, AnchorGrid, ArrowCounterClockwise, ArrowDown, ArrowUp, ArrowLeftRight, ArrowRight, Bold, Button, CaretDown, Columns, GapHorizontal, GapVertical, JustifyAround, JustifyBetween, JustifyPacked, LineDashed, LineDotted, LineSolid, CornerRadius, Minus, NumberField, Rows, SidePicker, WrapText, LetterSpacing, LineHeight, List, PanelRight, PencilSimple, Plus, RulerCorner, SegmentedControl, ScrollArea, Select, Slider, Switch, Textarea, TokenField, Type, X, BoxModel as LibraryBoxModel, NoteList } from './system/index'
import Rulers, { RULER_SIZE } from './Rulers'
import {
  colourTokens,
  componentPath,
  cssPath,
  declaredValue,
  describe,
  firstFamily,
  fontTokens,
  hasOwnText,
  projectFonts,
  pxTokens,
  resetRuleCache,
  spaceTokens,
  status,
  store,
  tokenIn,
  trackingTokens,
  typeClassOf,
  typeStyles,
  weightTokens,
  typeClasses,
  pageTheme as readPageTheme,
} from './inspect'
import { changesOf, kindOf, optionsOf, resetControls, setControl, useControlGroups } from './controls'
import { useStyles } from './styles'
import { breakpointLabel, useBreakpoint } from './breakpoint'

const SIDES = ['top', 'right', 'bottom', 'left']
// Scootch's own nodes, and the library's popups (its token menus open in one, outside the panel)
const isScootchNode = (n) => n?.closest?.('[data-scootch], .sc-ui-positioner')

// Put a change on the element: a type class swaps for another ('' takes it off), anything else is inline style
function applyChange(el, prop, to) {
  if (prop === 'class') {
    typeClasses().forEach((c) => el.classList.remove(c))
    if (to) el.classList.add(to)
  } else el.style.setProperty(prop, to)
}

// Token options for a field: each token with its px value as the label
const pxOptions = (list) => list.map((t) => ({ name: t.name, label: String(t.px) }))

// How a value without a px scale stands: written with a token (token / custom), equal to one (matches), or neither
const matchState = (declared, match) =>
  tokenIn(declared) ? status(declared, null, []) : match ? { kind: 'matches', token: match.name } : { kind: 'rogue' }

/* ---------- Boxes drawn over the hovered / selected element ---------- */

// The element's box, measured again every frame (the same frame loop as the note markers)
function useRect(el, active) {
  useFrame(!!el && active)
  return el?.isConnected ? el.getBoundingClientRect() : null
}

// Margin (cream) and padding (green) as bands around and inside the element, in the library's SpacingScrub look.
// Selected: each band shows its number (12px and up) and can be dragged to change it, snapped to the space
// scale. Alt moves the opposite side too; Shift moves all four. Double-click a band to clear it.
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

// Where each side's band sits: the full width at top and bottom, between them at left and right
// grab: the least a band can be, so a side at 0 still has a strip to pull out again. A margin's strip
// sits outside the element (out), a padding's inside it.
function bandRects(box, v, grab = 0, out = false) {
  const t = Object.fromEntries(SIDES.map((s) => [s, Math.max(v[s], grab)]))
  const o = (s) => (out ? t[s] - v[s] : 0) // how far a strip reaches past the box
  return {
    top: { left: box.left, top: box.top - o('top'), width: box.width, height: t.top },
    bottom: { left: box.left, top: box.top + box.height - v.bottom - (out ? 0 : t.bottom - v.bottom), width: box.width, height: t.bottom },
    left: { left: box.left - o('left'), top: box.top + v.top, width: t.left, height: box.height - v.top - v.bottom },
    right: { left: box.left + box.width - v.right - (out ? 0 : t.right - v.right), top: box.top + v.top, width: t.right, height: box.height - v.top - v.bottom },
  }
}
const GRAB = 6

// The gaps of a flex or grid box, as bands between its children: a column gap between neighbours on one line,
// a row gap across the content between lines. Each band is the gap's own size (grab at the least), centred in
// the space between the two, so space-between's extra room isn't mistaken for gap. Children are taken in
// order, so a line break shows as a row gap; one band per line break.
function gapBands(el, c, box, grab) {
  if (!/flex|grid/.test(c.display)) return []
  // Bare text is a child too (an icon, then "Search", then a shortcut): measured with a range
  const kids = [...el.childNodes]
    .map((k) => {
      if (k.nodeType === Node.TEXT_NODE) {
        if (!k.textContent.trim()) return null
        const range = document.createRange()
        range.selectNodeContents(k)
        return range.getBoundingClientRect()
      }
      if (k.nodeType !== Node.ELEMENT_NODE || isScootchNode(k) || /absolute|fixed/.test(getComputedStyle(k).position)) return null
      return k.getBoundingClientRect()
    })
    .filter((k) => k && k.width > 0 && k.height > 0)
  const gap = { column: parseFloat(c.columnGap) || 0, row: parseFloat(c.rowGap) || 0 }
  const n = (p) => parseFloat(c[p]) || 0
  const content = { left: box.left + n('borderLeftWidth') + n('paddingLeft'), right: box.right - n('borderRightWidth') - n('paddingRight') }
  const bands = []
  const rows = new Set()
  for (let i = 1; i < kids.length; i++) {
    const [a, b] = [kids[i - 1], kids[i]]
    const sameLine = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0
    if (sameLine) {
      const [from, to] = b.left >= a.right - 0.5 ? [a.right, b.left] : a.left >= b.right - 0.5 ? [b.right, a.left] : [null]
      if (from == null) continue
      const w = Math.max(gap.column, grab)
      const top = Math.min(a.top, b.top)
      bands.push({ key: `c${i}`, axis: 'column', value: gap.column, rect: { left: (from + to) / 2 - w / 2, top, width: w, height: Math.max(a.bottom, b.bottom) - top } })
    } else {
      const [from, to] = b.top >= a.bottom - 0.5 ? [a.bottom, b.top] : a.top >= b.bottom - 0.5 ? [b.bottom, a.top] : [null]
      if (from == null) continue
      const mid = Math.round((from + to) / 2)
      if (rows.has(mid)) continue
      rows.add(mid)
      const h = Math.max(gap.row, grab)
      bands.push({ key: `r${i}`, axis: 'row', value: gap.row, rect: { left: content.left, top: mid - h / 2, width: content.right - content.left, height: h } })
    }
  }
  return bands
}

// The hover tag sits on top of its box, touching it (the CSS lifts it by its own height). This is the room
// it needs above: at the very top of the window it stays on screen and overlaps the box's first line.
const TAG_ROOM = 18

function Boxes({ el, kind, record }) {
  const r = useRect(el, true)
  const [drag, setDrag] = useState(null) // { box, side, value, x, y } while dragging
  const space = useMemo(() => spaceTokens(), [])
  if (!r) return null
  const c = getComputedStyle(el)
  const n = (p) => parseFloat(c[p]) || 0
  const m = { top: n('marginTop'), right: n('marginRight'), bottom: n('marginBottom'), left: n('marginLeft') }
  const p = { top: n('paddingTop'), right: n('paddingRight'), bottom: n('paddingBottom'), left: n('paddingLeft') }
  const bw = { t: n('borderTopWidth'), r: n('borderRightWidth'), b: n('borderBottomWidth'), l: n('borderLeftWidth') }
  const outer = { left: r.left - Math.max(0, m.left), top: r.top - Math.max(0, m.top), width: r.width + Math.max(0, m.left) + Math.max(0, m.right), height: r.height + Math.max(0, m.top) + Math.max(0, m.bottom) }
  const inner = { left: r.left + bw.l, top: r.top + bw.t, width: r.width - bw.l - bw.r, height: r.height - bw.t - bw.b }
  const pos = (v) => Object.fromEntries(SIDES.map((s) => [s, Math.max(0, v[s])]))
  const editable = kind === 'selected' && !!record
  const grab = editable ? GRAB : 0
  const bands = { margin: bandRects(outer, pos(m), grab, true), padding: bandRects(inner, pos(p), grab) }
  const values = { margin: m, padding: p }
  const gaps = editable ? gapBands(el, c, r, GRAB) : []

  // Where a drag lands. By default the nearest token on the space scale. With ⌘ (or Ctrl) held, or in an
  // app with no space tokens, any whole px: the way out of the scale when a value has to sit between two tokens.
  // → { value: what's written, label: what the tag by the pointer says }
  const snap = (px) => space.reduce((best, t) => (Math.abs(t.px - px) < Math.abs(best.px - px) ? t : best), space[0])
  const stop = (px, ev) => {
    if (ev?.metaKey || ev?.ctrlKey || !space.length) return { value: `${Math.round(px)}px`, label: `${Math.round(px)}px` }
    const token = snap(px)
    return { value: `var(${token.name})`, label: token.name }
  }
  const set = (box, sides, to) => {
    for (const side of sides) {
      const prop = `${box}-${side}`
      record(el, prop, to.value, { declared: declaredValue(el, prop), px: values[box][side] })
    }
  }
  const startDrag = (box, side) => (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const start = values[box][side]
    const [x0, y0] = [e.clientX, e.clientY]
    // A band's moving edge follows the cursor: margin grows outward, padding inward towards the content
    // (as in the library's SpacingScrub)
    const out = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[side]
    const sign = box === 'padding' ? out.map((n) => -n) : out
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const move = (ev) => {
      const to = stop(Math.max(0, start + (ev.clientX - x0) * sign[0] + (ev.clientY - y0) * sign[1]), ev)
      const sides = ev.shiftKey ? SIDES : ev.altKey ? [side, OPPOSITE[side]] : [side]
      set(box, sides, to)
      setDrag({ box, side, token: to.label, x: ev.clientX, y: ev.clientY })
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      setDrag(null)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  // A gap: column gaps drag sideways, row gaps up and down, and the children after it follow the cursor.
  // Shift sets both gaps.
  const setGap = (props, to) => {
    for (const prop of props) record(el, prop, to.value, { declared: declaredValue(el, prop) ?? declaredValue(el, 'gap'), px: parseFloat(c.getPropertyValue(prop)) || 0 })
  }
  const gapProps = (axis, all) => (all ? ['column-gap', 'row-gap'] : [`${axis}-gap`])
  const startGap = (g) => (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const [x0, y0] = [e.clientX, e.clientY]
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const move = (ev) => {
      const to = stop(Math.max(0, g.value + (g.axis === 'column' ? ev.clientX - x0 : ev.clientY - y0)), ev)
      setGap(gapProps(g.axis, ev.shiftKey), to)
      setDrag({ box: 'gap', side: g.axis, token: to.label, x: ev.clientX, y: ev.clientY })
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      setDrag(null)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  return (
    <div data-scootch className={`sc-boxes sc-boxes-${kind}`} data-dragging={drag ? '' : undefined}>
      {['margin', 'padding'].map((box) =>
        SIDES.map((side) => {
          const b = bands[box][side]
          if (b.width <= 0 || b.height <= 0) return null
          const v = values[box][side]
          return (
            <div
              key={`${box}-${side}`}
              className="sc-ui-scrub-band"
              data-box={box}
              data-side={side}
              data-empty={v <= 0 || undefined}
              data-edit={editable || undefined}
              data-active={(drag?.box === box && drag.side === side) || undefined}
              style={b}
              onPointerDown={editable ? startDrag(box, side) : undefined}
              onDoubleClick={editable ? () => set(box, [side], stop(0)) : undefined}
              title={editable ? `${box} ${side}: drag to change, double-click to clear. Alt: both sides, Shift: all four, ⌘: any value` : undefined}
            >
              {editable && v >= 12 && <span className="sc-ui-scrub-num">{Math.round(v)}</span>}
            </div>
          )
        }),
      )}
      {gaps.map((g) => (
        <div
          key={g.key}
          className="sc-ui-scrub-band"
          data-box="gap"
          data-side={g.axis === 'column' ? 'left' : 'top'}
          data-empty={g.value <= 0 || undefined}
          data-edit
          data-active={(drag?.box === 'gap' && drag.side === g.axis) || undefined}
          style={g.rect}
          onPointerDown={startGap(g)}
          onDoubleClick={() => setGap(gapProps(g.axis), stop(0))}
          title={`${g.axis === 'column' ? 'Column' : 'Row'} gap: drag to change, double-click to clear. Shift: both gaps, ⌘: any value`}
        >
          {g.value >= 12 && <span className="sc-ui-scrub-num">{Math.round(g.value)}</span>}
        </div>
      ))}
      <div className="sc-outline" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
      {kind === 'hover' && (
        <div className="sc-tag" style={{ left: r.left, top: Math.max(TAG_ROOM, r.top) }}>
          {describe(el).short} · {Math.round(r.width)}×{Math.round(r.height)}
        </div>
      )}
      {drag && (
        <div className="sc-ui-scrub-tag" style={{ left: drag.x + 12, top: drag.y + 12 }}>
          {drag.box === 'gap' ? `${drag.side} gap` : `${drag.box} ${drag.side}`} · {drag.token}
        </div>
      )}
    </div>
  )
}

// Hover state lives here so moving the mouse only re-renders the boxes, not the panel.
function HoverBoxes({ selected, pickable = () => true }) {
  const [hovered, setHovered] = useState(null)
  const pickableRef = useRef(pickable)
  pickableRef.current = pickable
  useEffect(() => {
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      setHovered(el && !isScootchNode(el) && el !== document.documentElement && pickableRef.current(el) ? el : null)
    }
    // Scrolling moves the page under a still pointer: let go, or the outline rides off with the element
    // and its tag is left stuck at the top of the window
    const onScroll = () => setHovered(null)
    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [])
  return hovered && hovered !== selected ? <Boxes el={hovered} kind="hover" /> : null
}

/* ---------- The panel ---------- */

function useForceUpdate() {
  const [, set] = useState(0)
  return useCallback(() => set((n) => n + 1), [])
}

// A length as a token field with its icon inside (gap, border width, radius). read is the property to show
// (one side of a shorthand); prop is the one an edit writes. display and onText: text in place of the number,
// e.g. four corners that differ ("8, 8, 0, 0"), typed back with commas.
// A length's computed px, what its CSS writes, and how that stands against the list (shared by LengthField and UnitField)
function lengthOf(el, prop, read, list) {
  const px = parseFloat(getComputedStyle(el).getPropertyValue(read)) || 0
  const declared = declaredValue(el, prop) ?? declaredValue(el, read)
  return { px, declared, st: status(declared, px, list) }
}

function LengthField({ el, prop, read = prop, label, icon, list, record, disabled, display, onText }) {
  const { px, declared, st } = lengthOf(el, prop, read, list)
  return (
    <TokenField
      label={label}
      icon={icon}
      value={px}
      display={display}
      unit={display ? '' : 'px'}
      tone={display ? 'custom' : px === 0 ? 'none' : st.kind}
      current={st.token}
      min={0}
      disabled={disabled}
      tokens={pxOptions(list)}
      onType={(v) => record(el, prop, `${v}px`, { declared, px })}
      onPick={(t) => record(el, prop, `var(${t})`, { declared, px })}
      onText={onText}
      title={`${label}: ${declared ?? 'not set'}`}
    />
  )
}

// Spacing pieces come from the library (BoxModel), fed from the element and the app's own space tokens: each
// value is its computed px, "picked" when it's written with a token (and which one). Typing records px;
// picking records the token.
const spaceSide = (el, c, prop, list) => {
  const px = Math.round((parseFloat(c.getPropertyValue(prop)) || 0) * 1000) / 1000
  const st = status(declaredValue(el, prop), px, list)
  return { value: px, picked: st.kind === 'token', token: st.kind === 'token' ? st.token : undefined }
}
const recordSpace = (el, record, prop) => (value, picked, token) => {
  const c = getComputedStyle(el)
  record(el, prop, picked && token ? `var(${token})` : `${value}px`, { declared: declaredValue(el, prop), px: parseFloat(c.getPropertyValue(prop)) || 0 })
}

// Margin → padding → content, like Webflow and the browser's inspect panel
function BoxModel({ el, record }) {
  const r = el.getBoundingClientRect()
  const c = getComputedStyle(el)
  const n = (p) => parseFloat(c[p]) || 0
  const w = r.width - n('paddingLeft') - n('paddingRight') - n('borderLeftWidth') - n('borderRightWidth')
  const h = r.height - n('paddingTop') - n('paddingBottom') - n('borderTopWidth') - n('borderBottomWidth')
  // The scale is the app's own space tokens; an app without any gets plain numbers
  const list = spaceTokens()
  const sides = (box) => Object.fromEntries(SIDES.map((side) => [side, spaceSide(el, c, `${box}-${side}`, list)]))
  const change = (box) => (side, value, picked, token) => recordSpace(el, record, `${box}-${side}`)(value, picked, token)
  return (
    <LibraryBoxModel
      margin={sides('margin')}
      padding={sides('padding')}
      content={`${Math.round(w)} × ${Math.round(h)}`}
      scale={list.length ? list.map(({ name, px }) => ({ name, px })) : null}
      onMarginChange={change('margin')}
      onPaddingChange={change('padding')}
    />
  )
}

// Which properties each section edits, so a section can undo just its own changes
const SECTION_PROPS = {
  spacing: (p) => /^(margin|padding)-/.test(p) || /^(min-|max-)?(width|height)$/.test(p),
  type: (p) => p === 'class' || ['color', 'font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'text-transform'].includes(p),
  fill: (p) => p.startsWith('background') || p === 'fill',
  border: (p) => p.startsWith('border'),
  display: (p) => p === 'display' || /^(flex|grid)-|^(justify|align)-|gap$/.test(p),
}

// Which sections are folded away, kept between visits (per browser).
// A section the element doesn't use (no fill, no border, plain block) starts folded instead, each time you pick
// an element; opening it then lasts for that element only. Whether it's used is judged when you pick the element,
// so it doesn't fold under you while you edit it.
// byElement: the element alone decides, both ways (Display: open for flex or grid, folded for block or none),
// so a fold you saved doesn't hide a layout you came to look at.
const COLLAPSED_KEY = 'scootch-collapsed'
function useCollapsed(name, el, unused = false, byElement = false) {
  const saved = () => {
    const list = store.get(COLLAPSED_KEY, [])
    return Array.isArray(list) ? list : []
  }
  const [remembered, setRemembered] = useState(() => saved().includes(name))
  const fresh = () => ({ el, unused, open: byElement && !unused })
  const [picked, setPicked] = useState(fresh)
  if (picked.el !== el) setPicked(fresh())
  const own = picked.unused || byElement // folded or opened for this element only
  const collapsed = own ? !picked.open : remembered
  const toggle = () => {
    if (own) return setPicked((p) => ({ ...p, open: !p.open }))
    setRemembered((was) => {
      const list = new Set(saved())
      was ? list.delete(name) : list.add(name)
      store.set(COLLAPSED_KEY, [...list])
      return !was
    })
  }
  return [collapsed, toggle]
}

// A section's heading: its name folds the section away (or opens it again). Once something in the section
// has changed, a reset button sits on its right.
function Heading({ children, onReset, el, unused, byElement }) {
  const ref = useRef(null)
  const [collapsed, toggle] = useCollapsed(String(children), el, unused, byElement)
  useLayoutEffect(() => {
    ref.current?.parentElement?.toggleAttribute('data-collapsed', collapsed)
  }, [collapsed])
  // The whole row folds the section; the chevron on the right points up when open, down when folded.
  // Reset sits before the chevron and only resets (it doesn't fold)
  return (
    <h4 ref={ref} className="sc-heading" onClick={toggle}>
      <button
        className="sc-fold"
        aria-expanded={!collapsed}
        title={collapsed ? `Show ${children}` : `Hide ${children}`}
        onClick={(e) => (e.stopPropagation(), toggle())}
      >
        {children}
      </button>
      {onReset && (
        <button
          className="sc-reset"
          title={`Reset ${children}`}
          aria-label={`Reset ${children}`}
          onClick={(e) => (e.stopPropagation(), onReset())}
        >
          <ArrowCounterClockwise size={14} />
          Reset
        </button>
      )}
      <span className="sc-fold-icon" aria-hidden>
        <CaretDown size={14} />
      </span>
    </h4>
  )
}

// Width and height, and their limits (min, max), under the box model: one row, W and H. A limit that is
// set shows under them by itself; the + at the end of the row shows the rest, to add one.
// A size written as a plain length
// shows as its number in px; anything else shows as it's written ("100%", "fit-content", "none"), with the
// px it comes to in the tooltip. A size nobody wrote shows what the browser worked out, greyed.
// Typing a number writes px; typing any other CSS size ("50%", "auto", "none") writes that.
const SIZES = [
  ['width', 'W', 'Width'],
  ['height', 'H', 'Height'],
]
const SIZE_LIMITS = [
  ['min-width', 'Min W', 'Min width'],
  ['min-height', 'Min H', 'Min height'],
  ['max-width', 'Max W', 'Max width'],
  ['max-height', 'Max H', 'Max height'],
]
function SizeField({ el, prop, short, label, list, record }) {
  const c = getComputedStyle(el)
  const computed = c.getPropertyValue(prop) // "320px", or a keyword: auto, none, 50%
  const box = el.getBoundingClientRect()
  // width and height compute to "auto" on an inline element: measure it
  const px = /px$/.test(computed) ? parseFloat(computed) : prop === 'width' ? box.width : prop === 'height' ? box.height : null
  const declared = declaredValue(el, prop)
  const plain = !declared || /^-?[\d.]+px$/.test(declared) || /^var\(/.test(declared)
  const display = px === null ? (declared ?? computed) : plain ? undefined : declared
  const st = status(declared, px, list)
  const from = { declared, px, raw: computed }
  return (
    <TokenField
      label={label}
      icon={<span className="sc-size-label">{short}</span>}
      value={px === null ? 0 : Math.round(px * 100) / 100}
      display={display}
      unit={display ? '' : 'px'}
      tone={!declared ? 'none' : display ? 'custom' : st.kind}
      current={st.token}
      min={0}
      tokens={pxOptions(list)}
      onType={(v) => record(el, prop, `${v}px`, from)}
      onPick={(t) => record(el, prop, `var(${t})`, from)}
      onText={(text) => {
        const value = text.trim()
        // A bare number is px: left to onType
        if (!value || /^-?[\d.]+(px)?$/.test(value) || !CSS.supports(prop, value)) return false
        // Enter and then leaving the field both commit: the second time it's already written
        if (declaredValue(el, prop) === value) return true
        record(el, prop, value, from)
        return true
      }}
      title={`${label}: ${declared ?? 'not set'}${px !== null && display ? ` (${Math.round(px * 100) / 100}px)` : ''}`}
    />
  )
}
function SizeFields({ el, record }) {
  const list = spaceTokens()
  // Showing every limit is for this element only: picking another starts from one row again
  const [more, setMore] = useState({ el, all: false })
  if (more.el !== el) setMore({ el, all: false })
  const set = SIZE_LIMITS.filter(([prop]) => declaredValue(el, prop))
  const shown = more.all ? SIZE_LIMITS : set
  const rows = [SIZES, ...shown.flatMap((_, i) => (i % 2 ? [] : [shown.slice(i, i + 2)]))]
  return rows.map((row, i) => (
    <div key={row[0][0]} className="sc-size-row">
      {row.map(([prop, short, label]) => (
        <SizeField key={prop} el={el} prop={prop} short={short} label={label} list={list} record={record} />
      ))}
      {/* The last cell: the + on the first row (unless every limit is set already), and its width kept
          free on the others, so the fields line up */}
      {i === 0 && set.length < SIZE_LIMITS.length ? (
        <button
          className="sc-icon"
          aria-expanded={more.all}
          title={more.all ? 'Hide the limits that aren’t set' : 'Min and max width and height'}
          aria-label={more.all ? 'Hide the limits that aren’t set' : 'Show min and max width and height'}
          onClick={() => setMore({ el, all: !more.all })}
        >
          {more.all ? <Minus size={14} /> : <Plus size={14} />}
        </button>
      ) : (
        <span className="sc-size-end" aria-hidden />
      )}
    </div>
  ))
}

// Margin, padding and size, open whenever the element has any and folded when it has none (byElement), so a fold
// saved on another element never hides spacing you came to look at. Gap lives in Display: it only exists on a flex or grid box and follows its direction
function SpacingSection({ el, record, onReset }) {
  const c = getComputedStyle(el)
  // Nothing to see: no margin or padding, and no size written for it
  const unused =
    SIDES.every((s) => !parseFloat(c.getPropertyValue(`margin-${s}`)) && !parseFloat(c.getPropertyValue(`padding-${s}`))) &&
    [...SIZES, ...SIZE_LIMITS].every(([prop]) => !declaredValue(el, prop))
  return (
    <section className="sc-section">
      <Heading onReset={onReset} el={el} unused={unused} byElement>Spacing</Heading>
      <BoxModel el={el} record={record} />
      <SizeFields el={el} record={record} />
    </section>
  )
}

// A type length (size, line height) in px, rem or em. It starts in the unit the CSS was written in, and shows
// the computed size in it. Picking another unit keeps the size (16px → 1rem); typing one ("1rem") switches to it.
const TYPE_UNITS = ['px', 'rem', 'em']
function UnitField({ el, prop, label, icon, list, record, disabled }) {
  const { px, declared, st } = lengthOf(el, prop, prop, list)
  const written = declared?.match(/\d(px|rem|em)\s*$/)?.[1]
  const [unit, setUnit] = useState(written ?? 'px')
  // What 1 of each unit is here: rem the root's font size, em the parent's for font-size and the element's own otherwise
  const perUnit = (u) =>
    u === 'rem'
      ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      : u === 'em'
        ? parseFloat(getComputedStyle(prop === 'font-size' ? el.parentElement ?? el : el).fontSize) || 16
        : 1
  const inUnit = (v, u) => Math.round((v / perUnit(u)) * 1000) / 1000
  const set = (v, u) => record(el, prop, `${v}${u}`, { declared, px })
  return (
    <TokenField
      label={label}
      icon={icon}
      value={inUnit(px, unit)}
      unit={unit}
      units={TYPE_UNITS}
      tokenUnit="px"
      step={unit === 'px' ? 1 : 0.0625}
      tone={px === 0 ? 'none' : st.kind}
      current={st.token}
      disabled={disabled}
      tokens={pxOptions(list)}
      onType={(v, typed) => {
        if (typed) setUnit(typed)
        set(v, typed ?? unit)
      }}
      onUnit={(u) => {
        setUnit(u)
        set(inUnit(px, u), u)
      }}
      onPick={(t) => record(el, prop, `var(${t})`, { declared, px })}
      title={`${label}: ${declared ?? 'not set'}`}
    />
  )
}

function TypeSection({ el, record, onReset }) {
  const styles = useMemo(() => typeStyles(), [])
  const sizes = useMemo(() => pxTokens('fontSize'), [])
  const lines = useMemo(() => pxTokens('lineHeight'), [])
  const weights = useMemo(() => weightTokens(), [])
  const tracking = useMemo(() => trackingTokens(), [])
  // The font: the app's font tokens first, then every font the project has added, to break out of them
  const fontList = useMemo(() => ({ tokens: fontTokens(), project: projectFonts() }), [])

  const c = getComputedStyle(el)
  const used = typeClassOf(el)
  const matching = styles.find(
    (t) =>
      t.fontSize === c.fontSize &&
      t.lineHeight === c.lineHeight &&
      t.fontWeight === c.fontWeight &&
      t.letterSpacing === c.letterSpacing &&
      t.fontFamily === c.fontFamily,
  )
  const styleState = used
    ? { kind: 'token', token: `.${used.cls}${used.own || used.here ? '' : ' (inherited)'}` }
    : matching
      ? { kind: 'matches', token: `.${matching.cls}` }
      : { kind: 'rogue' }

  const swapClass = (cls) => record(el, 'class', cls, { declared: used ? `.${used.cls}` : null })

  // A type style sets size, line height, weight, tracking and case, so while one is attached those are
  // greyed out. Detach writes its values onto the element (it looks the same) and takes the class off,
  // so each can be changed on its own. A class on the element itself always locks them; one inherited
  // from a parent stops locking once the element has its own size (it's been detached).
  const locked = !!used && (used.own || !el.style.getPropertyValue('font-size'))
  const FROM_STYLE = ['font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'text-transform']
  const detach = () => {
    const values = FROM_STYLE.map((p) => [p, c.getPropertyValue(p)])
    for (const [p, v] of values) record(el, p, v, { declared: declaredValue(el, p), raw: v })
    if (used?.own) record(el, 'class', '', { declared: `.${used.cls}` })
  }

  const transform = c.textTransform === 'uppercase' ? 'uppercase' : 'none'

  const family = firstFamily(c.fontFamily)
  const fontDecl = declaredValue(el, 'font-family')
  const fontState = fontDecl
    ? matchState(fontDecl, fontList.tokens.find((t) => firstFamily(t.value) === family))
    : { kind: 'none' }
  // A font picked by name keeps the kind of fallback the element had (serif, monospace…)
  const fallback = c.fontFamily.split(',').pop().trim()
  const pickFont = (name) =>
    record(el, 'font-family', name.startsWith('--') ? `var(${name})` : `"${name}", ${/^[a-z-]+$/.test(fallback) && fallback !== name ? fallback : 'sans-serif'}`, {
      declared: fontDecl,
      raw: c.fontFamily,
    })

  const weightDecl = declaredValue(el, 'font-weight')
  const weightState = matchState(weightDecl, weights.find((w) => w.value === c.fontWeight))

  const trackDecl = declaredValue(el, 'letter-spacing')
  const fontPx = parseFloat(c.fontSize) || 1
  const trackEm = c.letterSpacing === 'normal' ? 0 : Math.round((parseFloat(c.letterSpacing) / fontPx) * 1000) / 1000
  const trackState = matchState(trackDecl, tracking.find((t) => Math.abs((parseFloat(t.value) || 0) - trackEm) < 0.001))

  // One field for both: every type style (a named composite), then every font — the app's font tokens
  // and the fonts the project has added. Picking a style swaps its class; picking a font sets the family,
  // detaching a locked style first so the font takes.
  const styleItems = styles.map((t) => ({ name: t.cls, label: `${parseFloat(t.fontSize)}/${parseFloat(t.lineHeight)}`, group: 'Type styles' }))
  const fontItems = [
    ...fontList.tokens.map((t) => ({ name: t.name, label: firstFamily(t.value), group: 'Typefaces' })),
    ...fontList.project.map((name) => ({ name, label: 'Project font', group: 'Typefaces' })),
  ]
  const typeAndFont = [...styleItems, ...fontItems]
  const styleNames = new Set(styleItems.map((t) => t.name))
  const hasStyle = !!(used || matching)
  const styleDisplay = used ? `.${used.cls}${used.own || used.here ? '' : ' (inherited)'}` : matching ? `matches .${matching.cls}` : 'none'
  const pickStyleOrFont = (name) => {
    if (styleNames.has(name)) return swapClass(name)
    if (locked) detach()
    pickFont(name)
  }

  return (
    <section className="sc-section">
      <Heading onReset={onReset}>Type</Heading>
      {/* Laid out like the library's Text Controls: style, weight, size and line, case and tracking, colour */}
      <div className="sc-type">
        <TokenField
          label="Type style or font"
          icon={<Type size={14} />}
          value={null}
          display={hasStyle ? styleDisplay : family}
          tone={hasStyle ? styleState.kind : fontState.kind}
          current={used ? used.cls : matching ? matching.cls : fontState.token ?? family}
          tokens={typeAndFont}
          onPick={pickStyleOrFont}
          onDetach={locked ? detach : undefined}
          title={used?.css ? `Set in CSS: font: var(--${used.cls})` : used ? `Uses .${used.cls}` : matching ? `Its values match .${matching.cls}, but the class isn't applied` : `font-family: ${fontDecl ?? c.fontFamily}${fontDecl ? '' : ' (inherited)'}`}
        />
        <TokenField
          label="Weight"
          icon={<Bold size={14} />}
          value={parseFloat(c.fontWeight) || 400}
          step={100}
          disabled={locked}
          tone={weightState.kind}
          current={weightState.token}
          tokens={weights.map((w) => ({ name: w.name, label: w.value }))}
          onType={(v) => record(el, 'font-weight', String(v), { declared: weightDecl, raw: c.fontWeight })}
          onPick={(t) => record(el, 'font-weight', `var(${t})`, { declared: weightDecl, raw: c.fontWeight })}
          title={`font-weight: ${weightDecl ?? c.fontWeight}`}
        />
        <div className="sc-pair">
          <UnitField el={el} prop="font-size" label="Size" icon={<ALargeSmall size={14} />} list={sizes} record={record} disabled={locked} />
          <UnitField el={el} prop="line-height" label="Line height" icon={<LineHeight size={14} />} list={lines} record={record} disabled={locked} />
        </div>
        <div className="sc-pair">
          <div className="sc-case">
            <SegmentedControl
              aria-label="Capitalisation"
              value={transform}
              disabled={locked}
              options={[
                { value: 'none', label: 'Aa' },
                { value: 'uppercase', label: 'AA' },
              ]}
              onValueChange={(v) => record(el, 'text-transform', v, { declared: declaredValue(el, 'text-transform'), raw: c.textTransform })}
            />
          </div>
          <TokenField
            label="Tracking"
            icon={<LetterSpacing size={14} />}
            value={trackEm}
            step={0.005}
            disabled={locked}
            unit="em"
            tone={trackEm === 0 ? 'none' : trackState.kind}
            current={trackState.token}
            tokens={tracking.map((t) => ({ name: t.name, label: t.value }))}
            onType={(v) => record(el, 'letter-spacing', `${v}em`, { declared: trackDecl, raw: c.letterSpacing })}
            onPick={(t) => record(el, 'letter-spacing', `var(${t})`, { declared: trackDecl, raw: c.letterSpacing })}
            title={`letter-spacing: ${trackDecl ?? c.letterSpacing}`}
          />
        </div>
        <ColourField el={el} prop="color" value={c.color} label="Colour" record={record} />
      </div>
    </section>
  )
}

// A computed colour as hex, like the picker: rgb(255, 34, 34) → #ff2222, with alpha when it's see-through.
// Anything that isn't rgb (oklch, color()) stays as it is.
const hexOf = (value) => {
  const m = value?.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/)
  if (!m) return value
  const byte = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  const alpha = m[4] === undefined || Number(m[4]) >= 1 ? '' : byte(Number(m[4]) * 255)
  return `#${byte(+m[1])}${byte(+m[2])}${byte(+m[3])}${alpha}`
}

// A colour as a token field (Type, Fill and Border): the token's name or the raw colour, with its swatch.
// value: the computed colour. empty: nothing to show (no fill, no border line), so it reads as none.
// Picking records the token, the colour picker the raw colour.
function ColourField({ el, prop, value, label, empty = false, record }) {
  const colours = useMemo(() => colourTokens(), [])
  const declared = declaredValue(el, prop)
  const state = matchState(declared, colours.find((t) => t.rgb === value))
  return (
    <TokenField
      label={label}
      value={null}
      display={empty ? 'none' : state.token ? state.token.replace(/^--/, '') : hexOf(value)}
      swatch={empty ? undefined : value}
      tone={empty ? 'none' : state.kind}
      current={state.token}
      tokens={colours.map((t) => ({ name: t.name, label: '', swatch: `var(${t.name})` }))}
      onPick={(t) => record(el, prop, `var(${t})`, { declared, raw: value })}
      onColour={(v) => record(el, prop, v, { declared, raw: value })}
    />
  )
}

// Fill: the background colour (a gradient or image is shown, not edited). An SVG shape has no background:
// its fill is the SVG fill property, so that is what shows and what a change sets.
function FillSection({ el, record, onReset }) {
  const c = getComputedStyle(el)
  const svg = el instanceof SVGElement
  const paint = svg ? c.fill : c.backgroundColor
  const colour = /^(rgb|#|color\()/.test(paint) ? paint : 'rgba(0, 0, 0, 0)' // none, or a gradient or pattern by url()
  const bg = colour
  const image = svg ? (paint.startsWith('url(') ? paint : null) : c.backgroundImage !== 'none' ? c.backgroundImage : null
  const clear = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent'

  return (
    <section className="sc-section">
      <Heading onReset={onReset} el={el} unused={clear && !image}>Fill</Heading>
      {/* Laid out like the other colour fields (Type, Border): the heading says what it is, so no label */}
      <ColourField el={el} prop={svg ? 'fill' : 'background-color'} value={bg} label="Fill colour" empty={clear} record={record} />
      {image && (
        <div className="sc-row" title={image}>
          <span className="sc-label">image</span>
          <span className="sc-fill-image">{image.startsWith('url(') ? 'image' : image.split('(')[0]}</span>
        </div>
      )}
    </section>
  )
}

const same = (values) => values.every((v) => v === values[0])

// Border: which sides (the library's side picker), style, colour, then width and radius. Picking one side
// makes the edits that side's; the radius takes "8, 8, 0, 0" (from top left, like CSS) for corners that differ.
const BORDER_STYLES = [
  ['none', X, 'None'],
  ['solid', LineSolid, 'Solid'],
  ['dashed', LineDashed, 'Dashed'],
  ['dotted', LineDotted, 'Dotted'],
]
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
const hasLine = (c, side) => parseFloat(c.getPropertyValue(`border-${side}-width`)) > 0 && c.getPropertyValue(`border-${side}-style`) !== 'none'
// The side it has a border on, if just one; otherwise all of them
const sideOf = (el) => {
  const c = getComputedStyle(el)
  const on = SIDES.filter((side) => hasLine(c, side))
  return on.length === 1 ? on[0] : 'all'
}
const cornersFrom = (text) => {
  const n = text.split(/[\s,]+/).filter(Boolean).map(Number)
  if (n.length < 2 || n.length > 4 || n.some((v) => !Number.isFinite(v) || v < 0)) return null
  const [tl, tr = tl, br = tl, bl = tr] = n
  return [tl, tr, br, bl]
}

function BorderSection({ el, record, onReset }) {
  const widths = useMemo(() => pxTokens('borderWidth'), [])
  const radii = useMemo(() => pxTokens('radius'), [])
  const [side, setSide] = useState(() => sideOf(el))
  useEffect(() => setSide(sideOf(el)), [el])
  const c = getComputedStyle(el)
  const shown = side === 'all' ? 'top' : side // what the fields show: that side, or the top for all
  const pre = side === 'all' ? 'border' : `border-${side}` // what an edit writes
  const lined = hasLine(c, shown)
  // No line shows as none, whatever the style says: base styles give every element a solid style at width 0
  const style = lined ? c.getPropertyValue(`border-${shown}-style`) : 'none'
  const colour = c.getPropertyValue(`border-${shown}-color`)
  const bare = SIDES.every((s) => !hasLine(c, s)) // no border on any side: the side picker shows nothing picked
  const corners = CORNERS.map((k) => Math.round((parseFloat(c.getPropertyValue(`border-${k}-radius`)) || 0) * 100) / 100)
  const mixed = !same(corners)
  const rec = (prop, to, raw) => record(el, prop, to, { declared: declaredValue(el, prop), raw })

  return (
    <section className="sc-section">
      <Heading onReset={onReset} el={el} unused={bare && corners.every((r) => r === 0)}>Border</Heading>
      <div className="sc-beside">
        <SidePicker value={side} onValueChange={setSide} empty={bare} />
        <div className="sc-stack">
          <SegmentedControl
            aria-label="Style"
            value={style}
            options={BORDER_STYLES.map(([value, Icon, name]) => ({ value, label: <Icon size={16} aria-label={name} /> }))}
            onValueChange={(v) => {
              rec(`${pre}-style`, v, style)
              // Picking a line where there's none gives it the 1px line width, so it shows
              if (!lined && v !== 'none') rec(`${pre}-width`, 'var(--border-width)', c.getPropertyValue(`border-${shown}-width`))
            }}
          />
          <ColourField el={el} prop={`${pre}-color`} value={colour} label="Colour" empty={!lined} record={record} />
          <div className="sc-pair">
            <LengthField el={el} prop={`${pre}-width`} read={`border-${shown}-width`} label="Width" icon={<Minus size={14} />} list={widths} record={record} disabled={style === 'none'} />
            <LengthField
              el={el}
              prop="border-radius"
              read="border-top-left-radius"
              label="Radius"
              icon={<CornerRadius size={14} />}
              list={radii}
              record={record}
              display={mixed ? corners.join(', ') : undefined}
              onText={(text) => {
                const n = cornersFrom(text)
                if (n) rec('border-radius', n.map((v) => `${v}px`).join(' '), corners.map((v) => `${v}px`).join(' '))
                return !!n
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// Display: block, flex, grid or none. Flex and grid get the anchor grid (where the children sit) with three rows
// beside it: direction (with reverse and wrap), spread and the gaps; or, for a grid, flow, its column and row counts
// and the gaps.
// Spread is Packed, Between or Around: start, centre and end are the anchor grid's job.
// Flex: the grid's across is justify in a row (down in a column), and a reversed direction flips it so the dot
// shows where the children are; while they spread, the line they spread along fills and only the other axis
// is a choice. Grid: it places each item in its cell.
const ANCHOR_ROWS = ['top', '', 'bottom']
const ANCHOR_COLS = ['left', '', 'right']
const POS = ['start', 'center', 'end']
const FLEX_POS = ['flex-start', 'center', 'flex-end']
const SPREAD = [
  ['packed', JustifyPacked, 'Packed'],
  ['between', JustifyBetween, 'Space between'],
  ['around', JustifyAround, 'Space around'],
]

// flex-start, start, left, normal… → start / center / end
const toPos = (v) => (/center/.test(v) ? 'center' : /end|right/.test(v) ? 'end' : 'start')
const toJustify = (v) => (/between/.test(v) ? 'space-between' : /around|evenly/.test(v) ? 'space-around' : FLEX_POS[POS.indexOf(toPos(v))])
const anchorAt = (x, y) => [ANCHOR_ROWS[y], ANCHOR_COLS[x]].filter(Boolean).join('-') || 'center'
const anchorXY = (a) => [a.includes('left') ? 0 : a.includes('right') ? 2 : 1, a.startsWith('top') ? 0 : a.startsWith('bottom') ? 2 : 1]
// How many tracks a computed grid-template has (0 for none)
const tracks = (v) => (!v || v === 'none' ? 0 : v.replace(/\[[^\]]*\]/g, '').trim().split(/\s+/).filter(Boolean).length)
const iconOption = (value, Icon, name) => ({ value, label: <Icon size={14} aria-label={name} /> })

function DisplaySection({ el, record, onReset }) {
  const space = useMemo(() => spaceTokens(), [])
  const c = getComputedStyle(el)
  const rec = (prop, to) => record(el, prop, to, { declared: declaredValue(el, prop), raw: c.getPropertyValue(prop) })
  const inline = c.display.startsWith('inline')
  const kind = c.display === 'none' ? 'none' : c.display.includes('grid') ? 'grid' : c.display.includes('flex') ? 'flex' : 'block'
  const grid = kind === 'grid'
  const layout = grid || kind === 'flex'

  const column = !grid && c.flexDirection.startsWith('column')
  const reverse = !grid && c.flexDirection.endsWith('reverse')
  const wrap = !grid && c.flexWrap !== 'nowrap'
  const justify = toJustify(c.justifyContent)
  const spread = justify.startsWith('space')
  const flip = (i) => (reverse ? 2 - i : i)
  const main = spread ? 1 : flip(POS.indexOf(toPos(c.justifyContent)))
  const cross = POS.indexOf(toPos(c.alignItems))
  const anchor = grid ? anchorAt(POS.indexOf(toPos(c.justifyItems)), cross) : column ? anchorAt(cross, main) : anchorAt(main, cross)
  const pickAnchor = (a) => {
    const [x, y] = anchorXY(a)
    if (grid) return rec('justify-items', POS[x]), rec('align-items', POS[y])
    const [m, k] = column ? [y, x] : [x, y]
    if (!spread) rec('justify-content', FLEX_POS[flip(m)])
    rec('align-items', FLEX_POS[k])
  }
  const cols = tracks(c.gridTemplateColumns)
  const rows = tracks(c.gridTemplateRows)
  const flow = c.gridAutoFlow.startsWith('column') ? 'column' : 'row'
  // The gap along the main axis first: a row's runs across, a column's down. A second only when there are two.
  const across = !column
  const gap = (prop) => (
    <LengthField
      key={prop}
      el={el}
      prop={prop}
      label={prop === 'column-gap' ? 'Column gap' : 'Row gap'}
      icon={prop === 'column-gap' ? <GapHorizontal size={14} /> : <GapVertical size={14} />}
      list={space}
      record={record}
    />
  )
  const gaps = across ? ['column-gap', 'row-gap'] : ['row-gap', 'column-gap']

  return (
    <section className="sc-section">
      <Heading onReset={onReset} el={el} unused={kind === 'block' || kind === 'none'} byElement>
        Display
      </Heading>
      <SegmentedControl
        aria-label="Display"
        value={kind}
        options={['block', 'flex', 'grid', 'none'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
        onValueChange={(v) => rec('display', v === 'none' ? 'none' : `${inline ? 'inline-' : ''}${v}`)}
      />
      {layout && (
        <div className="sc-beside" title={`justify-content: ${c.justifyContent}; align-items: ${c.alignItems}`}>
          <AnchorGrid value={anchor} onValueChange={pickAnchor} spread={spread && !grid ? (column ? 'y' : 'x') : undefined} />
          <div className="sc-stack">
            {grid ? (
              <>
                {/* Grid: flow across the row, then columns and rows side by side where the spread sits for flex.
                    Spreading does nothing here: the columns are equal 1fr tracks, so they always fill the width */}
                <SegmentedControl
                  aria-label="Flow"
                  value={flow}
                  options={[iconOption('row', ArrowRight, 'Fill rows'), iconOption('column', ArrowDown, 'Fill columns')]}
                  onValueChange={(v) => rec('grid-auto-flow', v)}
                />
                <div className="sc-gaps">
                  <NumberField label={<Columns size={14} />} aria-label="Columns" value={cols} min={1} max={12} onValueChange={(n) => n && rec('grid-template-columns', `repeat(${n}, minmax(0, 1fr))`)} />
                  <NumberField label={<Rows size={14} />} aria-label="Rows (0 is as many as it needs)" value={rows} min={0} max={12} onValueChange={(n) => n !== null && rec('grid-template-rows', n ? `repeat(${n}, auto)` : 'none')} />
                </div>
              </>
            ) : (
              <>
                <div className="sc-quarters">
                  <SegmentedControl
                    aria-label="Direction"
                    value={column ? 'column' : 'row'}
                    options={[iconOption('row', ArrowRight, 'Row'), iconOption('column', ArrowDown, 'Column')]}
                    onValueChange={(v) => rec('flex-direction', `${v}${reverse ? '-reverse' : ''}`)}
                  />
                  <Button variant="secondary" icon={ArrowLeftRight} aria-label="Reverse" aria-pressed={reverse} data-active={reverse || undefined} onClick={() => rec('flex-direction', `${column ? 'column' : 'row'}${reverse ? '' : '-reverse'}`)} />
                  <Button variant="secondary" icon={WrapText} aria-label="Wrap" aria-pressed={wrap} data-active={wrap || undefined} onClick={() => rec('flex-wrap', wrap ? 'nowrap' : 'wrap')} />
                </div>
                {/* Drawn along a row; turned a quarter for a column, so they point the way the items spread.
                    Packed goes back to the start; the anchor grid moves them from there */}
                <div className="sc-spread" data-dir={column ? 'column' : 'row'}>
                  <SegmentedControl
                    aria-label="Spread"
                    value={justify === 'space-between' ? 'between' : justify === 'space-around' ? 'around' : 'packed'}
                    options={SPREAD.map(([v, Icon, name]) => iconOption(v, Icon, name))}
                    onValueChange={(v) => rec('justify-content', v === 'packed' ? FLEX_POS[flip(0)] : `space-${v}`)}
                  />
                </div>
              </>
            )}
            <div className="sc-gaps">{grid || wrap ? gaps.map(gap) : gap(gaps[0])}</div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------- Changes: copy or send ---------- */

// Changes in one group per element, in the order each element was first changed
function groupByEl(changes) {
  const groups = []
  for (const ch of changes) {
    const g = groups.find((x) => x.el === ch.el)
    if (g) g.list.push(ch)
    else groups.push({ el: ch.el, list: [ch], at: ch.at })
  }
  return groups
}

// A change's property and new value as they read in notes: a type class change is "type style: .text-body"
const propLabel = (ch) => (ch.prop === 'class' ? 'type style' : ch.prop)
const toLabel = (ch) => (ch.prop === 'class' ? (ch.to ? `.${ch.to}` : 'detached') : ch.to)

function changesText(changes) {
  const lines = []
  let i = 1
  for (const { el, list } of groupByEl(changes)) {
    const d = describe(el)
    const comps = componentPath(el)
    lines.push(`${i++}. ${comps.length ? comps.join(' › ') + ' — ' : ''}${d.short}${d.text ? ` "${d.text}"` : ''}`)
    lines.push(`   path: ${cssPath(el)}`)
    for (const ch of list) {
      const from = ch.prop === 'class' ? ch.from ?? 'no type class' : `${ch.from ?? 'not set'}${ch.fromValue ? ` (${ch.fromValue})` : ''}`
      lines.push(`   - ${propLabel(ch)}: ${from} → ${toLabel(ch)}`)
    }
  }
  return lines.join('\n')
}

/* ---------- Root ---------- */

// The Scootch pill can be picked up and moved while Scootch is closed. A press that moves more
// than a few pixels drags it; a plain click still opens Scootch. It stays inside the window and
// remembers where you left it (in this browser). Its spot is kept as the distance from the right and
// bottom edges.
// The panel opens from wherever the pill is and takes its place (the pill hides while it's open): from the
// pill's top down when the pill sits in the top half of the window, from its bottom up in the bottom half,
// and on the pill's side (left or right). In the home corner that's the CSS default: the right edge, full height.
const PILL_KEY = 'scootch-pill-corner'
const DRAG_THRESHOLD = 4
const EDGE = 8 // dragged freely, the pill and the panel keep this much of the window around them
// At home, the pill and the panel sit this far from the window's edges: the pill a little further in
// than the panel. The CSS has the same two numbers (--sc-edge in scootch.css): change both together.
const PILL_EDGE = 12
const PANEL_EDGE = 8
const PANEL_WIDTH = 344 // floating; fixed (--size-344 in the CSS)
// The window without its scrollbars: what CSS right / bottom measure from
const viewport = () => ({ W: document.documentElement.clientWidth, H: document.documentElement.clientHeight })

// inset: the rulers' thickness (top and left) when they're on, so the panel starts past them
function panelPlacement(pillEl, inset = 0) {
  if (!pillEl) return null
  const r = pillEl.getBoundingClientRect()
  const { W, H } = viewport()
  const fromTop = r.top + r.height / 2 < H / 2
  const fromLeft = r.left + r.width / 2 < W / 2
  const leftEdge = PANEL_EDGE + inset
  // A pill at the window's edge (its own distance or closer) opens the panel at the panel's distance
  const from = (gap, edge = PANEL_EDGE) => (gap <= PILL_EDGE + (edge - PANEL_EDGE) ? edge : gap)
  const side = fromLeft
    ? Math.min(from(r.left, leftEdge), Math.max(leftEdge, W - PANEL_WIDTH - PANEL_EDGE))
    : Math.min(from(W - r.right), Math.max(PANEL_EDGE, W - PANEL_WIDTH - leftEdge))
  return {
    top: fromTop ? from(r.top, PANEL_EDGE + inset) : PANEL_EDGE + inset,
    bottom: fromTop ? PANEL_EDGE : from(H - r.bottom),
    left: fromLeft ? side : 'auto',
    right: fromLeft ? 'auto' : side,
  }
}
// Its homes: the bottom-right corner (the CSS default: PILL_EDGE from the right and bottom) and the top-right
// one. Dropped this close to either, it snaps there. The top one is kept as a distance from the top, so
// it stays put when the window changes height.
const HOME = { right: PILL_EDGE, bottom: PILL_EDGE }
const HOME_TOP = { right: PILL_EDGE, top: PILL_EDGE }
const SNAP = 72
const SNAP_MS = 260 // the glide home (--dur-standard), then the spot is kept as that home

// A spot's distance from the bottom, whichever way it's kept
const bottomOf = (p, h) => (p.top !== undefined ? viewport().H - p.top - h : p.bottom)

// Which home a drop here would snap to: 'bottom', 'top' or none
function homeNear(p, el) {
  if (!p) return null
  const h = el?.offsetHeight ?? 0
  const bottom = bottomOf(p, h)
  const top = viewport().H - bottom - h
  if (Math.hypot(p.right - HOME.right, bottom - HOME.bottom) < SNAP) return 'bottom'
  if (Math.hypot(p.right - HOME_TOP.right, top - HOME_TOP.top) < SNAP) return 'top'
  return null
}

function clampToWindow(p, el) {
  const w = el?.offsetWidth ?? 0
  const h = el?.offsetHeight ?? 0
  const { W, H } = viewport()
  const right = Math.min(Math.max(EDGE, p.right), W - w - EDGE)
  if (p.top !== undefined) return { right, top: Math.min(Math.max(EDGE, p.top), H - h - EDGE) }
  return { right, bottom: Math.min(Math.max(EDGE, p.bottom), H - h - EDGE) }
}

function useMovablePill(enabled) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null) // null: the default corner from the CSS; else { right, bottom } or { right, top }
  const [dragging, setDragging] = useState(false)
  const [snapping, setSnapping] = useState(false)
  const drag = useRef(null)
  const moved = useRef(false)

  useEffect(() => {
    // Nothing saved (or storage blocked): the default corner. The top home is saved by name, so it
    // follows PILL_EDGE when that changes.
    const saved = store.get(PILL_KEY, null)
    if (saved === 'top') return setPos(HOME_TOP)
    if (saved && Number.isFinite(saved.right) && (Number.isFinite(saved.bottom) || Number.isFinite(saved.top))) setPos(clampToWindow(saved, ref.current))
  }, [])

  // Keep it on screen when the window shrinks
  useEffect(() => {
    if (!pos) return
    const onResize = () => setPos((p) => (p ? clampToWindow(p, ref.current) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pos])

  const onPointerDown = (e) => {
    if (!enabled || e.button !== 0) return
    const r = ref.current.getBoundingClientRect()
    // How far the pointer is from the pill's right and bottom edges
    drag.current = { startX: e.clientX, startY: e.clientY, offX: r.right - e.clientX, offY: r.bottom - e.clientY, id: e.pointerId }
    moved.current = false
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    if (!moved.current) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return
      moved.current = true
      setDragging(true)
      ref.current.setPointerCapture?.(d.id)
    }
    // While dragging it's always kept from the bottom, so the glide home can animate right and bottom
    const { W, H } = viewport()
    setPos(clampToWindow({ right: W - (e.clientX + d.offX), bottom: H - (e.clientY + d.offY) }, ref.current))
  }
  const remember = (p) => (p ? store.set(PILL_KEY, p) : store.remove(PILL_KEY))
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    if (moved.current) {
      setDragging(false)
      const home = homeNear(pos, ref.current)
      if (home) {
        // Glide into the corner, then keep the spot as that corner (the CSS default for the bottom one)
        const h = ref.current?.offsetHeight ?? 0
        setSnapping(true)
        setPos(home === 'top' ? { right: HOME_TOP.right, bottom: viewport().H - HOME_TOP.top - h } : HOME)
        setTimeout(() => {
          setSnapping(false)
          setPos(home === 'top' ? HOME_TOP : null)
        }, SNAP_MS)
        remember(home === 'top' ? 'top' : null)
        return
      }
      remember(pos)
    }
  }
  // A drag ends with a click event: swallow it so Scootch doesn't open
  const wasDrag = () => {
    const was = moved.current
    moved.current = false
    return was
  }
  const style = !pos ? undefined : pos.top !== undefined ? { right: pos.right, top: pos.top, left: 'auto', bottom: 'auto' } : { right: pos.right, bottom: pos.bottom, left: 'auto', top: 'auto' }
  return {
    ref,
    pos,
    style,
    dragging,
    snapping,
    // While dragging, show both homes; the one a drop would snap to lights up
    homes: dragging ? { near: homeNear(pos, ref.current), width: ref.current?.offsetWidth ?? 0, height: ref.current?.offsetHeight ?? 0 } : null,
    wasDrag,
    // Back to the default corner (the panel was dropped on its home)
    goHome: () => {
      setPos(null)
      remember(null)
    },
    // Put it somewhere (where the panel was dragged to, on close) and remember it
    moveTo: (p) => {
      const c = clampToWindow(p, ref.current)
      setPos(c)
      remember(c)
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}

// A setting remembered in this browser
function usePersisted(key, initial) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    // Nothing saved (or storage blocked): keep the default
    const saved = store.get(key, undefined)
    if (saved !== undefined) setValue(saved)
  }, [key])
  const set = useCallback(
    (next) =>
      setValue((v) => {
        const value = typeof next === 'function' ? next(v) : next
        store.set(key, value)
        return value
      }),
    [key],
  )
  return [value, set]
}

// Docked, the panel takes the right edge at full height and the page narrows beside it.
// Its left edge has a resize handle like the system's ResizeHandle: a hit area straddling the edge with
// a small grip that grows on hover. Drag it; the arrow keys step 20px; double-click goes back to 344.
// It sits outside the panel (which clips), fixed on the panel's edge.
const DOCK_MIN = 320
const DOCK_DEFAULT = PANEL_WIDTH
const DOCK_STEP = 20
const DOCK_MAX = 420
// No window while rendering on the server: then just the 420 cap
const dockMax = () => (typeof window === 'undefined' ? DOCK_MAX : Math.max(DOCK_MIN, Math.min(DOCK_MAX, Math.round(window.innerWidth * 0.6))))
const clampDock = (w) => Math.min(dockMax(), Math.max(DOCK_MIN, Math.round(w)))

function DockHandle({ width, setWidth }) {
  const [dragging, setDragging] = useState(false)
  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    document.documentElement.dataset.scResizing = ''
    setDragging(true)
  }
  const onPointerMove = (e) => {
    if (dragging) setWidth(clampDock(window.innerWidth - e.clientX), false)
  }
  const onPointerUp = (e) => {
    if (!dragging) return
    delete document.documentElement.dataset.scResizing
    setDragging(false)
    setWidth(clampDock(window.innerWidth - e.clientX), true)
  }
  const onKeyDown = (e) => {
    const next =
      e.key === 'ArrowLeft' ? width + DOCK_STEP : e.key === 'ArrowRight' ? width - DOCK_STEP : e.key === 'Home' ? DOCK_MIN : e.key === 'End' ? dockMax() : null
    if (next === null) return
    e.preventDefault()
    setWidth(clampDock(next), true)
  }
  return (
    <div
      data-scootch
      className="sc-dock-handle"
      data-dragging={dragging || undefined}
      style={{ right: width }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Scootch"
      aria-valuemin={DOCK_MIN}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={() => setWidth(DOCK_DEFAULT, true)}
    >
      <span className="sc-dock-zone" aria-hidden>
        <span className="sc-dock-grip" />
      </span>
    </div>
  )
}

// The panel's scrolling body, with the library's scrollbar: thin, over the content (so no gap beside it),
// and only while you hover or scroll
function PanelScroll({ children }) {
  return (
    <ScrollArea className="sc-scroll-area">
      <div className="sc-scroll">{children}</div>
    </ScrollArea>
  )
}

const RulerIcon = () => <RulerCorner size={16} />
const DockIcon = () => <PanelRight size={16} />

// ---- The panel's pieces. Scootch and ScootchSpecimen (its states laid out on a page) both use them ----

// The page's light / dark theme, worked out for any app (pageTheme in inspect.js). Follows changes made
// anywhere (the site's own switch, a shortcut, the system going dark). Scootch reads the page's values
// through it, so they're read again on a switch. null until it has been read.
function usePageThemeRead() {
  // Unknown at first, as the server renders it, and read once mounted: a page that sets its theme before
  // hydration (from a saved choice) would otherwise not match the server's HTML
  const [theme, setTheme] = useState(null)
  useEffect(() => {
    let later
    const read = () => {
      setTheme(readPageTheme())
      // Again once a colour transition on the page has had time to finish
      clearTimeout(later)
      later = setTimeout(() => setTheme(readPageTheme()), 400)
    }
    const mo = new MutationObserver(read)
    for (const el of [document.documentElement, document.body]) mo.observe(el, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    const system = matchMedia('(prefers-color-scheme: dark)')
    system.addEventListener('change', read)
    read()
    return () => {
      mo.disconnect()
      system.removeEventListener('change', read)
      clearTimeout(later)
    }
  }, [])
  return theme
}
const usePageTheme = () => usePageThemeRead() ?? 'light'

// The panel's own light / dark. It follows the page: a dark page opens a dark panel. Its button changes the
// panel only (data-theme on it), never the page, and that choice is kept (per browser) for as long as the
// page stays in the theme it was made on. When the page switches, the panel follows it again.
// page: the page's theme, or null while it isn't known yet
function usePanelTheme(page, key = 'scootch-theme') {
  const [saved, setSaved] = usePersisted(key, null) // { theme, page }
  const stale = !!page && !!saved && saved.page !== page // made on the other theme, or saved the old way
  useEffect(() => {
    if (stale) setSaved(null)
  }, [stale]) // eslint-disable-line react-hooks/exhaustive-deps
  const theme = (saved && !stale && page ? saved.theme : null) ?? page ?? 'light'
  return [theme, () => setSaved({ theme: theme === 'dark' ? 'light' : 'dark', page })]
}

// The Scootch wordmark, in the bar. It takes its colour from the text colour around it.
const Wordmark = () => (
  <svg className="sc-logo" viewBox="0 0 633 138.827" fill="currentColor" role="img" aria-label="Scootch">
    <path d="M444.964 28.0525C448.103 29.8918 454.476 29.9081 456.656 26.9952C475.282 2.10596 517.487 -11.4186 540.469 12.4775C561.869 41.9584 475.71 41.7106 517.612 64.377C517.747 64.4503 517.888 64.5514 517.997 64.6604C518.087 64.7504 518.188 64.8291 518.297 64.895C523.105 67.8009 527.959 70.7781 531.164 74.0925C531.894 74.8477 533.33 74.4627 533.456 73.4199C535.255 60.2278 536.604 45.8356 542.001 34.4424C545.749 25.7478 555.643 18.4026 564.187 24.6982C571.383 29.9451 576.631 43.7371 582.178 47.0352C583.289 47.7295 584.4 48.038 585.63 47.9603C585.827 47.9479 586.021 47.9102 586.211 47.8556C593.986 45.6089 598.74 36.3246 604.664 30.8447C610.81 23.4993 620.704 18.4024 627.75 26.4971C636.145 38.0402 632.247 56.03 631.048 69.6719C628.649 88.5604 626.551 108.948 619.355 119.292C614.765 126.992 604.178 130.597 597.562 123.316C597.399 123.136 597.228 122.97 597.045 122.811C590.281 116.926 583.892 95.1634 573.47 103.441C573.383 103.511 573.282 103.577 573.182 103.627C573.083 103.676 572.99 103.735 572.904 103.806C564.853 110.45 556.943 124.849 547.698 126.938C534.356 129.186 530.908 116.894 530.758 102.353C530.813 99.1553 525.879 96.8063 523.112 98.4096C515.801 102.646 506.446 105.054 499.244 105.272C472.764 106.941 450.083 88.9572 446.398 65.1095C445.781 61.1126 439.223 58.0998 436.364 60.9594C433.8 63.5225 431.329 66.2759 429.33 69.4404C426.932 73.0382 424.983 77.0859 423.634 81.2832C419.436 93.7258 418.836 109.317 409.842 119.661C401.597 129.855 383.457 129.405 380.159 114.863C376.262 101.671 381.958 86.3801 378.66 73.0381C377.922 68.9538 376.086 65.3702 373.951 62.0116C371.757 58.5577 364.096 60.157 362.684 63.9981C354.115 87.3164 330.274 105.863 305.183 105.047H304.583C293.176 104.962 282.151 100.448 273.949 92.9279C271.028 90.2491 264.367 91.8555 263.147 95.6267C255.283 119.932 230.761 139.641 204.911 138.801H204.312C189.634 138.692 175.589 131.251 167.377 119.507C165.146 116.316 157.357 115.684 154.228 118.002C146.629 123.632 135.312 126.859 126.919 127.113C103.897 128.564 83.7454 115.16 76.454 95.9622C75.0446 92.2514 68.0148 90.4754 64.9411 92.9872C47.5609 107.19 16.3608 110.848 2.15612 95.8602C2.0303 95.7275 1.93584 95.5675 1.87789 95.394C1.83649 95.2701 1.77535 95.1527 1.70084 95.0454C-1.30234 90.7194 -0.0884589 85.1188 3.46484 81.5654C8.41191 76.1686 17.8564 73.1702 19.0557 68.0732C20.2548 63.7259 16.6573 59.2287 14.2588 55.6309C-11.6758 25.7986 26.7012 -6.28216 60.8809 1.06348C68.0766 2.71252 77.0713 7.0601 77.3711 15.4551C77.2208 23.6998 66.2782 28.6469 64.3291 35.3926C63.1298 39.4401 64.7787 43.038 67.3271 46.9355C70.135 51.2036 73.4474 55.6403 75.4366 60.4972C75.8261 61.4483 77.3403 61.4972 77.748 60.5537C90.0407 28.7728 141.759 6.88535 168.144 34.3184C189.543 63.7993 103.385 63.5524 145.287 86.2188C145.422 86.2921 145.563 86.3932 145.672 86.5022C145.762 86.5922 145.863 86.6709 145.972 86.7368C147.339 87.5633 148.711 88.3957 150.047 89.2399C153.312 91.3028 159.473 88.4185 160.09 84.606C163.859 61.2993 183.24 40.6357 206.561 35.3623C222.01 31.2148 239.467 35.2436 251.244 45.6622C254.232 48.3051 261.075 46.6312 262.297 42.8344C268.701 22.9398 286.229 6.26747 306.832 1.6084C329.169 -4.38796 355.703 6.70583 363.198 29.4922C363.998 31.7063 368.088 32.4413 369.941 30.9894C385.679 18.6566 427.878 21.8623 440.724 26.2666L441.323 26.416C442.651 26.8585 443.867 27.4098 444.964 28.0525ZM216.904 91.1299C221.851 86.7825 219.153 78.2375 212.107 79.4365C207.31 80.1861 203.712 86.1824 206.561 90.3799C208.659 93.8277 213.756 93.8276 216.754 91.2793L216.904 91.1299ZM317.176 57.376C322.123 53.0286 319.425 44.4835 312.379 45.6826C307.582 46.4322 303.984 52.4285 306.832 56.626C308.931 60.0739 314.028 60.0739 317.026 57.5254L317.176 57.376Z" />
  </svg>
)

// One bar: the name and the app's tabs on the left, the tools on the right
// embed: the panel sits in the page (ScootchEmbed), so the tools that act on the whole page (draw, rulers,
// dock) and close are left out
function PanelBar({ changes, onChanges, drawing, onDrawing, rulers, onRulers, docked, onDocked, onClose, theme, onTheme, grab, embed, breakpoint: bp }) {
  // The breakpoint, short: the app's name for it and where it starts ("l 1024"), or just "≥1024"; below the first one, "<360".
  // The whole range and the widths are in its title.
  const bpShort = !bp || (bp.from === null && bp.to === null) ? '' : `${bp.name ? `${bp.name} ` : ''}${bp.from === null ? `<${bp.to + 1}` : bp.name ? bp.from : `≥${bp.from}`}`
  const bpTitle = bp && `Breakpoint ${breakpointLabel(bp)}. The window is ${bp.width} wide${bp.page < bp.width ? `; the page has ${bp.page} of it, and keeps the window's breakpoint` : ''}.`
  return (
    <div className="sc-bar" data-grab={grab ? '' : undefined} {...grab}>
      <span className="sc-name">
        <Wordmark />
        {/* After the wordmark: the breakpoint the window is in; the version takes its place while the wordmark is hovered */}
        <span className="sc-name-after">
          {bpShort && (
            <span className="sc-breakpoint" title={bpTitle}>
              {bpShort}
            </span>
          )}
          <span className="sc-version">v {VERSION}</span>
        </span>
      </span>
      <div className="sc-bar-tools">
        {/* The list of notes and adjustments. First of the tools, not a tab of its own; how many are open
            is on View all, at the bottom of the panel */}
        {onChanges && (
          <button className="sc-icon" aria-pressed={!!changes} title={changes ? 'Back to inspecting' : 'Notes and changes'} aria-label="Notes and changes" onClick={onChanges}>
            <List size={16} />
          </button>
        )}
        {!embed && (
          <>
            <button className="sc-icon" aria-pressed={!!drawing} onClick={onDrawing} title="Draw on the page (⇧D)">
              <PencilSimple size={16} />
            </button>
            <button className="sc-icon" aria-pressed={!!rulers} title={rulers ? 'Hide rulers (⇧R)' : 'Show rulers (⇧R)'} onClick={onRulers}>
              <RulerIcon />
            </button>
            <button
              className="sc-icon"
              aria-pressed={!!docked}
              title={docked ? 'Float the panel over the page' : 'Dock the panel beside the page'}
              onClick={onDocked}
            >
              <DockIcon />
            </button>
          </>
        )}
        {/* The pill hides while the panel is open, so close from here */}
        {/* Light or dark for the page, just before close */}
        {onTheme && (
          <button className="sc-icon" title={theme === 'dark' ? 'Light mode' : 'Dark mode'} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
        {!embed && (
          <button className="sc-icon" title="Close (⌥I)" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

// What's selected: an element (its components above, in grey) or a ruler guide (its kind above)
// As in the Figma mock-up (WorkLife OS, Page 20): the element's name in a grey strip right under the bar,
// then one line with its components (or the guide's kind) and the buttons
function ElementHead({ title, sub, onParent, onDeselect }) {
  // One row: the name, then its buttons, centred on it. sub (the React components it sits in, or which
  // way a guide runs) is the name's tooltip, not a second line
  return (
    <header className="sc-head">
      <div className="sc-title">
        <div className="sc-el" title={sub || undefined}>
          {title}
        </div>
      </div>
      {onParent && (
        <button className="sc-icon" title="Select parent" onClick={onParent}>
          <ArrowUp size={16} />
        </button>
      )}
      <button className="sc-icon" title="Deselect" onClick={onDeselect}>
        <X size={16} />
      </button>
    </header>
  )
}

// reset(key): that section's reset, or null when it has no changes. allSections: show Type even when
// the element has no text of its own (the specimen, to show every section at once)
function ElementSections({ el, record, reset = () => null, allSections = false }) {
  return (
    <>
      <SpacingSection el={el} record={record} onReset={reset('spacing')} />
      <DisplaySection el={el} record={record} onReset={reset('display')} />
      {(allSections || hasOwnText(el)) && <TypeSection el={el} record={record} onReset={reset('type')} />}
      <FillSection el={el} record={record} onReset={reset('fill')} />
      <BorderSection el={el} record={record} onReset={reset('border')} />
    </>
  )
}

// ---- Controls: the app's own values (useControls, controls.js), each group a section like Type or Fill ----

// A key as a label: cornerRadius, corner_radius, corner-radius → Corner radius
const labelOf = (key) => {
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
const shownValue = (v) => (typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v))
// What a group's changes read as, in the list and in notes: "blur 12 → 20"
const controlChangesText = (g) => changesOf(g).map((ch) => `${ch.key}: ${shownValue(ch.from)} → ${shownValue(ch.to)}`)
const controlPath = (name) => `controls/${name}`

function ControlRows({ group, schema, values, path = [] }) {
  const colours = useMemo(() => colourTokens(), [])
  return Object.entries(schema ?? {}).map(([key, spec]) => {
    const kind = kindOf(spec)
    if (!kind) return null
    const at = [...path, key]
    const value = values?.[key]
    const set = (v) => setControl(group.name, at, v)
    const label = (spec && typeof spec === 'object' && spec.label) || labelOf(key)
    if (kind === 'group') {
      return (
        <div key={key} className="sc-control-group">
          <span className="sc-control-label">{label}</span>
          <ControlRows group={group} schema={spec} values={value} path={at} />
        </div>
      )
    }
    if (kind === 'action') {
      return (
        <Button key={key} variant="secondary" onClick={() => spec()}>
          {label}
        </Button>
      )
    }
    const opts = spec && typeof spec === 'object' ? spec : {}
    return (
      <div key={key} className="sc-control" data-kind={kind}>
        {kind === 'text' && (
          <span className="sc-control-label" title={at.join('.')}>{label}</span>
        )}
        {kind === 'number' && (
          <Slider
            variant="bar"
            label={label}
            value={value}
            min={opts.min ?? 0}
            max={opts.max ?? 100}
            step={opts.step ?? (Math.abs(value) <= 1 && (opts.max ?? 1) <= 1 ? 0.01 : 1)}
            unit={opts.unit ?? ''}
            onValueChange={(v) => set(v)}
          />
        )}
        {kind === 'toggle' && (
          <Switch variant="bar" label={label} checked={!!value} onCheckedChange={(v) => set(v)} />
        )}
        {kind === 'colour' && (
          <TokenField
            variant="bar"
            label={label}
            value={null}
            display={/^var\(/.test(value) ? value.replace(/^var\(\s*--|\)$/g, '') : value}
            swatch={value}
            tone={/^var\(/.test(value) ? 'token' : 'custom'}
            current={value.match(/var\(\s*(--[a-z0-9-]+)/i)?.[1]}
            tokens={colours.map((t) => ({ name: t.name, label: '', swatch: `var(${t.name})` }))}
            onPick={(t) => set(`var(${t})`)}
            onColour={(v) => set(v)}
          />
        )}
        {kind === 'choice' && (
          <Select variant="bar" label={label} value={String(value)} onValueChange={(v) => set(v)} options={optionsOf(spec)} />
        )}
        {kind === 'text' && (
          <Textarea aria-label={label} minRows={1} maxRows={6} value={value ?? ''} onChange={(e) => set(e.target.value)} />
        )}
      </div>
    )
  })
}

// One section per group, named as the code names it. A group tied to an element (useControls' ref) shows
// only while that element, or something inside it, is selected; the rest always show.
function ControlSections({ selected }) {
  const groups = useControlGroups()
  return groups
    .filter((g) => {
      const el = g.el?.()
      return !g.el || (!!el && !!selected && (el === selected || el.contains(selected)))
    })
    .map((g) => (
      <section key={g.name} className="sc-section">
        <Heading onReset={g.values !== g.defaults ? () => resetControls(g.name) : null}>{g.name}</Heading>
        <div className="sc-controls">
          <ControlRows group={g} schema={g.schema()} values={g.values} />
        </div>
      </section>
    ))
}

const EmptyHint = ({ embed }) =>
  embed ? (
    <p className="sc-empty">Click any element beside this panel to inspect, adjust or comment on it.</p>
  ) : (
    <p className="sc-empty">
      Click any element to inspect, adjust or comment on it, or a ruler guide to comment on it. ⇧D to draw on the page.
      <br />
      <br />
      Esc or ⌥I to close.
    </p>
  )

// The app's own tabs beside Inspect, in a row under the bar. Without any, there is no row
function PanelTabs({ tabs = [], tabId = 'inspect', onTab }) {
  if (!tabs.length) return null
  return (
    <div className="sc-tabs" role="tablist">
      {[{ id: 'inspect', label: 'Inspect' }, ...tabs].map((t) => (
        <button key={t.id} role="tab" className="sc-tab" aria-selected={tabId === t.id} onClick={() => onTab?.(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// Pinned at the bottom of the panel, always two buttons: Copy on the left; on the right View all (with
// how many are open) while inspecting, which opens the list, and Reset in the list, which empties it.
function PanelFoot({ onCopy, onReset, onViewAll, count = 0, note }) {
  return (
    <footer className="sc-foot">
      {onCopy && (
        <div className="sc-actions">
          <button className="sc-btn" onClick={onCopy}>
            Copy
          </button>
          {onViewAll ? (
            <button className="sc-btn" onClick={onViewAll} title="See every note and change">
              View all
              <span className="sc-count">{count}</span>
            </button>
          ) : (
            <button className="sc-btn" onClick={onReset} title="Undo every adjustment and mark every note resolved">
              Reset
            </button>
          )}
        </div>
      )}
      {note && <span className="sc-note">{note}</span>}
    </footer>
  )
}

// The list view (the list icon in the bar, or View all): the numbered notes and adjustments. Clicking one
// opens it where it belongs (its element, or its ruler guide).
function ChangesList({ rows, onOpen }) {
  return rows.length > 0 ? (
    <PanelScroll>
      <div className="sc-changes">
        <NoteList items={rows} onOpen={onOpen} />
      </div>
    </PanelScroll>
  ) : (
    <p className="sc-empty sc-changes-empty">Nothing yet. Notes you leave and values you adjust are listed here.</p>
  )
}

// The closed pill's inside: the name, and the open count as a code chip. With notes the name steps back to
// grey and the count is the black; with none it's just the name
const PillContent = ({ count }) => (
  <>
    <Wordmark />
    {count > 0 && <span className="sc-count">{count}</span>}
  </>
)

// notesApi: where notes are saved (see the README for the Next and Vite handlers).
// tokens: which token names count as what, if your system doesn't use the defaults (see tokens.js).
// embed (ScootchEmbed): the panel renders where it is mounted and is always open, with no pill. It picks
// elements inside `scope` only (a CSS selector; the rest of the page behaves as usual), keeps its notes in
// the browser, and steps aside while a full Scootch on the same page is open. `theme` is what it starts in.
export default function Scootch({ notesApi: notesUrl = '/api/notes', tokens, tabs = [], embed = false, scope, select, theme: startTheme } = {}) {
  useStyles() // its own stylesheet: no CSS import in the app
  const pageRead = usePageThemeRead()
  const pageTheme = pageRead ?? 'light'
  const [theme, flipTheme] = usePanelTheme(startTheme ?? pageRead, embed ? 'scootch-embed-theme' : 'scootch-theme')
  // Scootch's marks on the page itself (boxes, markers, home spots) take the page's theme: the standalone
  // stylesheet reads it from here, since an app may not say dark the way the system does
  useEffect(() => {
    if (embed || !pageRead) return
    document.documentElement.dataset.scootchPage = pageRead
    return () => delete document.documentElement.dataset.scootchPage
  }, [embed, pageRead])
  if (!embed) setNotesApi(notesUrl)
  useMemo(() => configure(tokens), [JSON.stringify(tokens ?? {})])
  const [opened, setActive] = useState(false)
  const active = embed || opened
  const activeRef = useRef(active)
  activeRef.current = active
  const [rulersOn, setRulers] = usePersisted('scootch-rulers', false)
  const [dockedOn, setDocked] = usePersisted('scootch-docked', false)
  const rulers = !embed && rulersOn
  const docked = !embed && dockedOn
  // Embedded: only elements inside the scope, and not while the full Scootch has the page
  const pickable = (el) => !embed || (!('scootchActive' in document.documentElement.dataset) && (!scope || !!el.closest?.(scope)))
  const pickableRef = useRef(pickable)
  pickableRef.current = pickable
  const [savedTab, setTab] = usePersisted('scootch-tab', 'inspect')
  const appTab = tabs.find((t) => t.id === savedTab) // null: Inspect, or the list (the bar's list icon)
  const tabId = savedTab === 'changes' ? 'changes' : (appTab?.id ?? 'inspect')
  const [savedDockWidth, saveDockWidth] = usePersisted('scootch-dock-width', DOCK_DEFAULT)
  const [dragWidth, setDragWidth] = useState(null) // while resizing; saved on release
  const dockWidth = dragWidth ?? clampDock(savedDockWidth) // a width saved before the 320–420 range comes back inside it
  // The breakpoint the window is in, kept current while Scootch is open (docking changes the page's share of it)
  const breakpoint = useBreakpoint(active, docked, dockWidth)
  const setDockWidth = (w, done) => {
    if (done) {
      saveDockWidth(w)
      setDragWidth(null)
    } else setDragWidth(w)
  }
  // The pill stays put while Scootch is open (no dragging then); floating, the panel opens from its spot.
  // Docked, the pill is hidden and measures as 0 × 0 at the top left, so the panel is only placed while it
  // shows, and placed again on undocking (it used to jump to the left edge)
  const pill = useMovablePill(!active)
  const [panelPos, setPanelPos] = useState(null)
  useLayoutEffect(() => {
    if (!active || docked || embed) return
    const place = () => {
      const el = pill.ref.current
      if (!el || !el.getBoundingClientRect().width) return
      setPanelPos(panelPlacement(el, rulers ? RULER_SIZE : 0))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [active, docked, pill.pos, rulers]) // eslint-disable-line react-hooks/exhaustive-deps
  // Floating, the panel can be dragged by its bar (not its buttons). It keeps its height while it moves,
  // and on close the pill takes its place, so it opens there next time. While it moves its home shows
  // (the right edge, full height); dropped near it, the panel glides back there, as the pill does.
  const panelRef = useRef(null)
  const panelDrag = useRef(null)
  const panelMoved = useRef(false)
  const [panelHome, setPanelHome] = useState(null) // while dragging: { near }
  const [panelSnapping, setPanelSnapping] = useState(false)
  const panelHomeTop = PANEL_EDGE + (rulers ? RULER_SIZE : 0)
  const grabPanel = (e) => {
    if (e.button !== 0 || e.target.closest('button, input, [role="tab"]')) return
    const r = panelRef.current.getBoundingClientRect()
    panelDrag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const movePanel = (e) => {
    const d = panelDrag.current
    if (!d) return
    const { W, H } = viewport()
    const left = Math.min(Math.max(EDGE, e.clientX - d.dx), W - d.w - EDGE)
    const top = Math.min(Math.max(EDGE, e.clientY - d.dy), H - d.h - EDGE)
    panelMoved.current = true
    setPanelPos({ left, top, right: 'auto', bottom: 'auto', height: d.h })
    setPanelHome({ near: Math.hypot(W - left - d.w - PANEL_EDGE, top - panelHomeTop) < SNAP })
  }
  const dropPanel = () => {
    if (!panelDrag.current) return
    panelDrag.current = null
    const near = panelHome?.near
    setPanelHome(null)
    if (!near) return
    // Glide to the right edge at full height, then hand the spot back to the CSS default
    const { W, H } = viewport()
    setPanelSnapping(true)
    setPanelPos({ left: W - PANEL_WIDTH - PANEL_EDGE, top: panelHomeTop, right: 'auto', bottom: 'auto', height: H - panelHomeTop - PANEL_EDGE })
    panelMoved.current = false
    pill.goHome()
    setTimeout(() => {
      setPanelSnapping(false)
      setPanelPos({ top: panelHomeTop, bottom: PANEL_EDGE, left: 'auto', right: PANEL_EDGE })
    }, SNAP_MS)
  }
  useEffect(() => {
    if (active || !panelMoved.current || !panelPos) return
    panelMoved.current = false
    const { W, H } = viewport()
    const pillW = pill.ref.current?.offsetWidth ?? 0
    const onLeft = panelPos.left + PANEL_WIDTH / 2 < W / 2
    const onTop = panelPos.top + panelPos.height / 2 < H / 2
    const right = onLeft ? W - panelPos.left - pillW : W - panelPos.left - PANEL_WIDTH
    pill.moveTo(onTop ? { right, top: panelPos.top } : { right, bottom: H - panelPos.top - panelPos.height })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState(null)
  const [spot, setSpot] = useState({ fx: 0, fy: 0 }) // where on the selected element it was clicked
  // Embedded, `select` names the element the panel opens on, so a visitor lands on something to try
  useEffect(() => {
    if (embed && select) setSelected(document.querySelector(select))
  }, [embed, select])
  const [focusNote, setFocusNote] = useState(null) // a note opened from its marker
  const [guide, setGuide] = useState(null) // a ruler guide picked for a note: { id, dir, at, fx, fy }
  const [changes, setChanges] = useState([]) // { el, prop, from, fromValue, to, original, at }
  const [drawing, setDrawing] = useState(false) // D: drags draw instead of selecting
  const [draft, setDraft] = useState([]) // strokes drawn and not yet saved, in page coordinates
  const notesApi = useNotes(active, embed)
  const { notes } = notesApi
  const [note, setNote] = useState('')
  const refresh = useForceUpdate()

  // ⌥I toggles; D draws while open
  const drawingRef = useRef(drawing)
  drawingRef.current = drawing
  useEffect(() => {
    const onKey = (e) => {
      if (embed) {
        // Embedded there is nothing to open, close or draw: Esc only lets go of the element
        const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') || e.target?.isContentEditable
        if (e.key === 'Escape' && !inField && !menuOpen) setSelected(null)
        return
      }
      if (e.altKey && e.code === 'KeyI') {
        e.preventDefault()
        setActive((a) => !a)
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') || e.target?.isContentEditable
      // ⇧R shows or hides the rulers, as in Figma
      if (activeRef.current && e.shiftKey && e.code === 'KeyR' && !e.altKey && !e.metaKey && !e.ctrlKey && !typing) {
        e.preventDefault()
        setRulers((r) => !r)
      }
      // ⇧D draws (Shift like the rulers' ⇧R)
      if (e.code === 'KeyD' && e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && activeRef.current && !typing) {
        e.preventDefault()
        setDrawing((d) => !d)
      }
      // Esc leaves drawing, then closes Scootch, unless it's leaving a text box or the token list (they handle it first)
      // …or a library menu (a token menu) that was open when the key went down: Esc closes just the menu
      if (e.key === 'Escape' && !typing && !menuOpen) {
        if (drawingRef.current) return setDrawing(false)
        setActive(false)
        setSelected(null)
        setGuide(null)
      }
    }
    // Whether a library menu was open, checked before the menu's own Esc closes it
    let menuOpen = false
    const before = () => (menuOpen = !!document.querySelector('.sc-ui-positioner'))
    window.addEventListener('keydown', before, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', before, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [setRulers, embed])

  useEffect(() => {
    if (!active) setDrawing(false)
  }, [active])

  // A sketch becomes a note on the element under it, with its strokes as fractions of that element's box
  const saveSketch = (text) => {
    const el = anchorFor(draft)
    const { strokes, fx, fy } = toRelative(draft, el)
    notesApi.add(el, fx, fy, text, 'sketch', { strokes })
    setDraft([])
  }

  // Notes on a ruler guide hang on the body, at the point on the guide where it was clicked, with the
  // guide itself ({ id, dir, at }) kept in the note. A guide reads as its position, e.g. "Guide Y 240".
  const guideLabel = (g) => `Guide ${g.dir === 'h' ? 'Y' : 'X'} ${g.at}`
  const bodyFraction = (x, y) => {
    const r = document.body.getBoundingClientRect()
    return { fx: r.width ? (x - r.left) / r.width : 0, fy: r.height ? (y - r.top) / r.height : 0 }
  }
  const pickGuide = (g, x, y) => {
    setSelected(null)
    setFocusNote(null)
    setTab('inspect')
    setGuide({ ...g, ...bodyFraction(x, y) })
  }
  // A guide dragged somewhere else takes its notes with it
  const moveGuide = (g) => {
    const r = document.body.getBoundingClientRect()
    for (const n of notesRef.current) {
      if (n.guide?.id !== g.id || n.guide.at === g.at) continue
      const shift = g.at - n.guide.at
      const spot = g.dir === 'h' ? { fy: n.fy + (r.height ? shift / r.height : 0) } : { fx: n.fx + (r.width ? shift / r.width : 0) }
      notesApi.update(n.id, { ...spot, guide: { ...n.guide, at: g.at }, short: guideLabel(g) })
    }
    setGuide((cur) => (cur?.id === g.id ? { ...cur, at: g.at, ...(g.dir === 'h' ? { fy: cur.fy + (r.height ? (g.at - cur.at) / r.height : 0) } : { fx: cur.fx + (r.width ? (g.at - cur.at) / r.width : 0) }) } : cur))
  }

  // While active: click selects (and doesn't follow links or press buttons).
  useEffect(() => {
    if (!active) return
    resetRuleCache()
    const onClick = (e) => {
      if (isScootchNode(e.target) || !pickableRef.current(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if ('scGuideDrag' in document.documentElement.dataset) return // the end of a guide drag, not a pick
      const r = e.target.getBoundingClientRect()
      setSelected(e.target)
      setGuide(null)
      setTab('inspect') // picking an element goes back to the Inspect tab
      setSpot({ fx: r.width ? (e.clientX - r.left) / r.width : 0, fy: r.height ? (e.clientY - r.top) / r.height : 0 })
      setFocusNote(null)
    }
    const block = (e) => {
      if (!isScootchNode(e.target) && pickableRef.current(e.target)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('click', onClick, true)
    window.addEventListener('mousedown', block, true)
    window.addEventListener('pointerdown', block, true)
    // The crosshair: over the whole page, or embedded, over the scope only
    const marked = embed ? [...document.querySelectorAll(scope || 'body')] : []
    if (embed) marked.forEach((el) => (el.dataset.scootchScope = ''))
    else document.documentElement.dataset.scootchActive = ''
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('mousedown', block, true)
      window.removeEventListener('pointerdown', block, true)
      if (embed) marked.forEach((el) => delete el.dataset.scootchScope)
      else delete document.documentElement.dataset.scootchActive
    }
  }, [active, embed, scope])

  // Apply a change live and record it (one entry per element + property; the first "from" is kept).
  const changesRef = useRef(changes)
  changesRef.current = changes
  const record = useCallback(
    (el, prop, to, { declared = null, px = null, raw = null } = {}) => {
      const existing = changesRef.current.find((c) => c.el === el && c.prop === prop)
      const original = existing
        ? existing.original
        : prop === 'class'
          ? typeClasses().find((c) => el.classList.contains(c)) ?? null
          : el.style.getPropertyValue(prop)
      applyChange(el, prop, to)
      // Checked against the list as it is now, not as it was at the last render: a field commits twice
      // in one go (Enter, then losing focus), and the second must update the first, not add another
      setChanges((list) =>
        list.some((c) => c.el === el && c.prop === prop)
          ? list.map((c) => (c.el === el && c.prop === prop ? { ...c, to } : c))
          : [...list, { el, prop, to, original, from: declared, fromValue: px !== null ? `${px}px` : raw, at: Date.now() }],
      )
      refresh()
    },
    [refresh],
  )

  // Undo the edits that pass `test` (one section's on one element), or all of them. An element left
  // with no edits takes back the note it saved; one with edits left keeps its note, updated.
  const undo = (test = () => true) => {
    const out = changes.filter(test)
    if (!out.length) return
    const keep = changes.filter((ch) => !test(ch))
    const left = new Set(keep.map((ch) => ch.el))
    const gone = new Set(out.filter((ch) => !left.has(ch.el)).map((ch) => cssPath(ch.el)))
    for (const n of notesRef.current) if (n.kind === 'changes' && n.status === 'open' && gone.has(n.path)) notesApi.remove(n.id)
    for (const path of gone) (savedFor.current.delete(path), latest.current.delete(path))
    for (const ch of out) {
      if (ch.prop === 'class') {
        if (ch.to) ch.el.classList.remove(ch.to)
        if (ch.original) ch.el.classList.add(ch.original)
      } else if (ch.original) ch.el.style.setProperty(ch.prop, ch.original)
      else ch.el.style.removeProperty(ch.prop)
    }
    setChanges(keep)
    refresh()
  }
  const resetAll = () => undo()
  // The selected element's reset for one section, when that section has changes
  const sectionReset = (key) => {
    const test = (ch) => ch.el === selected && SECTION_PROPS[key](ch.prop)
    return changes.some(test) ? () => undo(test) : null
  }

  // Adjusted elements, one group each, in the order they were first changed
  const groups = groupByEl(changes)

  // Each adjusted element saves itself as a note (and keeps it up to date) a moment after the last
  // change, so it's read with the rest. path → note id, so a quick second change updates, not adds.
  const notesRef = useRef(notes)
  notesRef.current = notes
  const savedFor = useRef(new Map())
  const latest = useRef(new Map()) // path → the newest text, so a save that lands late can catch up
  useEffect(() => {
    if (!changes.length) return
    const t = setTimeout(() => {
      for (const { el, list } of groupByEl(changes)) {
        const path = cssPath(el)
        const text = changesText(list).trim()
        latest.current.set(path, text)
        const id = savedFor.current.get(path) ?? notesRef.current.find((n) => n.kind === 'changes' && n.status === 'open' && n.path === path)?.id
        if (id === 'pending') continue // the first save is still on its way; the next change updates it
        const existing = id && notesRef.current.find((n) => n.id === id)
        if (existing && existing.status === 'open') {
          if (existing.comment !== text) notesApi.update(id, { comment: text })
        } else {
          notesApi.add(el, 0, 0, text, 'changes').then((n) => {
            savedFor.current.set(path, n.id)
            const now = latest.current.get(path)
            if (now && now !== text) notesApi.update(n.id, { comment: now })
          })
          savedFor.current.set(path, 'pending')
        }
      }
    }, 600)
    return () => clearTimeout(t)
  }, [changes]) // eslint-disable-line react-hooks/exhaustive-deps

  // The app's own controls (useControls) that have been moved off their defaults: listed with the
  // adjustments, and saved as a note each, so "sc" has an agent write the new values into the code
  const controlGroups = useControlGroups()
  const changedControls = controlGroups.filter((g) => g.values !== g.defaults && changesOf(g).length > 0)
  const controlNoteText = (g) => [`1. Controls — ${g.name}`, `   path: useControls('${g.name}', …) in the code: make these the new defaults`, ...controlChangesText(g).map((l) => `   - ${l}`)].join('\n')
  const controlSig = changedControls.map(controlNoteText).join('\n')
  useEffect(() => {
    const t = setTimeout(() => {
      const live = new Set(changedControls.map((g) => controlPath(g.name)))
      // A group back on its defaults has nothing to say: its note goes
      for (const n of notesRef.current) {
        if (n.kind === 'changes' && n.status === 'open' && n.control && !live.has(n.path) && savedFor.current.has(n.path)) {
          notesApi.remove(n.id)
          savedFor.current.delete(n.path)
        }
      }
      for (const g of changedControls) {
        const path = controlPath(g.name)
        const text = controlNoteText(g)
        const id = savedFor.current.get(path) ?? notesRef.current.find((n) => n.kind === 'changes' && n.status === 'open' && n.path === path)?.id
        if (id === 'pending') continue
        if (id) {
          savedFor.current.set(path, id)
          if (notesRef.current.find((n) => n.id === id)?.comment !== text) notesApi.update(id, { comment: text })
        } else {
          savedFor.current.set(path, 'pending')
          notesApi.add(document.body, 0, 0, text, 'changes', { path, control: g.name, short: g.name, text: '', components: 'Controls' }).then((n) => savedFor.current.set(path, n.id))
        }
      }
    }, 600)
    return () => clearTimeout(t)
  }, [controlSig]) // eslint-disable-line react-hooks/exhaustive-deps

  // A live adjustment and its saved note are the same item: show the live one
  const livePaths = new Set([...groups.map((g) => cssPath(g.el)), ...changedControls.map((g) => controlPath(g.name))])

  // One numbered list: open notes and adjusted elements, oldest first. Resolved notes leave the list;
  // they stay under their element's Comment section (with the reply and Reopen).
  const items = [
    ...notes
      .filter((n) => n.status !== 'resolved')
      .filter((n) => !(n.kind === 'changes' && livePaths.has(n.path)))
      .map((n) => ({
        id: n.id,
        kind: n.kind === 'changes' ? 'saved' : n.kind === 'sketch' ? 'sketch' : 'note',
        el: n.control ? null : elementFor(n),
        fx: n.fx,
        fy: n.fy,
        at: Date.parse(n.at) || 0,
        note: n,
        comment: n.comment,
        label: n.short,
      })),
    ...groups.map((g) => ({
      id: `change-${changes.indexOf(g.list[0])}`,
      kind: 'change',
      el: g.el,
      fx: 0,
      fy: 0,
      at: g.at,
      group: g,
      label: `${describe(g.el).short}: ${g.list.length} change${g.list.length > 1 ? 's' : ''}`,
    })),
    ...changedControls.map((g) => ({
      id: `control-${g.name}`,
      kind: 'control',
      el: null,
      fx: 0,
      fy: 0,
      at: g.at,
      control: g,
      label: `${g.name}: ${changesOf(g).length} change${changesOf(g).length > 1 ? 's' : ''}`,
    })),
  ]
    .sort((a, b) => a.at - b.at)
    .map((it, i) => ({ ...it, n: i + 1 }))
  const openCount = items.length
  // The list view, and its icon in the bar, only exist while there is something to list
  const listOpen = tabId === 'changes' && openCount > 0
  // Clear: mark every open note resolved, so the list empties. They stay in notes.json, and under their
  // element's Comment section (with Reopen). Live adjustments aren't notes yet: Reset undoes those.
  const openNotes = items.filter((it) => it.note)
  const clearNotes = () => openNotes.forEach((it) => notesApi.update(it.id, { status: 'resolved' }))
  // The list's Reset empties it: live adjustments are undone, and the notes are marked resolved
  const resetList = () => {
    resetAll()
    resetControls()
    clearNotes()
  }

  const flash = (text, ms = 1800) => {
    setNote(text)
    setTimeout(() => setNote(''), ms)
  }

  // A marker or list item: back to Inspect on its element (or its ruler guide); a note opens in the comment box
  const openItem = (it) => {
    // A control group's changes: back to Inspect, where its section is (on its element, if it has one)
    const group = it.control ?? controlGroups.find((g) => g.name === it.note?.control)
    if (group || it.note?.control) {
      setTab('inspect')
      setGuide(null)
      const el = group?.el?.()
      if (el) setSelected(el)
      return
    }
    if (it.note?.guide || it.el) setTab('inspect')
    if (it.note?.guide) {
      setSelected(null)
      setGuide({ ...it.note.guide, fx: it.fx, fy: it.fy })
      setFocusNote(it.id)
      return
    }
    if (!it.el) return
    setGuide(null)
    setSelected(it.el)
    setSpot({ fx: it.fx ?? 0, fy: it.fy ?? 0 })
    setFocusNote(it.kind === 'change' ? null : it.id)
  }

  const copy = async () => {
    const open = items
    const lines = [`Scootch notes on ${location.pathname} (${open.length})`, '']
    for (const it of open) {
      if (it.kind === 'change') lines.push(`${it.n}. ${changesText(it.group.list).trim()}`)
      else if (it.kind === 'control') lines.push(`${it.n}. ${controlNoteText(it.control).replace(/^1\. /, '')}`)
      else lines.push(`${it.n}. ${it.kind === 'sketch' ? 'Sketch on ' : ''}${it.note.components ? it.note.components + ' — ' : ''}${it.note.short}: ${it.comment}`, `   path: ${it.note.path}`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    flash('Copied')
  }

  const d = selected ? describe(selected) : null
  const comps = selected ? componentPath(selected) : []
  const isDocked = active && docked

  return (
    <>
      {!embed && <button
        ref={pill.ref}
        data-scootch
        className="sc-toggle sc-text"
        data-theme={theme}
        data-active={active || undefined}
        data-docked={isDocked || undefined}
        data-movable={!active || undefined}
        data-dragging={pill.dragging || undefined}
        data-snapping={pill.snapping || undefined}
        style={pill.style}
        {...pill.handlers}
        onClick={() => {
          if (pill.wasDrag()) return
          setActive((a) => !a)
        }}
        title={active ? 'Scootch (⌥I)' : 'Scootch (⌥I). Drag to move'}
      >
        <PillContent count={openCount} />
      </button>}

      {!embed && pill.homes &&
        ['bottom', 'top'].map((corner) => (
          <div
            key={corner}
            data-scootch
            aria-hidden
            className="sc-home"
            data-corner={corner}
            data-near={pill.homes.near === corner || undefined}
            style={{ width: pill.homes.width, height: pill.homes.height }}
          />
        ))}
      {panelHome && <div data-scootch aria-hidden className="sc-home" data-corner="panel" data-rulers={rulers || undefined} data-near={panelHome.near || undefined} />}
      {/* The page moves aside for the rulers (top and left) and the docked panel (right), so they
          don't cover any of it */}
      {active && (rulers || isDocked) && (
        <style data-scootch>
          {`html { margin: ${rulers ? RULER_SIZE : 0}px ${isDocked ? dockWidth : 0}px 0 ${rulers ? RULER_SIZE : 0}px !important; }`}
        </style>
      )}
      {active && rulers && <Rulers selected={selected} right={isDocked ? dockWidth : 0} pickedId={guide?.id} onPick={pickGuide} onMove={moveGuide} />}
      {active && <HoverBoxes selected={selected} pickable={pickable} />}
      {active && selected && <Boxes el={selected} kind="selected" record={record} />}
      {/* Only while inspecting; closed, the count on the pill says what's open */}
      {active && !embed && <Sketches notes={notes} draft={draft} drawing={drawing} onDraft={setDraft} />}
      {active && <Markers items={items} activeId={focusNote} onOpen={openItem} />}

      {isDocked && <DockHandle width={dockWidth} setWidth={setDockWidth} />}
      {active && (
        <aside
          data-scootch
          ref={panelRef}
          className="sc-panel sc-text"
          data-theme={theme}
          data-docked={isDocked || undefined}
          data-rulers={rulers || undefined}
          data-embed={embed || undefined}
          data-snapping={panelSnapping || undefined}
          style={isDocked ? { width: dockWidth } : embed ? undefined : panelPos ?? undefined}
        >
          <PanelBar
            drawing={drawing}
            onDrawing={() => setDrawing((d) => !d)}
            rulers={rulers}
            onRulers={() => setRulers((r) => !r)}
            docked={docked}
            onDocked={() => setDocked((v) => !v)}
            onClose={() => setActive(false)}
            changes={listOpen}
            onChanges={openCount > 0 ? () => setTab(listOpen ? 'inspect' : 'changes') : undefined}
            theme={theme}
            onTheme={flipTheme}
            embed={embed}
            breakpoint={breakpoint}
            grab={isDocked || embed ? undefined : { onPointerDown: grabPanel, onPointerMove: movePanel, onPointerUp: dropPanel, onPointerCancel: dropPanel }}
          />
          {!listOpen && <PanelTabs tabs={tabs} tabId={tabId} onTab={setTab} />}
          {drawing && <p className="sc-note sc-bar-note">Drag to sketch. ⇧D or Esc to stop</p>}
          {draft.length > 0 && (
            <SketchBox count={draft.length} onSave={saveSketch} onUndo={() => setDraft((d) => d.slice(0, -1))} onClear={() => setDraft([])} />
          )}
          {listOpen ? (
            <ChangesList
              rows={items.map((it) => ({
                id: it.id,
                n: it.n,
                kind: it.kind === 'change' || it.kind === 'saved' || it.kind === 'control' ? 'change' : 'note',
                text:
                  it.kind === 'change' || it.kind === 'control'
                    ? it.label
                    : it.kind === 'saved'
                      ? it.comment.split('\n')[0].replace(/^\d+\.\s*/, '')
                      : it.comment,
                detail:
                  it.kind === 'change'
                    ? it.group.list.map((ch) => `${propLabel(ch)} → ${toLabel(ch)}`).join(' · ')
                    : it.kind === 'control'
                      ? controlChangesText(it.control).join(' · ')
                      : `${it.kind === 'saved' ? 'Adjustments (saved)' : it.kind === 'sketch' ? `Sketch on ${it.label}` : it.label}${it.el || it.note?.control ? '' : ' · element not on the page'}`,
              }))}
              onOpen={(row) => openItem(items.find((it) => it.id === row.id))}
            />
          ) : appTab ? (
            <PanelScroll>{appTab.render()}</PanelScroll>
          ) : guide ? (
            <>
              <ElementHead title={guideLabel(guide)} sub={guide.dir === 'h' ? 'Horizontal guide' : 'Vertical guide'} onDeselect={() => setGuide(null)} />
              <PanelScroll>
                <CommentBox
                  key={guide.id}
                  notes={notes.filter((n) => n.guide?.id === guide.id)}
                  focusId={focusNote}
                  onAdd={(text) =>
                    notesApi.add(document.body, guide.fx, guide.fy, text, 'note', {
                      guide: { id: guide.id, dir: guide.dir, at: guide.at },
                      short: guideLabel(guide),
                      text: '',
                      components: '',
                    })
                  }
                  onUpdate={notesApi.update}
                  onRemove={notesApi.remove}
                />
              </PanelScroll>
            </>
          ) : selected ? (
            <>
              <ElementHead
                title={d.short}
                sub={comps.join(' › ')}
                onParent={() => selected.parentElement && setSelected(selected.parentElement)}
                onDeselect={() => setSelected(null)}
              />
              <PanelScroll>
                <ElementSections key={pageTheme} el={selected} record={record} reset={sectionReset} />
                <ControlSections selected={selected} />
              </PanelScroll>
              {/* Pinned under the values, outside the scroll: it focuses itself, which would otherwise
                  scroll the panel to the bottom every time you pick an element. Pick, type, Enter */}
              <div className="sc-pinned">
                <ScrollArea className="sc-pinned-scroll">
                  <div className="sc-scroll">
                    <CommentBox
                      key={cssPath(selected)}
                      notes={notes.filter((n) => n.path === cssPath(selected) && !n.guide)}
                      focusId={focusNote}
                      onAdd={(text) => notesApi.add(selected, spot.fx, spot.fy, text)}
                      onUpdate={notesApi.update}
                      onRemove={notesApi.remove}
                    />
                  </div>
                </ScrollArea>
              </div>
            </>
          ) : (
            <>
              <EmptyHint embed={embed} />
            </>
          )}

          {(items.length > 0 || note || notesApi.error) && (
            <PanelFoot
              onCopy={items.length > 0 ? copy : null}
              onReset={resetList}
              onViewAll={listOpen ? null : () => setTab('changes')}
              count={openCount}
              note={note || notesApi.error}
            />
          )}
        </aside>
      )}
    </>
  )
}

// The panel's pieces, exported so the panel and the pill can be laid out on a page (the design system's
// own site shows them that way). They aren't part of the package: index.jsx doesn't export them.
export { applyChange, ChangesList, ElementHead, ElementSections, EmptyHint, PanelBar, PanelFoot, PanelScroll, PanelTabs, PillContent, SketchBox, useForceUpdate, usePageTheme }
