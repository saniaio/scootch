'use client'

// Rulers along the top and left of the page, like Figma. Drag out of a ruler to make a guide: from the
// top ruler a horizontal one, from the left ruler a vertical one. Drag a guide to move it, or back onto
// its ruler to remove it. Double-click the corner to clear them all.
// The rulers push the page in rather than cover it: Scootch gives the page a margin as wide as
// a ruler (see Scootch.jsx), and sticky elements move down to stay clear of the top ruler.
// Guides sit in page coordinates (0 is the page's top-left, beside the rulers), so they scroll with
// the page. While dragging they snap to the selected element's edges and centre. They're remembered
// in this browser. Click a guide (without dragging) to pick it, so it can take a note like an element.
import { useEffect, useRef, useState } from 'react'
import { newId, store } from './inspect'

export const RULER_SIZE = 20 // ruler thickness in px (--space-20 in the CSS)
const SIZE = RULER_SIZE
const SNAP = 5 // px on screen
const KEY = 'scootch-guides'

function loadGuides() {
  const list = store.get(KEY, [])
  return Array.isArray(list) ? list.filter((g) => (g?.dir === 'h' || g?.dir === 'v') && Number.isFinite(g.at)) : []
}

const saveGuides = (list) => store.set(KEY, list.map(({ id, dir, at }) => ({ id, dir, at })))

// Scroll position and window size, updated once a frame at most
function useViewport() {
  const read = () => ({ sx: window.scrollX, sy: window.scrollY, w: window.innerWidth, h: window.innerHeight })
  const [vp, setVp] = useState(read)
  useEffect(() => {
    let frame = 0
    const on = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setVp(read())
      })
    }
    window.addEventListener('scroll', on, { passive: true, capture: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', on, { capture: true })
      window.removeEventListener('resize', on)
    }
  }, [])
  return vp
}

