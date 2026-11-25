'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Option highlight: one highlight that glides to whichever option Base UI marks as highlighted (mouse or keyboard).
// Fluid's idea (one highlight per list), driven by Base UI's own highlight so arrow keys glide too.
// Put <OptionHighlight /> as the first child of a list with position: relative.
import { useEffect, useRef } from 'react'

export default function OptionHighlight({ selector = '[data-highlighted]' }: { selector?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const glide = ref.current
    const list = glide?.parentElement
    if (!glide || !list) return
    let shown = false
    const place = () => {
      const item = list.querySelector<HTMLElement>(selector)
      if (!item) {
        glide.style.opacity = '0'
        shown = false
        return
      }
      // Layout offsets, not screen rects: the popup opens with a small scale animation, and a screen
      // rect taken mid-animation would size the highlight too small.
      let x = 0
      let y = 0
      let n: HTMLElement | null = item
      while (n && n !== list) {
        x += n.offsetLeft
        y += n.offsetTop
        n = n.offsetParent as HTMLElement | null
        if (n && n !== list && !list.contains(n)) break
      }
      // A fresh entry appears in place; after that it glides between items.
      glide.style.transition = shown ? '' : 'none'
      glide.style.transform = `translate(${x}px, ${y}px)`
      glide.style.width = `${item.offsetWidth}px`
      glide.style.height = `${item.offsetHeight}px`
      glide.style.opacity = '1'
      if (!shown) {
        void glide.offsetWidth
        glide.style.transition = ''
      }
      shown = true
    }
    const observer = new MutationObserver(place)
    observer.observe(list, { subtree: true, attributes: true, attributeFilter: ['data-highlighted'] })
    // The popup settles its width (to match the trigger) just after opening: re-measure when it does.
    const resize = new ResizeObserver(() => {
      if (!shown) return
      const was = glide.style.transition
      glide.style.transition = 'none'
      shown = false
      place()
      glide.style.transition = was
    })
    resize.observe(list)
    place()
    return () => {
      observer.disconnect()
      resize.disconnect()
    }
  }, [selector])

  return <span ref={ref} className="sc-ui-glide" aria-hidden />
}
