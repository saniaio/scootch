# Scootch

A dev-only inspector for any React app. Press **⌥I**, click an element and see, in sections that fold away:

- **Spacing:** margin and padding as a box model, against your spacing tokens, then width and height. A min or max shows when one is set; the + shows the rest
- **Display:** block, flex, grid or none; direction, wrap, justify, where the children sit (an anchor grid) and gap
- **Type:** the type style, font, size, line height, weight, tracking, case and colour. While a type style is attached its values are locked; detach it to change them one by one. Sizes in px, rem or em. The font list has your font tokens first, then every font your project loads
- **Fill:** background colour, or on an SVG its fill
- **Border:** sides, style, colour, width and radius

Each value shows as a token (written with a token), a match (a raw value that equals a token) or rogue (no token). Edit values live: drag or type a number, or pick a token. On the page, drag a margin, padding or gap band to change it: it snaps to your spacing tokens, and holding ⌘ (Ctrl on Windows) scrubs any value. Colour lists switch between a list and a grid of swatches. Each section can reset its own changes.

The bar at the top holds the tools:

- **Draw (⇧D):** sketch over the page. The sketch is saved as a note pinned to the element under it, with its strokes, and shows there again next time.
- **Rulers (⇧R):** rulers on the top and left edges, like Figma. They push the page in rather than cover it (sticky elements move down to clear the top ruler). Drag a guide out of a ruler, drag it to move it (it snaps to the selected element's edges and centre), or drag it back onto the ruler to remove it. Double-click the corner to clear them all.
- **Dock:** the panel sits beside the page at full height, like the browser's inspect panel, so nothing is hidden under it. Drag its left edge to resize it. Floating, drag the panel by its bar: its home on the right edge shows while you drag, and it snaps back there when dropped near it.
- **Theme:** switches the panel between light and dark. It changes the panel only, never your page.
- **Close.**

Leave notes pinned to elements from the comment box under the values. Adjustments save themselves as notes too, one per element, kept up to date as you tweak. Notes and adjusted elements get numbered markers on the page and one numbered list: open it with **View all** at the bottom of the panel, or the list icon in the bar. Click an item to go to it. **Copy** copies them all as text; **Reset**, in the list, undoes every adjustment and marks every note resolved.

It works with any design system: it reads the tokens from your app's own CSS. It renders nothing in production, and a production build leaves it out entirely, its styles included: Scootch adds its stylesheet to the page itself, only when it renders.

## Install

```bash
npm install -D scootch
```

Needs React 18 or 19. Everything else it uses comes with it.

## With an AI agent

Paste this to your agent and it sets Scootch up for you:

```text
Add Scootch to this project. It is a dev-only inspector for React apps: it renders nothing in production.

1. Install it as a dev dependency: npm install -D scootch
2. Find where the app is mounted (Next.js: the root layout; Vite: main.tsx). Import Scootch from 'scootch' and render <Scootch /> once, next to the app. It brings its own styles: there is no CSS file to import.
3. Make notes save to .notes/notes.json. Next.js: add app/api/notes/route.js that re-exports GET, POST, PATCH and DELETE from 'scootch/next'. Vite: add scootchNotes() from 'scootch/vite' to the plugins.
4. Add .notes/ to .gitignore.
5. Start the dev server and check that ⌥I opens the panel.
6. From now on, when I say "sc": read .notes/notes.json, act on every open note, then mark each one resolved with a one-line reply. Save that to your project instructions file (AGENTS.md, CLAUDE.md or the like) so it holds in every future session, for you and for any other agent.
7. When it all works, tell me: "Scootch is installed. Press ⌥I to open it, and type sc whenever you want me to check your notes."
```

**sc** is the shortcut: type it to your agent and it reads the notes you left with Scootch, acts on each one and marks it resolved. It works with any agent, because the notes are a plain file (`.notes/notes.json`) and the shortcut is a line in your project's instructions.

## Next.js (App Router)

In the root layout:

```jsx
import Scootch from 'scootch'

// …inside <body>
<Scootch />
```

For notes, add `app/api/notes/route.js`:

```js
export { GET, POST, PATCH, DELETE } from 'scootch/next'
```

## Vite

```jsx
// main.tsx
import Scootch from 'scootch'
// render <Scootch /> next to your <App />
```

```js
// vite.config.js
import scootchNotes from 'scootch/vite'
export default { plugins: [react(), scootchNotes()] }
```

Notes are saved in `.notes/notes.json` in your app's folder. Add `.notes/` to `.gitignore`.

## Astro

Scootch runs as a React island. Astro needs its React integration (`npx astro add react`), and Scootch has to sit in a small component of your own: importing it straight into an `.astro` file doesn't load.

```jsx
// src/components/ScootchDev.jsx
import Scootch from 'scootch'
export default function ScootchDev() {
  return <Scootch />
}
```

```astro
---
// in your layout
import ScootchDev from '../components/ScootchDev.jsx'
---
<ScootchDev client:only="react" />
```

For notes, add `scootchNotes()` from `scootch/vite` under `vite.plugins` in `astro.config.mjs`.

## Vue, Svelte or plain HTML

Scootch is a React component, but it only looks at the page, so it works beside any framework. Add React as a dev dependency (`npm install -D scootch react react-dom`) and give Scootch a root of its own in one small file:

```js
// src/scootch.js
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import Scootch from 'scootch'

const el = document.createElement('div')
document.body.appendChild(el)
createRoot(el).render(createElement(Scootch))
```

Load it from your entry file in development only, so none of it reaches a production build:

```js
// src/main.js, after your app is mounted
if (import.meta.env.DEV) import('./scootch.js')
```

On Vite (the default for Vue and Svelte), notes work with `scootchNotes()` from `scootch/vite` in `vite.config.js`, as above.

## Your tokens

Scootch reads every custom property in your stylesheets, then sorts them by name:

| Group | Default prefixes |
| --- | --- |
| Spacing | `--space-`, `--spacing-`, `--spacing` |
| Font size | `--font-size-`, `--text-` |
| Line height | `--line-height-`, `--leading-` |
| Weight | `--weight-`, `--font-weight-` |
| Tracking | `--tracking-`, `--letter-spacing-` |
| Radius | `--radius-`, `--rounded-`, `--radius` |
| Border width | `--border-width`, `--border-` |
| Colour | any token whose value is a colour (not shadows) |
| Type classes | classes like `.text-body` that set the font |

That covers Tailwind v4 and most token naming out of the box. For other names, pass your own:

```jsx
<Scootch tokens={{ space: ['--gap-'], fontSize: ['--fs-'], typeClass: /^type-/ }} />
```

Values in px or rem both work. Stylesheets from another domain (like Google Fonts) can't be read, which is fine since they hold no tokens.

## Your own controls

Scootch can show values of your own as a section in its panel, to tune while you look: the numbers behind an experiment, an effect, an animation. Ask your agent for it ("add Scootch controls for this") or write it yourself:

```jsx
import { useControls } from 'scootch'

function Card() {
  const v = useControls('Card glow', {
    blur: { value: 12, min: 0, max: 40, unit: 'px' }, // a number: scrub it or type. min, max, step and unit are optional
    opacity: 0.6,                                     // a bare number works too
    on: true,                                         // a switch
    tint: '#7c3aed',                                  // a colour
    label: 'Hello',                                   // text
    shape: { value: 'soft', options: ['soft', 'hard'] }, // a choice
    shadow: { x: 0, y: 8 },                           // a nested object is a sub-group
    shuffle: () => reshuffle(),                       // a function is a button
  })
  return <div style={{ filter: `blur(${v.blur}px)` }}>…</div>
}
```

- The section is named after the first argument, so call it whatever fits: "Card glow", "3D controls".
- It sits under Border in the panel, and shows even with nothing selected. Pass `{ ref }` as a third argument to tie it to an element: then it shows only while that element, or something inside it, is selected.
- The values are live. Until something is changed they are the ones in your code.
- A changed value is listed with Scootch's other changes and saved as a note. Type **sc** and your agent writes the new values into the code as the defaults.
- In a production build it registers nothing and returns the values in your code.

## Options

- `notesApi`: where notes are saved (default `/api/notes`)
- `tokens`: the prefixes above
- `tabs`: your own tabs beside Inspect, as `[{ id, label, render }]`

The panel follows your page: on a dark page it opens dark. Its light / dark button changes the panel only, never your page, and that choice lasts until the page itself switches theme.

Besides the default export, the package exports `Scootch` (without the production check), `ScootchEmbed` (below), `useControls` (above) and `configure` (set the token prefixes without the prop).

## Embedded

To show Scootch working on a public page (its own website does this), mount `ScootchEmbed` where the panel should sit, in a box with a width and height:

```jsx
import { ScootchEmbed } from 'scootch'

<div style={{ width: 344, height: 720 }}>
  <ScootchEmbed scope=".hero" select=".hero-intro" theme="dark" />
</div>
```

It is always open and runs in production. Only elements inside `scope` (a CSS selector) can be picked; the rest of the page behaves as usual. `select` is the element it starts on, so there is something to try straight away. Notes stay in the browser and go when the page reloads. Draw, rulers and dock are left out, since they act on the whole page. If the full Scootch is open on the same page, the embedded one steps aside.

Rendered on the server, the embedded panel is in the page before Scootch has added its styles. To have it styled from the first paint, import the stylesheet yourself, once: `import 'scootch/styles.css'`. The floating Scootch never needs this.

## Look

Scootch has its own styles (`--sc-*`), so your app's CSS doesn't change it, and its values can't clash with your tokens. It's dark when the page is: it reads `data-theme` or a `dark` class on `<html>` or `<body>`, and otherwise the page's own background. It is set in [ABC Areal](https://abcdinamo.com/typefaces/areal) if your app or your computer already has it, and otherwise in your computer's own font (San Francisco on a Mac, Segoe UI on Windows). Scootch ships and loads no fonts.

To restyle it, override any `--sc-*` value in your own CSS, for example `:root { --sc-accent: #e11d48; }`.

## Licence

MIT.

Scootch builds on many great open libraries, with thanks:

- [Base UI](https://base-ui.com) (MIT): the behaviour under its controls
- [Toolcraft](https://github.com/pixel-point/toolcraft) (MIT), [Fluid Functionalism](https://github.com/mickadesign/fluid-functionalism) (MIT) and [DialKit](https://github.com/joshpuckett/dialkit) (MIT): parts of the interface were adapted from them
- [Lucide](https://lucide.dev) (ISC): the icons

Their notices are in LICENSE.
