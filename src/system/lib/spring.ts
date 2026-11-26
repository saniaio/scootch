// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.
// Springs, our own (no animation library).
//   animateSpring – moves a number to a target on a spring, frame by frame. Interruptible: start a new one
//                   from the current value and velocity and it carries on smoothly.
//   springEasing  – the same spring as a CSS `linear()` easing + duration, for CSS transitions.
// Springs are described the way Motion does it: a visual duration (seconds) and a bounce (0–1),
// or as raw stiffness / damping / mass.

export type Spring = { stiffness: number; damping: number; mass?: number }

// Motion's conversion, so values tuned there carry over exactly.
export function fromVisual(visualDuration: number, bounce = 0): Spring {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  const stiffness = root * root
  return { stiffness, damping: 2 * Math.min(1, Math.max(0.05, 1 - bounce)) * Math.sqrt(stiffness), mass: 1 }
}

// Motion's other way to describe a spring: settle within `duration` seconds. With no bounce this is a
// critically damped spring whose ω solves e^(−ωd)(ωd + 1) = 0.001 (Motion's own threshold), so ωd ≈ 9.233.
export function fromDuration(duration: number, bounce = 0): Spring {
  if (bounce > 0) return fromVisual(duration, bounce)
  const omega = 9.2334 / duration
  return { stiffness: omega * omega, damping: 2 * omega, mass: 1 }
}

// Our spring presets. Each is named for what it does; use these rather than new numbers.
export const springs = {
  glide: fromDuration(0.08), // the hover highlight sliding between items: fast, no bounce
  squash: fromVisual(0.2, 0.1), // a handle squashing when you press it
  grow: fromVisual(0.25, 0.15), // a handle growing as you reach for it
  settle: fromVisual(0.35, 0.15), // something stretched springing back to rest
  release: { stiffness: 300, damping: 25, mass: 0.8 }, // a value catching up to where you let go
} satisfies Record<string, Spring>

const REST_DELTA = 0.01
const REST_SPEED = 0.1

export type SpringControls = { stop: () => void; velocity: () => number }

export function animateSpring({
  from,
  to,
  velocity = 0,
  spring,
  onUpdate,
  onComplete,
  restDelta = REST_DELTA,
}: {
  from: number
  to: number
  velocity?: number
  spring: Spring
  onUpdate: (value: number) => void
  onComplete?: () => void
  restDelta?: number
}): SpringControls {
  const { stiffness, damping, mass = 1 } = spring
  let x = from
  let v = velocity
  let last = performance.now()
  let raf = 0
  let stopped = false
  const step = (now: number) => {
    if (stopped) return
    // Fixed small steps keep the maths stable whatever the frame rate
    let dt = Math.min(0.064, (now - last) / 1000)
    last = now
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      const a = (-stiffness * (x - to) - damping * v) / mass
      v += a * h
      x += v * h
      dt -= h
    }
    if (Math.abs(x - to) < restDelta && Math.abs(v) < REST_SPEED) {
      onUpdate(to)
      onComplete?.()
      return
    }
    onUpdate(x)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return {
    stop: () => {
      stopped = true
      cancelAnimationFrame(raf)
    },
    velocity: () => v,
  }
}

// A spring from 0 to 1 sampled into a CSS linear() easing, with the time it takes to settle.
const cache = new Map<string, { easing: string; duration: number }>()
export function springEasing(spring: Spring): { easing: string; duration: number } {
  const key = `${spring.stiffness}|${spring.damping}|${spring.mass ?? 1}`
  const hit = cache.get(key)
  if (hit) return hit
  const { stiffness, damping, mass = 1 } = spring
  const h = 1 / 600
  let x = 0
  let v = 0
  let t = 0
  const samples: number[] = [0]
  while (t < 3) {
    for (let i = 0; i < 10; i++) {
      const a = (-stiffness * (x - 1) - damping * v) / mass
      v += a * h
      x += v * h
    }
    t += h * 10
    samples.push(x)
    // Settled: within 0.1% and slow enough that it won't swing back out (Motion's own threshold)
    if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.5) break
  }
  samples[samples.length - 1] = 1
  // Keep it short: every other sample is plenty for a smooth curve
  const pts = samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1)
  const out = { easing: `linear(${pts.map((p) => Number(p.toFixed(4))).join(', ')})`, duration: Math.round(t * 1000) }
  cache.set(key, out)
  return out
}
