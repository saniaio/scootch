'use client'

// Comments for Scootch: pick an element, type in the comment box under its values, Enter, and a
// numbered marker stays pinned to where you clicked on it. Notes are saved in the project
// (.notes/notes.json, through /api/notes) and re-found by their CSS path after a reload.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CommentBox as LibraryCommentBox, Marker, Textarea } from './system/index'
import { componentPath, cssPath, describe, newId } from './inspect'
import { breakpointLabel, currentBreakpoint } from './breakpoint'

let API = '/api/notes'
// Set by <Scootch notesApi>
export const setNotesApi = (url) => {
  API = url
}
const json = (method, body) =>
  fetch(API, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => {
    if (!r.ok) throw new Error(`Notes: ${r.status}`)
    return r.json()
  })

// A note: { id, page, kind: 'note' | 'changes' | 'sketch', path, fx, fy, comment, short, text, components,
//           status: 'open' | 'resolved', reply }. fx / fy place the marker inside the element (0–1 of its
// width / height), so it follows the element when the page moves. A sketch also has strokes: freehand
// lines drawn over the element, each a list of [fx, fy] points in the same 0–1 space. Saved through
// /api/notes to .notes/notes.json, where you (or an AI agent) read them, reply and mark them resolved.
// local: keep the notes in memory only and never call the API (the embedded panel on a public page,
// where there is no notes server). They last until the page is reloaded.
export function useNotes(watch, local = false) {
  const [notes, setNotes] = useState([])
  const [error, setError] = useState('')
  const page = typeof window === 'undefined' ? '' : location.pathname
  const load = useCallback(() => {
    if (local) return
    fetch(`${API}?page=${encodeURIComponent(page)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((list) => {
        setNotes(list)
        setError('')
      })
      .catch(() => setError('Notes need the dev server'))
  }, [page, local])
  useEffect(() => load(), [load])
  // While Scootch is open, pick up new replies
  useEffect(() => {
    if (!watch) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [watch, load])

  const add = async (el, fx, fy, comment, kind = 'note', extra = {}) => {
    const d = describe(el)
    // Where it was written: the breakpoint and the window's width, so a fix is made for that size and
    // not for all of them. pageWidth only when the page had less than the window (a docked panel, rulers).
    const b = currentBreakpoint()
    const note = {
      id: newId('n-'), // notes saved in the same ms (several elements adjusted at once) still differ
      page,
      kind,
      path: cssPath(el),
      fx,
      fy,
      comment,
      short: d.short,
      text: d.text,
      components: componentPath(el).join(' › '),
      status: 'open',
      at: new Date().toISOString(),
      breakpoint: breakpointLabel(b),
      width: b.width,
      ...(b.page < b.width ? { pageWidth: b.page } : {}),
      ...extra,
    }
    setNotes((list) => [...list, note])
    if (!local) await json('POST', note).catch(() => setError('Couldn’t save: is the dev server running?'))
    return note
  }
  const update = async (id, patch) => {
    setNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)))
    if (!local) await json('PATCH', { id, ...patch }).catch(() => setError('Couldn’t save'))
  }
  const remove = async (id) => {
    setNotes((list) => list.filter((n) => n.id !== id))
    if (!local) await json('DELETE', { id }).catch(() => setError('Couldn’t delete'))
  }
  return { notes, error, add, update, remove }
}

export const elementFor = (note) => {
  try {
    return document.querySelector(note.path)
  } catch {
    return null
  }
}

// Where a marker sits on screen: its spot inside the element (or nowhere if the element is gone)
function spotOf(el, fx = 0, fy = 0) {
  if (!el?.isConnected) return null
  const r = el.getBoundingClientRect()
  if (!r.width && !r.height) return null
  return { x: r.left + r.width * fx, y: r.top + r.height * fy }
}

// Re-renders every frame while on, so markers (and Scootch's boxes) keep up with scrolling and layout changes.
export function useFrame(on) {
  const [, force] = useState(0)
  useEffect(() => {
    if (!on) return
    let id = 0
    const tick = () => {
      force((n) => n + 1)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [on])
}

// The numbered markers: one per item ({ n, kind: 'note' | 'sketch' | 'saved' | 'change', el, fx, fy, id }).
// The library's Marker: a note or sketch in the accent, an adjusted element in the text colour.
export function Markers({ items, activeId, onOpen }) {
  useFrame(items.length > 0)
  return (
    <div data-scootch className="sc-markers">
      {items.map((it) => {
        const spot = spotOf(it.el, it.fx, it.fy)
        if (!spot) return null
        return (
          <Marker
            key={it.id}
            n={it.n}
            kind={it.kind === 'change' || it.kind === 'saved' ? 'change' : 'note'}
            active={it.id === activeId}
            style={{ left: spot.x, top: spot.y }}
            onClick={() => onOpen(it)}
            title={it.kind === 'change' ? it.label : it.comment}
          />
        )
      })}
    </div>
  )
}

// The comment box in the panel, under the selected element's values: the library's CommentBox, with its
// notes so far (edit, delete, reopen, see the reply) and a box for a new one, ready to type the moment an
// element is picked. Saved adjustments show as such; their text is the changes, so it isn't edited here.
export function CommentBox({ notes, focusId, onAdd, onUpdate, onRemove, autoFocus = true }) {
  const shown = notes.map((n) => (n.kind === 'changes' ? { ...n, comment: 'Adjustments saved' } : n))
  const update = (id, patch) => {
    const n = notes.find((x) => x.id === id)
    if (n?.kind === 'changes' && 'comment' in patch) return
    onUpdate(id, patch)
  }
  return (
    <section className="sc-section sc-comment">
      <h4 className="sc-heading">Comment</h4>
      <LibraryCommentBox autoFocus={autoFocus} notes={shown} focusId={focusId} onAdd={onAdd} onChange={update} onRemove={onRemove} />
    </section>
  )
}

/* ---------- Sketches: draw on the page (⇧D), then say what it means ---------- */

// Strokes are drawn in page coordinates (so they stay put while you scroll), then saved as fractions of
// one element's box, like a marker's spot, so the sketch follows that element when the page moves.

const pageRect = (el) => {
  const r = el.getBoundingClientRect()
  return { l: r.left + scrollX, t: r.top + scrollY, w: r.width, h: r.height }
}

// The element a sketch belongs to: the one under its first point, then up the tree until one holds
// the whole sketch (a few px of slack), or the body.
export function anchorFor(strokes) {
  const pts = strokes.flat()
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const box = { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) }
  // Through the drawing layer (and the markers) to the page underneath
  const under = (x, y) => document.elementsFromPoint(x - scrollX, y - scrollY).find((n) => !n.closest('[data-scootch]') && n !== document.documentElement)
  let el = under(...pts[0]) ?? under((box.l + box.r) / 2, (box.t + box.b) / 2) ?? document.body
  const slack = 4
  while (el !== document.body && el.parentElement) {
    const r = pageRect(el)
    if (r.l - slack <= box.l && r.t - slack <= box.t && r.l + r.w + slack >= box.r && r.t + r.h + slack >= box.b) break
    el = el.parentElement
  }
  return el
}

// Strokes as fractions of the element's box, and where the marker goes (the middle of the sketch)
export function toRelative(strokes, el) {
  const r = pageRect(el)
  const f = (v) => Math.round(v * 10000) / 10000 // fine enough to stay sub-pixel on a tall page
  const rel = strokes.map((s) => s.map(([x, y]) => [f(r.w ? (x - r.l) / r.w : 0), f(r.h ? (y - r.t) / r.h : 0)]))
  const pts = rel.flat()
  const mid = (i) => (Math.min(...pts.map((p) => p[i])) + Math.max(...pts.map((p) => p[i]))) / 2
  return { strokes: rel, fx: f(mid(0)), fy: f(mid(1)) }
}

// A smooth line through the points: a curve from each midpoint to the next, bending at the point between
// them, so there are no corners where the samples join. A single point draws as a dot.
const r1 = (v) => Math.round(v * 10) / 10
const smooth = (pts) => {
  const [x0, y0] = pts[0]
  if (pts.length < 3) return `M${r1(x0)} ${r1(y0)}L${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' ')}`
  let d = `M${r1(x0)} ${r1(y0)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    d += `Q${r1(x)} ${r1(y)} ${r1((x + nx) / 2)} ${r1((y + ny) / 2)}`
  }
  const [lx, ly] = pts[pts.length - 1]
  return `${d}L${r1(lx)} ${r1(ly)}`
}

// The layer the sketches live on. Open sketch notes show on their elements; while drawing it takes
// every drag as a stroke (one finger or pen too) and keeps the draft until it's saved or cleared.
export function Sketches({ notes, draft, drawing, onDraft }) {
  useFrame(true) // follow scrolling and layout, like the markers
  const svg = useRef(null)
  const stroke = useRef(null)

  const down = (e) => {
    if (!drawing || e.button !== 0) return
    e.preventDefault()
    svg.current.setPointerCapture(e.pointerId)
    stroke.current = [[e.clientX + scrollX, e.clientY + scrollY]]
    onDraft((d) => [...d, stroke.current])
  }
  const move = (e) => {
    if (!stroke.current) return
    // Every sample the pointer gave since the last frame, not just the latest, so fast strokes keep their shape
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    const next = [...stroke.current]
    for (const ev of events.length ? events : [e]) {
      const p = [ev.clientX + scrollX, ev.clientY + scrollY]
      const last = next[next.length - 1]
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3) next.push(p) // skip hand jitter
    }
    if (next.length === stroke.current.length) return
    stroke.current = next
    onDraft((d) => [...d.slice(0, -1), stroke.current])
  }
  const up = () => {
    stroke.current = null
  }

  const saved = notes
    .filter((n) => n.kind === 'sketch' && n.status !== 'resolved' && n.strokes)
    .flatMap((n) => {
      const el = elementFor(n)
      if (!el?.isConnected) return []
      const r = el.getBoundingClientRect()
      return n.strokes.map((s, i) => ({ key: `${n.id}-${i}`, pts: s.map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]) }))
    })
  const live = draft.map((s, i) => ({ key: `draft-${i}`, pts: s.map(([x, y]) => [x - scrollX, y - scrollY]) }))

  return (
    <svg ref={svg} data-scootch className="sc-draw" data-on={drawing || undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {saved.map((s) => (
        <path key={s.key} className="sc-stroke" d={smooth(s.pts)} />
      ))}
      {live.map((s) => (
        <path key={s.key} className="sc-stroke" data-draft d={smooth(s.pts)} />
      ))}
    </svg>
  )
}

// In the panel while there's a draft: say what the sketch means, Enter saves it as a note
export function SketchBox({ count, onSave, onUndo, onClear }) {
  const [text, setText] = useState('')
  const save = () => {
    const t = text.trim()
    if (!t) return
    onSave(t)
    setText('')
  }
  return (
    <section className="sc-section sc-sketch">
      <h4 className="sc-heading">
        Sketch · {count} stroke{count === 1 ? '' : 's'}
      </h4>
      <Textarea
        autoFocus
        aria-label="What the sketch means"
        placeholder="What the sketch means. Enter to save"
        value={text}
        minRows={2}
        maxRows={6}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      />
      <div className="sc-sketch-actions">
        <button className="sc-link-btn" onClick={onUndo}>
          Undo stroke
        </button>
        <button className="sc-link-btn" onClick={onClear}>
          Clear
        </button>
      </div>
    </section>
  )
}
