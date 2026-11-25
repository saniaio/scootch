'use client'

// Scootch: ⌥I to check any element's spacing, layout, type, fill and border against your tokens,
// edit them live, and leave notes. Dev only: renders nothing in production builds.
import Scootch from './Scootch'

export { Scootch }
export { configure } from './tokens'
// Your own values as a section in the panel, to tune while you look (see controls.js)
export { useControls } from './controls'

// The panel as part of a page, for showing Scootch off (a marketing site, a docs page). It renders where
// you mount it, is always open, and runs in production too. `scope` is a CSS selector: only elements
// inside it can be picked, and the rest of the page behaves as usual. Notes stay in the browser.
export function ScootchEmbed(props) {
  return <Scootch {...props} embed />
}

export default function DevScootch(props) {
  if (process.env.NODE_ENV !== 'development') return null
  return <Scootch {...props} />
}
