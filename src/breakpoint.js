// Which breakpoint the window is in, worked out from the app's own CSS: every width its stylesheets'
// @media rules switch at. Nothing is set up and nothing is hardcoded to one design system. Where the app
// names its breakpoints as tokens (--breakpoint-m, --screen-md…), the name is given too.
//
// It goes by the window's width, because that is what the CSS goes by. A docked panel narrows the page
// but not the window, so the page keeps its breakpoint: `page` is the width the page actually has.
import { useEffect, useState } from 'react'
import { tokenNames } from './tokens'

const UNIT = { px: 1, em: 16, rem: 16 }
const NUM = '(\\d*\\.?\\d+)(px|em|rem)'
const px = (n, unit) => parseFloat(n) * UNIT[unit]
// Where a layout starts: at the width itself for "from", one past it for "up to" (max-width: 1279 → 1280)
const from = (v) => Math.ceil(v)
const after = (v) => Math.floor(v) + 1

// The widths one media condition switches at
function edgesIn(text, out) {
  for (const m of text.matchAll(new RegExp(`(min|max)-width\\s*:\\s*${NUM}`, 'gi'))) out.add(m[1].toLowerCase() === 'min' ? from(px(m[2], m[3])) : after(px(m[2], m[3])))
  // The range forms: width >= 1024px, width < 768px
  for (const m of text.matchAll(new RegExp(`\\bwidth\\s*(>=|<=|>|<)\\s*${NUM}`, 'gi'))) out.add(m[1] === '>=' || m[1] === '<' ? from(px(m[2], m[3])) : after(px(m[2], m[3])))
  // And the other way round: 768px <= width
  for (const m of text.matchAll(new RegExp(`${NUM}\\s*(<=|<|>=|>)\\s*width\\b`, 'gi'))) out.add(m[3] === '<=' || m[3] === '>' ? from(px(m[1], m[2])) : after(px(m[1], m[2])))
}

let cache = null
let sheetCount = -1

// Every width the page's stylesheets switch at, in order. Read again when a stylesheet is added or removed.
export function breakpointEdges() {
  if (cache && document.styleSheets.length === sheetCount) return cache
  const out = new Set()
  const walk = (rules) => {
    for (const r of rules) {
      const media = r.media?.mediaText
      if (media) edgesIn(media, out)
      try {
        if (r.styleSheet?.cssRules) walk(r.styleSheet.cssRules) // @import
        if (r.cssRules?.length) walk(r.cssRules)
      } catch {
        // a sheet from another origin
      }
    }
  }
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode?.id === 'scootch-styles') continue // Scootch's own
    try {
      if (sheet.media?.mediaText) edgesIn(sheet.media.mediaText, out)
      walk(sheet.cssRules)
    } catch {
      // cross-origin: nothing we can read
    }
  }
  sheetCount = document.styleSheets.length
  cache = [...out].filter((v) => v > 0 && v < 10000).sort((a, b) => a - b)
  return cache
}

// The app's named breakpoints: tokens like --breakpoint-m: 768px, widest first
function named() {
  const root = getComputedStyle(document.documentElement)
  const list = []
  for (const name of tokenNames()) {
    const m = name.match(/^--(?:breakpoints?|bp|screens?)-(.+)$/)
    const v = m && root.getPropertyValue(name).trim().match(new RegExp(`^${NUM}$`))
    if (v) list.push({ name: m[1], at: px(v[1], v[2]) })
  }
  return list.sort((a, b) => b.at - a.at)
}

// The breakpoint right now. from / to: the range of widths this layout holds for (null at either end).
// name: the app's own name for it, if it has one. width: the window. page: what the page has of it.
export function currentBreakpoint() {
  const width = window.innerWidth
  const edges = breakpointEdges()
  const lower = edges.filter((e) => e <= width).pop() ?? null
  const upper = edges.find((e) => e > width)
  return {
    width,
    page: Math.round(document.documentElement.getBoundingClientRect().width),
    from: lower,
    to: upper ? upper - 1 : null,
    name: named().find((t) => t.at <= width)?.name ?? null,
  }
}

// "1024–1279", "up to 359", "1440 and up"; with the app's name in front where it has one
export function breakpointRange(b) {
  if (b.from === null && b.to === null) return 'no breakpoints'
  return b.from === null ? `up to ${b.to}` : b.to === null ? `${b.from} and up` : `${b.from}–${b.to}`
}
export const breakpointLabel = (b) => `${b.name ? `${b.name} · ` : ''}${breakpointRange(b)}`

// Kept up to date as the window is resized (and as a docked panel narrows the page: pass what changes it)
export function useBreakpoint(...deps) {
  const [b, setB] = useState(null)
  useEffect(() => {
    const read = () => setB(currentBreakpoint())
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return b
}
