// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.
// Colour maths for ColorPicker: sRGB / Display P3 / OKLCH, plus HSV for the picking area.
// Formats like DialKit's: Hex (sRGB), OKLCH, and Display P3 (the wider-gamut space most screens can show).
export type Space = 'srgb' | 'p3'
export type Format = 'hex' | 'oklch' | 'p3'
export type RGB = [number, number, number] // gamma-encoded, 0–1, in its space
export type HSVA = { h: number; s: number; v: number; a: number }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const round = (n: number, d = 3) => Number(n.toFixed(d))

/* ---- transfer + matrices (D65) ---- */
const toLinear = (c: number) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (Math.abs(c) <= 0.0031308 ? 12.92 * c : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055))
const mul = (m: number[][], v: number[]) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as RGB

const SRGB_TO_XYZ = [
  [0.4123907992659595, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151036, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559185, 0.11919477979462599, 0.9505321522496606],
]
const XYZ_TO_SRGB = [
  [3.2409699419045213, -1.5373831775700935, -0.4986107602930033],
  [-0.9692436362808798, 1.8759675015077206, 0.04155505740717561],
  [0.05563007969699361, -0.20397695888897657, 1.0569715142428786],
]
const P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
]
const XYZ_TO_P3 = [
  [2.493496911941425, -0.9313836179191239, -0.40271078445071684],
  [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
  [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
]

export function convert(rgb: RGB, from: Space, to: Space): RGB {
  if (from === to) return rgb
  const xyz = mul(from === 'srgb' ? SRGB_TO_XYZ : P3_TO_XYZ, rgb.map(toLinear))
  return mul(to === 'srgb' ? XYZ_TO_SRGB : XYZ_TO_P3, xyz).map(toGamma) as RGB
}

/* ---- OKLCH (via linear sRGB, which is fine outside 0–1) ---- */
function linearSrgbToOklch([r, g, b]: RGB) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { l: L, c: C, h: C < 1e-4 ? 0 : H }
}

function oklchToLinearSrgb(L: number, C: number, H: number): RGB {
  const A = C * Math.cos((H * Math.PI) / 180)
  const B = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const p3ToOklch = (rgb: RGB) => linearSrgbToOklch(mul(XYZ_TO_SRGB, mul(P3_TO_XYZ, rgb.map(toLinear))))
const oklchToP3 = (L: number, C: number, H: number) =>
  mul(XYZ_TO_P3, mul(SRGB_TO_XYZ, oklchToLinearSrgb(L, C, H))).map(toGamma).map(clamp01) as RGB

/* ---- HSV (for the picking area, in whichever space is active) ---- */
export function rgbToHsv([r, g, b]: RGB) {
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const f = (k: number) => {
    const x = (k + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1))
  }
  return [f(5), f(3), f(1)]
}

/* ---- parse + format ---- */
export type Parsed = { rgb: RGB; space: Space; a: number; format: Format }

export function parse(value: string): Parsed | null {
  const v = value.trim()
  const hex = v.match(/^#?([0-9a-f]{3,8})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB
    return { rgb: n, space: 'srgb', a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1, format: 'hex' }
  }
  const fn = v.match(/^(oklch|color)\(([^()]*)\)$/i)
  if (!fn) return null
  const [body, alpha] = fn[2].split('/').map((x) => x.trim())
  const a = alpha === undefined ? 1 : alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha)
  const parts = body.split(/\s+/)
  if (fn[1].toLowerCase() === 'oklch') {
    const L = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0])
    const C = parseFloat(parts[1])
    const H = parseFloat(parts[2]) || 0
    if (![L, C].every(Number.isFinite)) return null
    return { rgb: oklchToP3(L, C, H), space: 'p3', a, format: 'oklch' }
  }
  if (parts[0] !== 'display-p3') return null
  const rgb = parts.slice(1, 4).map(parseFloat) as RGB
  if (!rgb.every(Number.isFinite)) return null
  return { rgb, space: 'p3', a, format: 'p3' }
}

export function format(rgb: RGB, space: Space, a: number, to: Format): string {
  const alpha = a < 1 ? ` / ${round(a, 2)}` : ''
  if (to === 'hex') {
    const srgb = convert(rgb, space, 'srgb').map(clamp01)
    const hx = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
    return `#${srgb.map(hx).join('')}${a < 1 ? hx(a) : ''}`
  }
  const p3 = convert(rgb, space, 'p3').map(clamp01) as RGB
  if (to === 'p3') return `color(display-p3 ${p3.map((n) => round(n, 4)).join(' ')}${alpha})`
  const o = p3ToOklch(p3)
  return `oklch(${round(o.l)} ${round(o.c)} ${round(o.h, 2)}${alpha})`
}

// The space each format picks in: Hex is sRGB; OKLCH and P3 pick in the wider P3 space (like DialKit).
export const spaceFor = (f: Format): Space => (f === 'hex' ? 'srgb' : 'p3')

// A CSS colour for an RGB in a space (for gradients and swatches).
export const css = (rgb: RGB, space: Space, a = 1) =>
  space === 'srgb'
    ? `rgb(${rgb.map((n) => Math.round(clamp01(n) * 255)).join(' ')} / ${a})`
    : `color(display-p3 ${rgb.map((n) => round(clamp01(n), 4)).join(' ')} / ${a})`