// Redraw when the theme changes (the colours come from the CSS)
function useThemeKey() {
  const [key, setKey] = useState(0)
  useEffect(() => {
    const mo = new MutationObserver(() => setKey((k) => k + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => mo.disconnect()
  }, [])
  return key
}

// Sticky elements stick to the window's top edge, under the top ruler. Move each one down by the
// ruler's height while the rulers show, and put them back after. Pages that load later are caught too.
function useStickyClearance() {
  useEffect(() => {
    const moved = new Map() // element → its own inline top, to restore
    const scan = () => {
      for (const el of document.body.querySelectorAll('*')) {
        if (moved.has(el)) continue
        const c = getComputedStyle(el)
        if (c.position !== 'sticky' || c.top === 'auto') continue
        moved.set(el, [el.style.getPropertyValue('top'), el.style.getPropertyPriority('top')])
        el.style.setProperty('top', `calc(${c.top} + ${SIZE}px)`, 'important')
      }
    }
    scan()
    let timer = 0
    const ours = (n) => n.nodeType !== 1 || n.closest('[data-scootch]')
    const mo = new MutationObserver((records) => {
      // Scootch's own boxes and markers come and go all the time: ignore those
      if (records.every((r) => [...r.addedNodes, ...r.removedNodes].every(ours))) return
      clearTimeout(timer)
      timer = setTimeout(scan, 200)
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      clearTimeout(timer)
      for (const [el, [top, priority]] of moved) {
        if (top) el.style.setProperty('top', top, priority)
        else el.style.removeProperty('top')
      }
    }
  }, [])
}

// One ruler, drawn on a canvas. axis 'x' is the top ruler, 'y' the left one.
// offset: the page coordinate at the ruler's start. band: the selected element's span, in page coordinates.
function Ruler({ axis, length, offset, band, accentRef, themeKey, onPointerDown }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || length <= 0) return
    const dpr = window.devicePixelRatio || 1
    const w = axis === 'x' ? length : SIZE
    const h = axis === 'x' ? SIZE : length
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    const ctx = cv.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const cs = getComputedStyle(cv)
    const ink = cs.color
    const accent = accentRef.current ? getComputedStyle(accentRef.current).color : ink
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    ctx.textBaseline = 'alphabetic'

    // Draws a label next to screen position s: right of it on the top ruler, below it on the left one
    const label = (text, s, colour) => {
      ctx.fillStyle = colour
      if (axis === 'x') ctx.fillText(text, s + 3, 11)
      else {
        const tw = ctx.measureText(text).width
        ctx.save()
        ctx.translate(11, s + 3 + tw)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(text, 0, 0)
        ctx.restore()
      }
    }
    const line = (s, len, colour, alpha) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = colour
      if (axis === 'x') ctx.fillRect(Math.round(s), SIZE - len, 1, len)
      else ctx.fillRect(SIZE - len, Math.round(s), len, 1)
      ctx.globalAlpha = 1
    }

    // The selected element: a tinted span with its start and end
    const a = band ? band[0] - offset : null
    const b = band ? band[1] - offset : null
    if (band) {
      ctx.globalAlpha = 0.14
      ctx.fillStyle = accent
      if (axis === 'x') ctx.fillRect(a, 0, b - a, SIZE)
      else ctx.fillRect(0, a, SIZE, b - a)
      ctx.globalAlpha = 1
    }

    // Ticks every 10px, longer every 50, a label every 100. Labels near the band's ends are left out.
    const nearBand = (s) => band && (Math.abs(s - a) < 34 || Math.abs(s - b) < 34)
    const first = Math.floor(offset / 10) * 10
    for (let v = first; v <= offset + length; v += 10) {
      const s = v - offset
      if (s < SIZE) continue // under the corner
      if (v % 100 === 0) {
        line(s, SIZE, ink, 0.45)
        if (!nearBand(s)) label(String(v), s, ink)
      } else line(s, v % 50 === 0 ? 6 : 3, ink, 0.45)
    }

    if (band) {
      line(a, SIZE, accent, 1)
      line(b, SIZE, accent, 1)
      label(String(Math.round(band[0])), a, accent)
      if (b - a > 30) label(String(Math.round(band[1])), b, accent)
    }
  }, [axis, length, offset, band?.[0], band?.[1], themeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={ref}
      className={`sc-ruler sc-ruler-${axis}`}
      style={axis === 'x' ? { width: length, height: SIZE } : { width: SIZE, height: length }}
      onPointerDown={onPointerDown}
    />
  )
}

