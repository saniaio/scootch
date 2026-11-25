'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// The scrolling inside a list popup (select, combobox, autocomplete, menu): the library's ScrollArea, so the
// scrollbar is thin, floats over the list 4px from the edge and takes no room. The popup's padding sits inside
// it (.sc-ui-popup-body), so the bar runs along the popup's edge, not inside the padding. Put the popup's whole
// content in it; the body is the positioned parent OptionHighlight needs.
import type { ReactNode } from 'react'
import ScrollArea from '../ScrollArea'

export default function PopupScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="sc-ui-popup-scroll">
      <div className="sc-ui-popup-body">{children}</div>
    </ScrollArea>
  )
}
