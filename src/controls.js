// Controls: values of your own that Scootch shows as a section in its panel, to tune while you look.
// For an experiment, an effect, anything with numbers you would otherwise change in code and reload.
//
//   const v = useControls('Card glow', {
//     blur: { value: 12, min: 0, max: 40 },          // a number: scrub it or type; min, max, step, unit are optional
//     opacity: 0.6,                                  // a bare number works too
//     on: true,                                      // a switch
//     tint: '#7c3aed',                               // a colour (any CSS colour written out)
//     label: 'Hello',                                // text
//     shape: { value: 'soft', options: ['soft', 'hard'] },   // a choice
//     shadow: { x: 0, y: 8 },                        // a nested object is a sub-group
//     shuffle: () => reshuffle(),                    // a function is a button
//   })
//   // v.blur, v.on, v.tint, v.shape, v.shadow.y …: live, and the defaults until something is changed
//
// The section is named after the first argument. Pass { ref } to tie it to an element: then it shows only
// while that element (or something inside it) is selected. A changed value is listed with Scootch's other
// changes and saved as a note, so an agent can write the new values back into the code as the defaults.
// In a production build this registers nothing and returns the defaults.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

const groups = new Map() // name → { name, schema(), defaults, values, el, at }
const listeners = new Set()
const NONE = []
let snapshot = NONE
const emit = () => {
  snapshot = [...groups.values()]
  listeners.forEach((l) => l())
}
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))

const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\()/i

// What a schema entry is: number, toggle, colour, text, choice, action or group
export function kindOf(spec) {
  if (typeof spec === 'function') return 'action'
  if (typeof spec === 'boolean') return 'toggle'
  if (typeof spec === 'number') return 'number'
  if (typeof spec === 'string') return COLOUR.test(spec.trim()) ? 'colour' : 'text'
  if (!spec || typeof spec !== 'object') return null
  if (Array.isArray(spec.options)) return 'choice'
  if ('value' in spec) return spec.kind ?? kindOf(spec.value)
  return 'group'
}

// A choice's options as { value, label }
export const optionsOf = (spec) => spec.options.map((o) => (o && typeof o === 'object' ? { value: String(o.value), label: o.label ?? String(o.value) } : { value: String(o), label: String(o) }))

function defaultsOf(schema) {
  const out = {}
  for (const [key, spec] of Object.entries(schema ?? {})) {
    const kind = kindOf(spec)
    if (!kind || kind === 'action') continue
    if (kind === 'group') out[key] = defaultsOf(spec)
    else if (kind === 'choice') out[key] = String(spec.value ?? optionsOf(spec)[0]?.value ?? '')
    else out[key] = spec && typeof spec === 'object' ? spec.value : spec
  }
  return out
}

// The schema as text, to tell when the code's own defaults have changed (functions don't count)
const signature = (schema) => JSON.stringify(schema, (_, v) => (typeof v === 'function' ? 'ƒ' : v))

const setIn = (obj, [key, ...rest], value) => ({ ...obj, [key]: rest.length ? setIn(obj[key] ?? {}, rest, value) : value })
const getIn = (obj, path) => path.reduce((o, k) => o?.[k], obj)

// Every value that differs from the code's default: [{ key: 'shadow.y', from, to }]
export function changesOf(group, defaults = group.defaults, values = group.values, prefix = []) {
  const out = []
  for (const key of Object.keys(defaults)) {
    const path = [...prefix, key]
    if (defaults[key] && typeof defaults[key] === 'object') out.push(...changesOf(group, defaults[key], values?.[key] ?? {}, path))
    else if (values?.[key] !== defaults[key]) out.push({ key: path.join('.'), from: defaults[key], to: values?.[key] })
  }
  return out
}

export function setControl(name, path, value) {
  const g = groups.get(name)
  if (!g || getIn(g.values, path) === value) return
  groups.set(name, { ...g, values: setIn(g.values, path, value), at: g.at || Date.now() })
  emit()
}

// Back to the code's defaults: one group, or all of them
export function resetControls(name) {
  let any = false
  for (const g of groups.values()) {
    if ((name && g.name !== name) || g.values === g.defaults) continue
    groups.set(g.name, { ...g, values: g.defaults, at: 0 })
    any = true
  }
  if (any) emit()
}

// For the panel: every group on the page, in the order they mounted
export const useControlGroups = () => useSyncExternalStore(subscribe, () => snapshot, () => NONE)

export function useControls(name, schema, { ref } = {}) {
  const key = signature(schema)
  const defaults = useMemo(() => defaultsOf(schema), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  // The newest schema, so a button always calls the function from the latest render
  const latest = useRef(schema)
  latest.current = schema
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    groups.set(name, { name, schema: () => latest.current, defaults, values: defaults, el: ref ? () => ref.current : null, at: 0 })
    emit()
    return () => {
      groups.delete(name)
      emit()
    }
  }, [name, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return useSyncExternalStore(
    subscribe,
    () => groups.get(name)?.values ?? defaults,
    () => defaults,
  )
}