// right: how much of the window's right edge the docked panel takes (0 when it floats)
// pickedId: the guide picked for a note. onPick(guide, x, y): a guide was clicked, at that point on screen.
// onMove(guide): a guide was dragged somewhere else, so its notes can follow.
export default function Rulers({ selected, right = 0, pickedId = null, onPick, onMove }) {
  const vp = useViewport()
  useStickyClearance()
  const themeKey = useThemeKey()
  const accentRef = useRef(null)
  const [guides, setGuides] = useState([])
  const [drag, setDrag] = useState(null) // { id, dir, x, y, removing }

  useEffect(() => setGuides(loadGuides()), [])

  const pageW = vp.w - right
  const r = selected?.isConnected ? selected.getBoundingClientRect() : null
  // Page coordinates: 0 is where the page starts, just past the ruler
  const ox = vp.sx - SIZE
  const oy = vp.sy - SIZE
  const bandX = r ? [r.left + ox, r.right + ox] : null
  const bandY = r ? [r.top + oy, r.bottom + oy] : null

  // Start dragging a guide: a new one out of a ruler, or an existing one
  const startDrag = (e, dir, id) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    let gid = id
    if (!gid) {
      gid = newId('g')
      const at = dir === 'h' ? e.clientY + window.scrollY - SIZE : e.clientX + window.scrollX - SIZE
      setGuides((list) => [...list, { id: gid, dir, at: Math.round(at) }])
    }
    document.documentElement.dataset.scGuideDrag = dir
    let removing = !id
    let moved = false
    let last = null

    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return // still a click
      moved = true
      const sx = window.scrollX - SIZE
      const sy = window.scrollY - SIZE
      const screen = dir === 'h' ? ev.clientY : ev.clientX
      let at = screen + (dir === 'h' ? sy : sx)
      // Snap to the selected element's edges and centre
      const el = selected?.isConnected ? selected.getBoundingClientRect() : null
      if (el) {
        const edges = dir === 'h' ? [el.top, el.top + el.height / 2, el.bottom] : [el.left, el.left + el.width / 2, el.right]
        const hit = edges.find((p) => Math.abs(p - screen) <= SNAP)
        if (hit !== undefined) at = hit + (dir === 'h' ? sy : sx)
      }
      at = Math.round(at)
      last = at
      // Back on its ruler, or off the page: let go to remove it
      removing = screen < SIZE || (dir === 'v' && screen > window.innerWidth - right) || screen > (dir === 'h' ? window.innerHeight : window.innerWidth)
      setGuides((list) => list.map((g) => (g.id === gid ? { ...g, at } : g)))
      setDrag({ id: gid, dir, x: ev.clientX, y: ev.clientY, at, removing })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      // Kept until the click that follows the release has passed, so it doesn't select what's under it
      setTimeout(() => delete document.documentElement.dataset.scGuideDrag, 0)
      setGuides((list) => {
        const next = removing ? list.filter((g) => g.id !== gid) : list
        saveGuides(next) // the same result if React runs this twice
        return next
      })
      setDrag(null)
      if (id && !moved) onPick?.({ id, dir, at: guides.find((g) => g.id === id)?.at }, e.clientX, e.clientY)
      else if (id && !removing && last !== null) onMove?.({ id, dir, at: last })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    setDrag({ id: gid, dir, x: e.clientX, y: e.clientY, at: null, removing: !id })
  }

  const clearGuides = () => {
    setGuides([])
    saveGuides([])
  }

  return (
    <div data-scootch className="sc-rulers">
      <span ref={accentRef} className="sc-ruler-accent" aria-hidden />

      {guides.map((g) => {
        const s = g.dir === 'h' ? g.at - oy : g.at - ox
        if (s < -4 || s > (g.dir === 'h' ? vp.h : pageW) + 4) return null
        const style = g.dir === 'h' ? { top: s, left: 0, width: pageW } : { left: s, top: 0, height: vp.h }
        return (
          <div
            key={g.id}
            className="sc-guide"
            data-dir={g.dir}
            data-dragging={drag?.id === g.id || undefined}
            data-removing={(drag?.id === g.id && drag.removing) || undefined}
            data-picked={g.id === pickedId || undefined}
            style={style}
            title={`${g.dir === 'h' ? 'Y' : 'X'} ${g.at}. Click to add a note, drag back onto the ruler to remove`}
            onPointerDown={(e) => startDrag(e, g.dir, g.id)}
          />
        )
      })}

      <Ruler
        axis="x"
        length={pageW}
        offset={ox}
        band={bandX}
        accentRef={accentRef}
        themeKey={themeKey}
        onPointerDown={(e) => startDrag(e, 'h')}
      />
      <Ruler
        axis="y"
        length={vp.h}
        offset={oy}
        band={bandY}
        accentRef={accentRef}
        themeKey={themeKey}
        onPointerDown={(e) => startDrag(e, 'v')}
      />
      <button
        className="sc-ruler-corner"
        title={guides.length ? 'Double-click to clear the guides' : 'Drag out of a ruler to add a guide'}
        onDoubleClick={clearGuides}
        aria-label="Clear guides"
      />

      {drag && drag.at !== null && (
        <span
          className="sc-guide-tag"
          data-removing={drag.removing || undefined}
          style={drag.dir === 'h' ? { left: drag.x + 12, top: drag.y - 22 } : { left: drag.x + 8, top: drag.y + 12 }}
        >
          {drag.removing ? 'Remove' : `${drag.dir === 'h' ? 'Y' : 'X'} ${drag.at}`}
        </span>
      )}
    </div>
  )
}
