// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.
// The icons Scootch uses, as inline SVG: from Lucide (lucide.dev, ISC), and a few drawn the same way
// (24 grid, 2px stroke) where Lucide has none.
import { useId, type SVGProps } from 'react'

export type IconWeight = 'regular' | 'bold' | 'fill'
export type IconNode = [tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse', attrs: Record<string, string | number>]
export type IconFill = { solid: number[] } | { knockout: number }
/** An icon: Lucide's (with its Lucide name) or our own (no `lucide`). */
export type IconDef = { lucide?: string; tags: string[]; nodes: IconNode[]; fill?: IconFill }
export type IconSource = 'lucide' | 'custom'
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number | string
  weight?: IconWeight
  /** On by default: the stroke stays STROKE_PX whatever the size. Pass false to scale it with the icon, as Lucide does. */
  absoluteStrokeWidth?: boolean
}
export type Icon = (props: IconProps) => React.JSX.Element

/** Lucide's grid. */
export const GRID = 24
/** Stroke width on the 24 grid, by weight. */
export const strokes: Record<IconWeight, number> = { regular: 2, bold: 2.5, fill: 2 }

const lucideSet = {
  Bold: {
    lucide: 'bold',
    tags: ["text","strong","format","weight"],
    nodes: [["path",{"d":"M6 12h9a4 4 0 010 8H7a1 1 0 01-1-1V5a1 1 0 011-1h7a4 4 0 010 8"}]],
  },
  ArrowCounterClockwise: {
    lucide: 'rotate-ccw',
    tags: ["arrow","left","counter-clockwise","restart","reload","rerun"],
    nodes: [["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]],
  },
  ArrowRight: {
    lucide: 'arrow-right',
    tags: ["direction","movement","horizontal","rightward","rightwards","east"],
    nodes: [["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]],
  },
  ArrowUp: {
    lucide: 'arrow-up',
    tags: ["direction","movement","vertical","upward","upwards","north"],
    nodes: [["path",{"d":"m5 12 7-7 7 7"}],["path",{"d":"M12 19V5"}]],
  },
  CaretDown: {
    lucide: 'chevron-down',
    tags: ["direction","movement","vertical","downward","downwards","south"],
    nodes: [["path",{"d":"m6 9 6 6 6-6"}]],
  },
  Check: {
    lucide: 'check',
    tags: ["checkmark","done","completed","finished","successful","confirmed"],
    nodes: [["path",{"d":"M20 6 9 17l-5-5"}]],
  },
  CircleNotch: {
    lucide: 'loader-circle',
    tags: ["loading","wait","busy","progress","spinner","spinning"],
    nodes: [["path",{"d":"M21 12a9 9 0 1 1-6.219-8.56"}]],
  },
  Copy: {
    lucide: 'copy',
    tags: ["clone","duplicate","multiple"],
    nodes: [["rect",{"width":14,"height":14,"x":8,"y":8,"rx":2,"ry":2}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],
    fill: {solid: [0]},
  },
  // The gaps: Lucide's gap-horizontal and gap-vertical without the dashed line between, so it's just the
  // two sides and the space they hold apart
  GapHorizontal: {
    tags: ["gap","spacing","space","between","padding","margin"],
    nodes: [["path",{"d":"M21 3h-3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"}],["path",{"d":"M3 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3"}]],
  },
  GapVertical: {
    tags: ["gap","spacing","space","between","padding","margin"],
    nodes: [["path",{"d":"M3 21v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3"}],["path",{"d":"M3 3v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3"}]],
  },
  LetterSpacing: {
    lucide: 'letter-spacing',
    tags: ["alphabet","character","text","font","typography","tracking"],
    nodes: [["path",{"d":"M15 14H9"}],["path",{"d":"M21 3v18"}],["path",{"d":"M3 3v18"}],["path",{"d":"m8 16 3.453-7.648a.6.6 0 011.094.001L16 16"}]],
  },
  LineHeight: {
    lucide: 'line-height',
    tags: ["alphabet","character","text","font","typography","leading"],
    nodes: [["path",{"d":"M15 14H9"}],["path",{"d":"M21 21H3"}],["path",{"d":"M21 3H3"}],["path",{"d":"m8 16 3.453-7.648a.6.6 0 011.094.001L16 16"}]],
  },
  Link: {
    lucide: 'link',
    tags: ["link","chain","attach","token","match","use"],
    nodes: [["path",{"d":"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"}],["path",{"d":"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"}]],
  },
  ALargeSmall: {
    lucide: 'a-large-small',
    tags: ["font size","text size","type","scale","letters"],
    nodes: [["path",{"d":"m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16"}],["path",{"d":"M15.697 14h5.606"}],["path",{"d":"m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16"}],["path",{"d":"M3.304 13h6.392"}]],
  },
  LinkBreak: {
    lucide: 'unlink',
    tags: ["detach","break","unlink","chain","token"],
    nodes: [["path",{"d":"m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"}],["path",{"d":"m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"}],["line",{"x1":8,"x2":8,"y1":2,"y2":5}],["line",{"x1":2,"x2":5,"y1":8,"y2":8}],["line",{"x1":16,"x2":16,"y1":19,"y2":22}],["line",{"x1":19,"x2":22,"y1":16,"y2":16}]],
  },
  Grid: {
    lucide: 'layout-grid',
    tags: ["grid","tiles","swatches","view","layout"],
    nodes: [["rect",{"width":7,"height":7,"x":3,"y":3,"rx":1}],["rect",{"width":7,"height":7,"x":14,"y":3,"rx":1}],["rect",{"width":7,"height":7,"x":14,"y":14,"rx":1}],["rect",{"width":7,"height":7,"x":3,"y":14,"rx":1}]],
  },
  List: {
    lucide: 'menu',
    tags: ["bars","navigation","hamburger","options"],
    nodes: [["path",{"d":"M4 5h16"}],["path",{"d":"M4 12h16"}],["path",{"d":"M4 19h16"}]],
  },
  Minus: {
    lucide: 'minus',
    tags: ["minus","remove","delete","cancel","erase","subtract"],
    nodes: [["path",{"d":"M5 12h14"}]],
  },
  Moon: {
    lucide: 'moon',
    tags: ["dark","night"],
    nodes: [["path",{"d":"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"}]],
    fill: {solid: [0]},
  },
  PanelRight: {
    lucide: 'panel-right',
    tags: ["position","placement","right","right edge","rightmost","right side"],
    nodes: [["rect",{"width":18,"height":18,"x":3,"y":3,"rx":2}],["path",{"d":"M15 3v18"}]],
    fill: {knockout: 0},
  },
  PencilSimple: {
    lucide: 'pencil',
    tags: ["edit","modify","update","revise","amend","create"],
    nodes: [["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]],
  },
  Plus: {
    lucide: 'plus',
    tags: ["plus","add","new","create","+","increase"],
    nodes: [["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],
  },
  Rows: {
    lucide: 'rows-3',
    tags: ["lines","list","queue","preview","paragraphs","parallel"],
    nodes: [["rect",{"width":18,"height":18,"x":3,"y":3,"rx":2}],["path",{"d":"M21 9H3"}],["path",{"d":"M21 15H3"}]],
    fill: {knockout: 0},
  },
  SquareDot: {
    lucide: 'square-dot',
    tags: ["git","diff","modified","."],
    nodes: [["rect",{"width":18,"height":18,"x":3,"y":3,"rx":2}],["circle",{"cx":12,"cy":12,"r":1}]],
    fill: {knockout: 0},
  },
  Sun: {
    lucide: 'sun',
    tags: ["brightness","weather","light","summer"],
    nodes: [["circle",{"cx":12,"cy":12,"r":4}],["path",{"d":"M12 2v2"}],["path",{"d":"M12 20v2"}],["path",{"d":"m4.93 4.93 1.41 1.41"}],["path",{"d":"m17.66 17.66 1.41 1.41"}],["path",{"d":"M2 12h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"m6.34 17.66-1.41 1.41"}],["path",{"d":"m19.07 4.93-1.41 1.41"}]],
    fill: {solid: [0]},
  },
  Type: {
    lucide: 'type',
    tags: ["alphabet","character","text","font","typography"],
    nodes: [["path",{"d":"M12 4v16"}],["path",{"d":"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"}],["path",{"d":"M9 20h6"}]],
  },
  X: {
    lucide: 'x',
    tags: ["alphabet","character","text","font","typography","x"],
    nodes: [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
  },
  ArrowDown: {
    lucide: 'arrow-down',
    tags: ["direction","movement","vertical","downward","downwards","south","column"],
    nodes: [["path",{"d":"M12 5v14"}],["path",{"d":"m19 12-7 7-7-7"}]],
  },
  ArrowLeftRight: {
    lucide: 'arrow-left-right',
    tags: ["switch","swap","reverse","flip","exchange","direction"],
    nodes: [["path",{"d":"M8 3 4 7l4 4"}],["path",{"d":"M4 7h16"}],["path",{"d":"m16 21 4-4-4-4"}],["path",{"d":"M20 17H4"}]],
  },
  WrapText: {
    lucide: 'wrap-text',
    tags: ["wrap","lines","flow","break","layout"],
    nodes: [["path",{"d":"m16 16-3 3 3 3"}],["path",{"d":"M3 12h14.5a1 1 0 0 1 0 7H13"}],["path",{"d":"M3 19h6"}],["path",{"d":"M3 5h18"}]],
  },
  JustifyBetween: {
    lucide: 'align-horizontal-space-between',
    tags: ["justify","space","between","distribute","flex","layout"],
    nodes: [["rect",{"width":6,"height":14,"x":3,"y":5,"rx":2}],["rect",{"width":6,"height":10,"x":15,"y":7,"rx":2}],["path",{"d":"M3 2v20"}],["path",{"d":"M21 2v20"}]],
  },
  Columns: {
    lucide: 'columns-3',
    tags: ["columns","grid","layout","split","table"],
    nodes: [["rect",{"width":18,"height":18,"x":3,"y":3,"rx":2}],["path",{"d":"M9 3v18"}],["path",{"d":"M15 3v18"}]],
  },
} satisfies Record<string, IconDef>

// Our own, in Lucide's style
const customSet = {
  // Spreading items along a row, as a set with Lucide's align-horizontal-space-between (JustifyBetween):
  // Packed: two items side by side in the middle, no edges (where they sit is up to the align pad).
  // Around: two items with the same space on both sides of each, between the edges (Lucide's has one item).
  JustifyPacked: {
    tags: ['justify', 'packed', 'together', 'group', 'flex', 'layout'],
    nodes: [
      ['rect', { width: 6, height: 14, x: 4.25, y: 5, rx: 2 }],
      ['rect', { width: 6, height: 10, x: 13.75, y: 7, rx: 2 }],
    ],
  },
  JustifyAround: {
    tags: ['justify', 'space', 'around', 'distribute', 'flex', 'layout'],
    nodes: [
      ['rect', { width: 5, height: 14, x: 5, y: 5, rx: 2 }],
      ['rect', { width: 5, height: 10, x: 14, y: 7, rx: 2 }],
      ['path', { d: 'M2 2v20' }],
      ['path', { d: 'M22 2v20' }],
    ],
  },
  // Rulers along the top and left edges, as Scootch shows them when they're on
  RulerCorner: {
    tags: ['ruler', 'rulers', 'measure', 'guides', 'scootch'],
    nodes: [
      ['path', { d: 'M5 3h14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' }],
      ['path', { d: 'M13 3v3' }],
      ['path', { d: 'M17 3v3' }],
      ['path', { d: 'M3 13h3' }],
      ['path', { d: 'M3 17h3' }],
    ],
    fill: { knockout: 0 },
  },
  // A border's line styles, drawn the Lucide way along one 18-unit line (3 to 21), so the three read as a set:
  // a solid line, three dashes, four round dots (the line's thickness, like Lucide's), with clear space between
  LineSolid: {
    tags: ['border', 'line', 'solid', 'style', 'stroke'],
    nodes: [['path', { d: 'M3 12h18' }]],
  },
  LineDashed: {
    tags: ['border', 'line', 'dashed', 'style', 'stroke'],
    nodes: [
      ['path', { d: 'M4 12h2' }],
      ['path', { d: 'M11 12h2' }],
      ['path', { d: 'M18 12h2' }],
    ],
  },
  LineDotted: {
    tags: ['border', 'line', 'dotted', 'style', 'stroke'],
    nodes: [
      ['path', { d: 'M4 12h.01' }],
      ['path', { d: 'M9.33 12h.01' }],
      ['path', { d: 'M14.67 12h.01' }],
      ['path', { d: 'M20 12h.01' }],
    ],
  },
  // A corner radius, exaggerated: the top right is a full quarter circle, set apart from the square's sides
  CornerRadius: {
    tags: ['radius', 'corner', 'round', 'border', 'shape'],
    nodes: [
      ['path', { d: 'M21 13A10 10 0 0 0 11 3' }],
      ['path', { d: 'M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2' }],
    ],
  },
} satisfies Record<string, IconDef>

const set = { ...lucideSet, ...customSet }

export type IconName = keyof typeof set
/** Where an icon comes from: Lucide, or drawn here. */
export const iconSource = (name: IconName): IconSource => (iconDefs[name].lucide ? 'lucide' : 'custom')
export const iconDefs: Record<IconName, IconDef> = set

const Node = ({ node, ...props }: { node: IconNode } & SVGProps<SVGElement>) => {
  const [Tag, attrs] = node
  return <Tag {...(attrs as object)} {...(props as object)} />
}

/** An icon's nodes at a weight: what to fill, what to stroke, what to cut out. */
export function IconBody({ def, weight = 'regular', maskId }: { def: IconDef; weight?: IconWeight; maskId: string }) {
  const fill = weight === 'fill' ? def.fill : undefined
  if (fill && 'knockout' in fill) {
    const base = def.nodes[fill.knockout]
    const cuts = def.nodes.filter((_, i) => i !== fill.knockout)
    return (
      <>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={GRID} height={GRID}>
          <rect width={GRID} height={GRID} fill="#fff" stroke="none" />
          <g stroke="#000">
            {cuts.map((n, i) => (
              <Node key={i} node={n} />
            ))}
          </g>
        </mask>
        <Node node={base} fill="currentColor" mask={`url(#${maskId})`} />
      </>
    )
  }
  const solid = fill && 'solid' in fill ? fill.solid : []
  return (
    <>
      {def.nodes.map((n, i) => (
        <Node key={i} node={n} fill={solid.includes(i) ? 'currentColor' : undefined} />
      ))}
    </>
  )
}

/** The stroke width for a weight, on the 24 grid. With absoluteStrokeWidth, it stays that many px at any size. */
/** The line every icon draws, in px, whatever its size: one weight across the system. Sizes are 16 (standalone
 *  and toolbar buttons), 14 (inside a control: field icons, token / link buttons, reset) and 12 (carets, checks). */
export const STROKE_PX = 1.25
const strokeFor = (weight: IconWeight, def: IconDef, size: number | string, absolute: boolean) => {
  const w = weight === 'fill' && !def.fill ? strokes.bold : strokes[weight]
  if (!absolute) return w
  const px = typeof size === 'number' ? size : 16 // 1em: the text it sits in, about 16
  return (STROKE_PX * (w / strokes.regular) * GRID) / px
}

function make(name: IconName): Icon {
  const def = set[name] as IconDef
  function IconComponent({ size = '1em', weight = 'regular', absoluteStrokeWidth = true, strokeWidth, ...props }: IconProps) {
    const maskId = 'icon' + useId().replace(/[^\w-]/g, '')
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={`0 0 ${GRID} ${GRID}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth ?? strokeFor(weight, def, size, absoluteStrokeWidth)}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={props['aria-label'] ? undefined : true}
        {...props}
      >
        <IconBody def={def} weight={weight} maskId={maskId} />
      </svg>
    )
  }
  IconComponent.displayName = name
  return IconComponent
}

// Every icon, by name (for the Icons page)
export const iconNames = Object.keys(set) as IconName[]
export const icons = Object.fromEntries(iconNames.map((n) => [n, make(n)])) as Record<IconName, Icon>

export const ArrowCounterClockwise = icons.ArrowCounterClockwise
export const ArrowRight = icons.ArrowRight
export const ArrowUp = icons.ArrowUp
export const CaretDown = icons.CaretDown
export const Check = icons.Check
export const CircleNotch = icons.CircleNotch
export const Copy = icons.Copy
export const GapHorizontal = icons.GapHorizontal
export const GapVertical = icons.GapVertical
export const LetterSpacing = icons.LetterSpacing
export const LineHeight = icons.LineHeight
export const ALargeSmall = icons.ALargeSmall
export const LinkBreak = icons.LinkBreak
export const Grid = icons.Grid
export const List = icons.List
export const Minus = icons.Minus
export const Moon = icons.Moon
export const PanelRight = icons.PanelRight
export const PencilSimple = icons.PencilSimple
export const Plus = icons.Plus
export const Rows = icons.Rows
export const SquareDot = icons.SquareDot
export const Sun = icons.Sun
export const Type = icons.Type
export const X = icons.X
export const Bold = icons.Bold
export const RulerCorner = icons.RulerCorner
export const ArrowDown = icons.ArrowDown
export const ArrowLeftRight = icons.ArrowLeftRight
export const WrapText = icons.WrapText
export const JustifyBetween = icons.JustifyBetween
export const JustifyAround = icons.JustifyAround
export const JustifyPacked = icons.JustifyPacked
export const Columns = icons.Columns
export const LineDashed = icons.LineDashed
export const LineSolid = icons.LineSolid
export const CornerRadius = icons.CornerRadius
export const LineDotted = icons.LineDotted
export const Link = icons.Link
