// DOM helpers for Scootch: what a CSS property is declared as, which token it uses,
// live token values, React component names, and a readable description of an element.
import { colourNames, isInternal, isToken, namesIn, reset as resetTokens, typeClasses, tokenNames } from './tokens'

/* ---------- Tokens, resolved live (they change with Light / Dark) ---------- */

const root = () => getComputedStyle(document.documentElement)

// A token's value in px: px as is, rem / em from the root font size (Tailwind writes rem). Anything worked
// out (calc(), max(), var()) is measured on a hidden probe, so derived tokens (calc(12px * var(--roundness)))
// count too. Else null.
let probe = null
function measure(name) {
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;'
  }
  if (!probe.isConnected) document.documentElement.appendChild(probe)
  probe.style.width = '0px'
  probe.style.width = `var(${name})`
  const w = parseFloat(getComputedStyle(probe).width)
  return Number.isFinite(w) && probe.style.width ? w : null
}

const pxOf = (v, name) => {
  const s = v.trim()
  if (!s) return null
  const n = parseFloat(s)
  if (/^-?[\d.]+px$/.test(s)) return n
  if (/^-?[\d.]+r?em$/.test(s)) return n * parseFloat(root().fontSize)
  if (name && /(calc|min|max|clamp|var)\(/.test(s)) return measure(name)
  return null
}

// Tokens with a px value in one group (space, fontSize, lineHeight, radius, borderWidth; see tokens.js),
// smallest first.
export function pxTokens(group) {
  const r = root()
  return namesIn(group)
    .map((name) => ({ name, px: pxOf(r.getPropertyValue(name), name) }))
    .filter((t) => t.px !== null)
    .sort((a, b) => a.px - b.px)
}

// Spacing tokens with their px value, smallest first.
export const spaceTokens = () => pxTokens('space')

export function weightTokens() {
  const r = root()
  return namesIn('weight')
    .map((name) => ({ name, value: r.getPropertyValue(name).trim() }))
    .filter((t) => t.value)
}

export function trackingTokens() {
  const r = root()
  return namesIn('tracking').map((name) => ({ name, value: r.getPropertyValue(name).trim() }))
}

// The first family in a font stack, without its quotes: '"ABC Areal", sans-serif' → ABC Areal
export const firstFamily = (stack) => (stack ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '')

// Font tokens: custom properties whose value is a font stack. Told by the value, not the name, since
// names vary (--font-sans, --font-primary, --ff-body): it has quotes, a comma or a generic family, and
// the browser accepts it as a font-family.
const GENERIC_FAMILY = /(^|,\s*)(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)\s*(,|$)/
export function fontTokens() {
  const r = root()
  return tokenNames()
    .map((name) => ({ name, value: r.getPropertyValue(name).trim() }))
    .filter((t) => t.value && !/^[\d.+-]/.test(t.value) && (/["',]/.test(t.value) || GENERIC_FAMILY.test(t.value)) && CSS.supports('font-family', t.value))
}

// The fonts the project has added: every family with an @font-face (or loaded by script), by name
export function projectFonts() {
  const names = new Set()
  for (const face of document.fonts) names.add(firstFamily(face.family))
  // Not the app's: Next.js loads its own for its dev overlay
  return [...names].filter((n) => n && !n.startsWith('__nextjs')).sort((a, b) => a.localeCompare(b))
}

// Colour tokens resolved to the browser's rgb() string, for matching computed colours.
// Plain roles first, so a match prefers --primary over a grey.
export function colourTokens() {
  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const list = colourNames()
    .map((name) => {
      probe.style.color = ''
      probe.style.color = `var(${name})`
      return { name, rgb: getComputedStyle(probe).color }
    })
    .sort((a, b) => colourRank(a.name) - colourRank(b.name) || a.name.localeCompare(b.name, undefined, { numeric: true }))
  probe.remove()
  return list
}

// The order colour tokens are listed in, the ones you reach for first at the top:
//   the text colour, then the greys (darkest first), then the page and its surfaces,
//   then the accent and links, then status colours, then everything else,
//   and at the very bottom the extras: tags, tints, shadows and effects
const GREY = /^--(grey|gray|neutral|foreground)-(\d+)$/
function colourRank(name) {
  if (/^--(primary|foreground|text|black|ink)$/.test(name)) return 0
  const g = name.match(GREY)
  if (g) return 1 + (100 - Number(g[2])) / 1000 // grey-60 before grey-5
  if (/^--(background|surface|surface-[a-z]+|white|canvas)$/.test(name)) return 2
  if (/^--(accent|brand|link|ring|on-accent|highlight)$/.test(name)) return 3
  if (/^--(destructive|success|warning|info|danger|error)$/.test(name)) return 4
  if (/^--(tag-|shadow|checker|shimmer)/.test(name) || /-(base|\d+)$/.test(name)) return 6
  return 5
}

// The app's type classes (found in its CSS, see tokens.js), each measured on a probe so values follow the live CSS.
export { typeClasses }
const TYPE_PROPS = ['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'fontFamily']

export function typeStyles() {
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.textContent = 'x'
  document.body.appendChild(probe)
  const out = typeClasses().map((cls) => {
    probe.className = cls
    const c = getComputedStyle(probe)
    return { cls, ...Object.fromEntries(TYPE_PROPS.map((p) => [p, c[p]])) }
  })
  probe.remove()
  return out
}

/* ---------- What a property is declared as ---------- */

// Every style rule on the page, in source order, each with what the cascade needs to rank it: its selectors
// (a nested rule's written out in full) with their specificity, and the cascade layer it sits in.
let ruleCache = null
let sheetCount = -1

// Split at top-level commas: ".a, .b:is(.c, .d)" → two parts.
function splitList(value) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

// A selector's specificity as [ids, classes, elements]. :is(), :not() and :has() count as their most specific
// argument, :where() as nothing; attributes and other pseudo-classes count as a class.
const PSEUDO_ELEMENT = /^(before|after|first-line|first-letter)$/
function specificity(selector) {
  const out = [0, 0, 0]
  const s = selector
  let i = 0
  const ident = () => {
    const m = s.slice(i).match(/^(?:\\.|[\w-]|[^\x00-\x7f])+/)
    i += m ? m[0].length : 1
    return m ? m[0] : ''
  }
  // The text inside the brackets that open at i, and i moved past them
  const inside = (open, close) => {
    let depth = 0
    const from = i + 1
    for (; i < s.length; i++) {
      if (s[i] === open) depth++
      else if (s[i] === close && --depth === 0) break
    }
    return s.slice(from, i++)
  }
  let compoundStart = true
  while (i < s.length) {
    const ch = s[i]
    if (ch === '#') (i++, ident(), out[0]++)
    else if (ch === '.') (i++, ident(), out[1]++)
    else if (ch === '[') (inside('[', ']'), out[1]++)
    else if (ch === ':') {
      const element = s[i + 1] === ':'
      i += element ? 2 : 1
      const name = ident().toLowerCase()
      const args = s[i] === '(' ? inside('(', ')') : null
      if (element || PSEUDO_ELEMENT.test(name)) out[2]++
      else if (name === 'where') {
        // counts for nothing
      } else if ((name === 'is' || name === 'not' || name === 'has' || name === 'matches') && args !== null) {
        const best = splitList(args).map(specificity).sort(compareSpecificity).pop()
        if (best) best.forEach((n, k) => (out[k] += n))
      } else out[1]++
    } else if (/[\s>+~]/.test(ch)) {
      i++
      compoundStart = true
      continue
    } else if (ch === '*' || ch === '&' || ch === '|') i++
    else if (compoundStart) (ident(), out[2]++)
    else i++
    compoundStart = false
  }
  return out
}
const compareSpecificity = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// A nested rule's selector, written out against its parent: "&:hover" inside ".card" → ":is(.card):hover"
const nestSelector = (selector, parent) =>
  splitList(selector)
    .map((part) => (part.includes('&') ? part.replaceAll('&', `:is(${parent})`) : `:is(${parent}) ${part}`))
    .join(', ')

// Cascade layers, numbered in the order they are first named: a layer's path is its number at each level,
// so "base" inside the second layer of the page is [1, 0]. Rules outside every layer have no path.
let layerNumbers = new Map()
function layerPath(parent, name) {
  let path = parent
  // An unnamed layer is its own, new each time
  for (const part of name ? name.split('.') : [`(unnamed ${layerNumbers.size})`]) {
    const key = `${path.join('/')}/${part}`
    if (!layerNumbers.has(key)) {
      const siblings = `${path.join('/')}/#`
      layerNumbers.set(siblings, (layerNumbers.get(siblings) ?? -1) + 1)
      layerNumbers.set(key, layerNumbers.get(siblings))
    }
    path = [...path, layerNumbers.get(key)]
  }
  return path
}
// Which layer wins, for declarations that aren't !important: no layer beats any layer, a later layer beats
// an earlier one, and a rule straight in a layer beats one in a layer inside it. Above 0: a wins.
function compareLayers(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return 1
    if (b[i] === undefined) return -1
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

const kindOfRule = (rule) => rule.constructor.name

function collectRules(list, out, layer = [], parent = null) {
  for (const rule of list) {
    const kind = kindOfRule(rule)
    if (rule.selectorText !== undefined && rule.style) {
      const selector = parent ? nestSelector(rule.selectorText, parent) : rule.selectorText
      out.push({ style: rule.style, layer, parts: splitList(selector).map((sel) => ({ sel, spec: specificity(sel) })) })
      // Rules nested inside it (&:hover, a @media around some of its declarations)
      if (rule.cssRules?.length) collectRules(rule.cssRules, out, layer, selector)
    } else if (kind === 'CSSNestedDeclarations') {
      // Declarations a nested @media (or the like) wraps: they belong to the rule they are inside
      if (parent) out.push({ style: rule.style, layer, parts: splitList(parent).map((sel) => ({ sel, spec: specificity(sel) })) })
    } else if (kind === 'CSSLayerStatementRule') {
      // @layer theme, base, utilities; sets the order before any of them holds a rule
      for (const name of rule.nameList) layerPath(layer, name)
    } else if (kind === 'CSSImportRule') {
      try {
        if (rule.styleSheet) collectRules(rule.styleSheet.cssRules, out, rule.layerName != null ? layerPath(layer, rule.layerName) : layer, parent)
      } catch {
        // a sheet from another origin
      }
    } else if (rule.cssRules) {
      // @media and @supports: only what applies right now. @container and the rest are kept.
      if (rule.media && rule.conditionText && !window.matchMedia(rule.conditionText).matches) continue
      if (kind === 'CSSSupportsRule' && !CSS.supports(rule.conditionText)) continue
      collectRules(rule.cssRules, out, kind === 'CSSLayerBlockRule' ? layerPath(layer, rule.name) : layer, parent)
    }
  }
}

function allRules() {
  if (ruleCache && document.styleSheets.length === sheetCount) return ruleCache
  const out = []
  layerNumbers = new Map()
  for (const sheet of document.styleSheets) {
    try {
      collectRules(sheet.cssRules, out)
    } catch {
      // cross-origin sheet (Google Fonts): nothing we can read
    }
  }
  out.forEach((rule, i) => (rule.order = i))
  ruleCache = out
  sheetCount = document.styleSheets.length
  return out
}

export function resetRuleCache() {
  resetTokens()
  ruleCache = null
  matchCache = new WeakMap()
}

// The rules that match an element, weakest first as the cascade ranks them (layer, then specificity, then
// source order), cached until its classes change. A rule's specificity is that of its most specific
// selector that matches.
let matchCache = new WeakMap()
function matchedRules(el) {
  const hit = matchCache.get(el)
  if (hit && hit.cls === el.className) return hit.rules
  const rules = []
  for (const rule of allRules()) {
    let spec = null
    for (const part of rule.parts) {
      try {
        if (el.matches(part.sel) && (!spec || compareSpecificity(part.spec, spec) > 0)) spec = part.spec
      } catch {
        // a selector this browser doesn't know
      }
    }
    if (spec) rules.push({ style: rule.style, layer: rule.layer, spec, order: rule.order })
  }
  rules.sort((a, b) => compareLayers(a.layer, b.layer) || compareSpecificity(a.spec, b.spec) || a.order - b.order)
  matchCache.set(el, { cls: el.className, rules })
  return rules
}

// Split a shorthand value at top-level spaces: "var(--a) calc(1px + 2px)" → two parts.
function splitTop(value) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of value.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ' ' && depth === 0) {
      if (cur) parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) parts.push(cur)
  return parts
}

// Which part of a box shorthand is this side? (1–4 values, CSS order: top right bottom left)
const BOX_INDEX = { top: [0, 0, 0, 0], right: [0, 1, 1, 1], bottom: [0, 0, 2, 2], left: [0, 1, 1, 3] }
const pickSide = (value, side) => {
  const parts = splitTop(value)
  return parts[BOX_INDEX[side][parts.length - 1]] ?? value
}
// Two-value logical shorthand (padding-inline: start end)
const pickPair = (value, i) => {
  const parts = splitTop(value)
  return parts[Math.min(i, parts.length - 1)] ?? value
}

// One part of a `border` shorthand: "var(--border-width) solid var(--grey-12)"
const BORDER_STYLES = /^(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/
const isWidth = (p) => /^(\d|\.|thin|medium|thick|calc\(|var\(--(border-width|space-|size-))/.test(p)
function pickBorder(value, part) {
  const parts = splitTop(value)
  if (part === 'style') return parts.find((p) => BORDER_STYLES.test(p)) ?? null
  if (part === 'width') return parts.find(isWidth) ?? null
  return parts.find((p) => !BORDER_STYLES.test(p) && !isWidth(p)) ?? null
}

// Every way a property can be written, longhand first, each with how to pull this property out.
function sources(prop) {
  const m = prop.match(/^(padding|margin)-(top|right|bottom|left)$/)
  if (m) {
    const [, box, side] = m
    const axis = side === 'top' || side === 'bottom' ? 'block' : 'inline'
    const pairIndex = side === 'top' || side === 'left' ? 0 : 1
    const logical = `${box}-${axis}-${pairIndex === 0 ? 'start' : 'end'}`
    return [
      [prop, (v) => v],
      [logical, (v) => v],
      [`${box}-${axis}`, (v) => pickPair(v, pairIndex)],
      [box, (v) => pickSide(v, side)],
    ]
  }
  // Border: the shorthand for all sides, then the top side, then the part of `border` it sits in
  if (prop === 'border-width' || prop === 'border-style' || prop === 'border-color') {
    const part = prop.split('-')[1]
    return [
      [prop, (v) => pickSide(v, 'top')],
      [`border-top-${part}`, (v) => v],
      ['border-top', (v) => pickBorder(v, part)],
      ['border', (v) => pickBorder(v, part)],
    ]
  }
  if (prop === 'background-color') return [['background-color', (v) => v], ['background', (v) => splitTop(v).find((p) => !/^(url|linear|radial|conic|repeating)/.test(p)) ?? null]]
  if (prop === 'border-radius') return [['border-radius', (v) => splitTop(v)[0] ?? v], ['border-top-left-radius', (v) => v]]
  if (prop === 'row-gap') return [['row-gap', (v) => v], ['gap', (v) => pickPair(v, 0)]]
  if (prop === 'column-gap') return [['column-gap', (v) => v], ['gap', (v) => pickPair(v, 1)]]
  return [[prop, (v) => v]]
}

// The value this element's CSS writes for a property: the declaration the cascade picks (inline style, or
// the strongest matching rule), e.g. "var(--space-12)" or "12px". Null when nothing sets it directly
// (inherited or default).
export function declaredValue(el, prop) {
  const srcs = sources(prop)
  const read = (style) => {
    for (const [name, pick] of srcs) {
      const v = style.getPropertyValue(name)
      if (v) return { value: pick(v.trim()), important: style.getPropertyPriority(name) === 'important' }
    }
    return null
  }
  const inline = read(el.style)
  if (inline?.important) return inline.value
  let found = null // the strongest ordinary declaration
  let forced = null // the strongest !important one: among those an earlier layer wins, the reverse of the usual
  for (const rule of matchedRules(el)) {
    const hit = read(rule.style)
    if (!hit) continue
    if (!hit.important) found = hit.value
    else if (!forced || compareLayers(rule.layer, forced.layer) <= 0) forced = { value: hit.value, layer: rule.layer }
  }
  return forced?.value ?? inline?.value ?? found
}

// The variables a declared value is written with, leaving out a framework's own working ones:
// "rgb(255 255 255 / var(--tw-text-opacity))" has none, "calc(var(--spacing) * 4)" has --spacing.
const varsIn = (declared) => [...(declared?.matchAll(/var\(\s*(--[\w-]+)/g) ?? [])].map((m) => m[1]).filter((name) => !isInternal(name))

// The token a declared value is written with, or null. With a list, one of its tokens comes before any other.
export const tokenIn = (declared, list = []) => {
  const names = varsIn(declared)
  return names.find((name) => list.some((t) => t.name === name)) ?? names[0] ?? null
}

// How a value stands against the token list:
//   token   – written with a token: var(--space-12)
//   matches – a raw value that equals a token (should use it)
//   rogue   – a raw value with no token
//   custom  – written with a variable that isn't in our token list
//   none    – not set
export function status(declared, computedPx, list) {
  const name = tokenIn(declared, list)
  if (name) return { kind: isToken(name) ? 'token' : 'custom', token: name }
  // Nothing written and nothing there: not set. A written 0 is checked like any value (--space-0).
  if (!computedPx && !declared) return { kind: 'none' }
  if (computedPx === null) return { kind: 'rogue' }
  const match = list.find((t) => Math.abs(t.px - computedPx) < 0.01)
  return match ? { kind: 'matches', token: match.name } : { kind: 'rogue' }
}

/* ---------- Naming an element ---------- */

// Next.js / React internals that would only add noise to the path.
const NEXT_INTERNAL = /^(Inner|Outer|Fragment|Suspense|Provider|Consumer|LinkComponent|Segment|Router|Layout|Redirect|Error|NotFound|HTTPAccess|Loading|Scroll|RenderFromTemplate|Template|ClientPageRoot|ClientSegmentRoot|AppRouter|HotReload|Head|Server|Dev|Root|Metadata|Viewport|AppDev)|Boundary$/

// Closest React components, nearest first (from React's internal fiber, dev builds only).
export function componentPath(el) {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
  let fiber = key ? el[key] : null
  const names = []
  while (fiber && names.length < 4) {
    const t = fiber.type
    const name = typeof t === 'function' ? t.displayName || t.name : null
    if (name && /^[A-Z]/.test(name) && !NEXT_INTERNAL.test(name) && names[names.length - 1] !== name) {
      names.push(name)
    }
    fiber = fiber.return
  }
  return names
}

export function describe(el) {
  const tag = el.tagName.toLowerCase()
  const cls = [...el.classList].filter((c) => !c.includes('(') && !c.includes('[')).slice(0, 2)
  const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)
  return { tag, short: [tag, ...cls].join('.'), text }
}

// A CSS path from the nearest id, so a note can find its element again after a reload.
// Each step says which of its matching siblings it is (:nth-of-type), and the path goes up only as far
// as it needs to point at this one element, so a note on the third of three identical boxes stays there.
export function cssPath(el) {
  const parts = []
  let n = el
  while (n && n.nodeType === 1 && n !== document.body && parts.length < 12) {
    if (n.id) {
      parts.unshift(`#${CSS.escape(n.id)}`)
      break
    }
    const tag = n.tagName.toLowerCase()
    const cls = [...n.classList].filter((c) => /^[a-z][\w-]*$/i.test(c)).slice(0, 1)
    let step = tag + (cls.length ? `.${cls[0]}` : '')
    const same = n.parentElement ? [...n.parentElement.children].filter((s) => s.tagName === n.tagName) : []
    if (same.length > 1) step += `:nth-of-type(${same.indexOf(n) + 1})`
    parts.unshift(step)
    const path = parts.join(' > ')
    try {
      const found = document.querySelectorAll(path)
      if (found.length === 1 && found[0] === el) return path
    } catch {}
    n = n.parentElement
  }
  return parts.join(' > ')
}

// Does the element hold its own text (not just child elements)?
export function hasOwnText(el) {
  return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
}

// The type style the element uses: on itself, or inherited from the nearest ancestor that has one.
// Either the class in markup (.text-body) or its token in CSS (font: var(--text-body)), which is how the
// library's components set type. own: a class on the element itself (the one Scootch can swap or detach).
export function typeClassOf(el) {
  let n = el
  while (n && n.nodeType === 1) {
    const cls = typeClasses().find((c) => n.classList.contains(c))
    if (cls) return { cls, own: n === el }
    const token = declaredValue(n, 'font')?.match(/^var\(\s*--(text-[a-z0-9-]+)\s*\)$/)?.[1]
    if (token && typeClasses().includes(token)) return { cls: token, own: false, css: true, here: n === el }
    n = n.parentElement
  }
  return null
}

/* ---------- Small shared helpers ---------- */

// Whether the page is light or dark, for any app. In order:
//   1. what the app says: data-theme or a dark / light class on <html> or <body>
//   2. what it shows: the page's own background (body's, else html's), dark when it's a dark colour
//   3. with no background set: the browser's own canvas, dark when the page opts in (color-scheme) and the system is dark
let pixel
function rgbaOf(colour) {
  // A 1px canvas turns any CSS colour (rgb, oklch, color()…) into red, green, blue and alpha
  pixel ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!pixel) return null
  pixel.clearRect(0, 0, 1, 1)
  pixel.fillStyle = colour
  pixel.fillRect(0, 0, 1, 1)
  return pixel.getImageData(0, 0, 1, 1).data
}
export function pageTheme() {
  if (typeof document === 'undefined') return 'light'
  const els = [document.documentElement, document.body].filter(Boolean)
  for (const el of els) {
    const named = el.dataset.theme
    if (named === 'dark' || named === 'light') return named
    if (el.classList.contains('dark')) return 'dark'
    if (el.classList.contains('light')) return 'light'
  }
  for (const el of [...els].reverse()) {
    const c = rgbaOf(getComputedStyle(el).backgroundColor)
    if (c && c[3] > 127) return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 < 0.4 ? 'dark' : 'light'
  }
  const scheme = getComputedStyle(document.documentElement).colorScheme || ''
  if (/dark/.test(scheme) && (!/light/.test(scheme) || matchMedia('(prefers-color-scheme: dark)').matches)) return 'dark'
  return 'light'
}

// A unique id: the time, plus a random tail so ids made in the same ms (several at once) still differ
export const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Settings kept in this browser, as JSON. Storage can be blocked (private windows, iframes): then get
// gives the fallback and set / remove do nothing, so it just isn't remembered.
export const store = {
  get(key, fallback) {
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? fallback : JSON.parse(saved)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch {}
  },
}
