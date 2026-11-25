// The app's tokens, found in its own CSS: every custom property declared in the page's stylesheets.
// Nothing is hardcoded to one design system. Which tokens count as spacing, font sizes and so on is
// decided by name prefix (configure() changes them); the defaults cover Tailwind v4
// and the common names (--space-*, --spacing-*, --font-size-*, --text-*, --radius-*…).

const DEFAULTS = {
  space: ['--space-', '--spacing-', '--spacing'],
  fontSize: ['--font-size-', '--text-'],
  lineHeight: ['--line-height-', '--leading-'],
  weight: ['--weight-', '--font-weight-'],
  tracking: ['--tracking-', '--letter-spacing-'],
  radius: ['--radius-', '--rounded-', '--radius'],
  borderWidth: ['--border-width', '--border-'],
  // Never offered as colours, even if their value is one
  notColour: ['--shadow', '--sc-', '--scootch-', '--tw-'],
  // A framework's own working variables (Tailwind's --tw-text-opacity and the like): never a token
  internal: ['--tw-'],
  // Type classes: a class whose rule sets `font`, `font-size` or `font-family`, matched by this pattern
  typeClass: /^text-[a-z0-9-]+$/,
}

let config = { ...DEFAULTS }

// Change what counts as what. Pass only the groups to change, e.g. { space: ['--gap-'] }.
export function configure(next = {}) {
  config = { ...DEFAULTS, ...next }
  names = null
  classes = null
}

/* ---------- Reading the stylesheets ---------- */

let names = null
let classes = null

// Every rule, through @media, @layer, @supports and nesting. Stylesheets from another origin can't be read; skip them.
function eachRule(fn) {
  const walk = (rules) => {
    for (const r of rules) {
      fn(r)
      if (r.cssRules?.length) walk(r.cssRules)
    }
  }
  for (const sheet of document.styleSheets) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    if (rules) walk(rules)
  }
}

// All custom property names the app declares (cached until reset()).
export function tokenNames() {
  if (names) return names
  const found = new Set()
  eachRule((r) => {
    const s = r.style
    if (!s) return
    for (let i = 0; i < s.length; i++) if (s[i].startsWith('--')) found.add(s[i])
  })
  names = [...found].filter((n) => !n.startsWith('--sc-') && !n.startsWith('--scootch-'))
  return names
}

// Type classes: classes matching config.typeClass whose rule sets the font.
export function typeClasses() {
  if (classes) return classes
  const found = new Set()
  eachRule((r) => {
    if (!r.selectorText || !r.style) return
    if (!r.style.font && !r.style.fontSize && !r.style.fontFamily) return
    for (const sel of r.selectorText.split(',')) {
      const m = sel.trim().match(/^\.([a-zA-Z0-9_-]+)$/)
      if (m && config.typeClass.test(m[1])) found.add(m[1])
    }
  })
  classes = [...found]
  return classes
}

// Stylesheets change (hot reload, a new page): read them again next time.
export function reset() {
  names = null
  classes = null
}

/* ---------- Groups ---------- */

const startsWithAny = (name, prefixes) => prefixes.some((p) => name === p || name.startsWith(p))

export const namesIn = (group) => tokenNames().filter((n) => startsWithAny(n, config[group]))

export const isToken = (name) => tokenNames().includes(name)

export const isInternal = (name) => startsWithAny(name, config.internal)

// Colour tokens: any token whose live value is a colour (CSS.supports decides), except shadows and our own.
export function colourNames() {
  const root = getComputedStyle(document.documentElement)
  return tokenNames().filter((n) => {
    if (startsWithAny(n, config.notColour)) return false
    const v = root.getPropertyValue(n).trim()
    return v && !/^-?[\d.]/.test(v) && CSS.supports('color', v)
  })
}
